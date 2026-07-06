import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewableObjectType, ReviewStateResponse } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { createInitialReviewState, scheduleNextReview } from './fsrs-scheduler';

// MOM-067: 'story' added alongside 'question'. Unlike Question (a shared/global
// bank), Story is per-user private data — record() must additionally verify
// story ownership before scheduling a review from it (see ensureAccessible).
const SUPPORTED_OBJECT_TYPES: ReviewableObjectType[] = ['question', 'story'];

// MOM-029: persistence layer for the FSRS review loop. objectId has no DB-level
// foreign key (ADR-0002 — polymorphic across future reviewable types), so this
// service is the place that validates objectType and, per ADR-0002's SPIKE-003
// finding, callers that hard-delete a reviewable object must clean up matching
// ReviewState rows themselves (see questions.service.ts's remove()).
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSupportedType(objectType: string): asserts objectType is ReviewableObjectType {
    if (!SUPPORTED_OBJECT_TYPES.includes(objectType as ReviewableObjectType)) {
      throw new BadRequestException(`Unsupported reviewable object type: ${objectType}`);
    }
  }

  async listDue(userId: string, now: Date = new Date()): Promise<ReviewStateResponse[]> {
    const states = await this.prisma.reviewState.findMany({
      where: { userId, suspended: false, due: { lte: now } },
      orderBy: { due: 'asc' },
    });

    const questionIds = states.filter((s) => s.objectType === 'question').map((s) => s.objectId);
    const storyIds = states.filter((s) => s.objectType === 'story').map((s) => s.objectId);
    const [questions, stories] = await Promise.all([
      questionIds.length
        ? this.prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, title: true } })
        : Promise.resolve([]),
      storyIds.length
        ? this.prisma.story.findMany({ where: { id: { in: storyIds } }, select: { id: true, title: true } })
        : Promise.resolve([]),
    ]);
    const titleByQuestionId = new Map(questions.map((q) => [q.id, q.title]));
    const titleByStoryId = new Map(stories.map((s) => [s.id, s.title]));

    return states.map((state) => {
      if (state.objectType === 'question') return serialize(state, titleByQuestionId.get(state.objectId) ?? null);
      if (state.objectType === 'story') return serialize(state, titleByStoryId.get(state.objectId) ?? null);
      return serialize(state);
    });
  }

  async record(
    userId: string,
    objectType: string,
    objectId: string,
    selfRating: number,
    now: Date = new Date(),
  ): Promise<ReviewStateResponse> {
    this.assertSupportedType(objectType);
    await this.ensureAccessible(userId, objectType, objectId);

    const existing = await this.prisma.reviewState.findUnique({
      where: { userId_objectType_objectId: { userId, objectType, objectId } },
    });

    const current = existing ?? { ...createInitialReviewState(now), id: undefined };
    const next = scheduleNextReview(current, selfRating, now);

    const state = await this.prisma.reviewState.upsert({
      where: { userId_objectType_objectId: { userId, objectType, objectId } },
      create: { userId, objectType, objectId, ...next },
      update: next,
    });
    return serialize(state);
  }

  // Question is a shared/global bank — any authenticated user may schedule a
  // review from any question. Story is per-user private data (ADR-0003) — a
  // user must own the story to review it, otherwise this would let user A
  // read/rate user B's private story indirectly via review state.
  private async ensureAccessible(userId: string, objectType: ReviewableObjectType, objectId: string): Promise<void> {
    if (objectType !== 'story') return;
    const story = await this.prisma.story.findFirst({ where: { id: objectId, userId }, select: { id: true } });
    if (!story) throw new NotFoundException('Story not found');
  }
}

function serialize(
  state: {
    id: string;
    objectType: string;
    objectId: string;
    stability: number;
    difficulty: number;
    due: Date;
    state: number;
    reps: number;
    lapses: number;
    suspended: boolean;
    lastReviewedAt: Date | null;
  },
  title: string | null = null,
): ReviewStateResponse {
  return {
    id: state.id,
    objectType: state.objectType as ReviewableObjectType,
    objectId: state.objectId,
    stability: state.stability,
    difficulty: state.difficulty,
    due: state.due.toISOString(),
    state: state.state,
    reps: state.reps,
    lapses: state.lapses,
    suspended: state.suspended,
    lastReviewedAt: state.lastReviewedAt ? state.lastReviewedAt.toISOString() : null,
    title,
  };
}
