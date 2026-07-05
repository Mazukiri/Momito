import { BadRequestException, Injectable } from '@nestjs/common';
import type { ReviewableObjectType, ReviewStateResponse } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { createInitialReviewState, scheduleNextReview } from './fsrs-scheduler';

const SUPPORTED_OBJECT_TYPES: ReviewableObjectType[] = ['question'];

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
    return states.map(serialize);
  }

  async record(
    userId: string,
    objectType: string,
    objectId: string,
    selfRating: number,
    now: Date = new Date(),
  ): Promise<ReviewStateResponse> {
    this.assertSupportedType(objectType);

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
}

function serialize(state: {
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
}): ReviewStateResponse {
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
  };
}
