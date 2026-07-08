import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fsrs, type FSRS } from 'ts-fsrs';
import { CAREER_ROLE_AREA_IDS } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';

// MOM-129 (ADR-0011 / D-013): the single readiness engine. Before this, readiness
// was computed two divergent ways — career.service (binary keyword coverage) and
// missions.service (count-based level 0–3) — with two *different* "positive
// attempt" definitions, so the same history produced different numbers. This
// service owns the one canonical positive-attempt rule and grounds per-area
// readiness in FSRS retrievability + graded attempts (not keyword presence), so
// readiness reflects real recall and decays as reviews age. Both engines route
// through it.

// Positive attempts needed for full "volume" credit in an area.
const MASTERY_TARGET_ATTEMPTS = 5;
// The grounded score weights sustained recall (retrievability) over raw volume.
const RETENTION_WEIGHT = 0.6;
const VOLUME_WEIGHT = 0.4;

export interface AttemptQuality {
  selfRating?: number | null;
  correctness?: string | null;
  rubricScore?: number | null;
  aiScore?: number | null;
}

export interface AreaMastery {
  area: string;
  // Average FSRS retrievability across the area's reviewed questions (0–1), or
  // null when nothing in the area has been reviewed yet.
  retrievability: number | null;
  reviewedCount: number;
  gradedAttempts: number;
  positiveAttempts: number;
  // Grounded readiness for the area, 0–1.
  score: number;
}

type ReviewStateRow = {
  objectId: string;
  stability: number;
  difficulty: number;
  due: Date;
  state: number;
  reps: number;
  lapses: number;
  lastReviewedAt: Date | null;
};

@Injectable()
export class ReadinessService {
  private readonly scheduler: FSRS = fsrs();

  constructor(private readonly prisma: PrismaService) {}

  // The ONE canonical "did this attempt demonstrate mastery" rule — the union of
  // the definitions career.service and missions.service used to keep separately.
  // 'partial' correctness is deliberately excluded (attempted, not there yet).
  isPositiveAttempt(attempt: AttemptQuality): boolean {
    return (
      (attempt.rubricScore ?? 0) >= 0.6 ||
      (attempt.aiScore ?? 0) >= 0.6 ||
      (attempt.selfRating ?? 0) >= 3 ||
      ['correct', 'strong'].includes((attempt.correctness ?? '').toLowerCase())
    );
  }

  // Per-area FSRS-grounded mastery for a user. Retention half: average
  // retrievability over the user's question ReviewStates, mapped to areas via
  // Question.areaTags (a bounded in-memory join — ADR-0011 Q2, no ReviewState
  // denormalization). Performance half: graded attempts grouped by the MOM-128
  // `area` tag. Only areas with some signal appear in the map.
  async areaMastery(userId: string): Promise<Map<string, AreaMastery>> {
    const [reviewStates, attempts] = await Promise.all([
      this.prisma.reviewState.findMany({
        where: { userId, objectType: 'question', suspended: false },
        select: {
          objectId: true,
          stability: true,
          difficulty: true,
          due: true,
          state: true,
          reps: true,
          lapses: true,
          lastReviewedAt: true,
        },
      }),
      this.prisma.answerAttempt.findMany({
        where: { userId, area: { not: null } },
        select: { area: true, selfRating: true, correctness: true, rubricScore: true, aiScore: true },
      }),
    ]);

    const questionIds = reviewStates.map((state) => state.objectId);
    const questions = questionIds.length
      ? await this.prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, areaTags: true } })
      : [];
    const areasOfQuestion = new Map<string, string[]>();
    for (const question of questions) {
      areasOfQuestion.set(question.id, this.knownAreas(question.areaTags));
    }

    const now = new Date();
    const acc = new Map<string, { rSum: number; rCount: number; graded: number; positive: number }>();
    const bucket = (area: string) => {
      let entry = acc.get(area);
      if (!entry) {
        entry = { rSum: 0, rCount: 0, graded: 0, positive: 0 };
        acc.set(area, entry);
      }
      return entry;
    };

    for (const state of reviewStates) {
      const retrievability = this.retrievability(state, now);
      if (retrievability === null) continue;
      for (const area of areasOfQuestion.get(state.objectId) ?? []) {
        const entry = bucket(area);
        entry.rSum += retrievability;
        entry.rCount += 1;
      }
    }

    for (const attempt of attempts) {
      const area = attempt.area;
      if (!area || !this.isKnownArea(area)) continue;
      const entry = bucket(area);
      entry.graded += 1;
      if (this.isPositiveAttempt(attempt)) entry.positive += 1;
    }

    const result = new Map<string, AreaMastery>();
    for (const [area, entry] of acc) {
      const retrievability = entry.rCount > 0 ? entry.rSum / entry.rCount : null;
      // No reviews yet but positive attempts exist → partial retention credit,
      // so a freshly-practiced-but-never-reviewed area isn't scored at zero.
      const retention = retrievability ?? (entry.positive > 0 ? 0.5 : 0);
      const volume = Math.min(1, entry.positive / MASTERY_TARGET_ATTEMPTS);
      const score = this.clamp01(RETENTION_WEIGHT * retention + VOLUME_WEIGHT * volume);
      result.set(area, {
        area,
        retrievability: retrievability === null ? null : Number(retrievability.toFixed(3)),
        reviewedCount: entry.rCount,
        gradedAttempts: entry.graded,
        positiveAttempts: entry.positive,
        score: Number(score.toFixed(3)),
      });
    }
    return result;
  }

  // FSRS retrievability for a single card, or null when it has never been reviewed
  // (a New card / zero stability carries no recall signal).
  private retrievability(state: ReviewStateRow, now: Date): number | null {
    if (state.state === 0 || state.stability <= 0 || !state.lastReviewedAt) return null;
    return this.scheduler.get_retrievability(
      {
        due: state.due,
        stability: state.stability,
        difficulty: state.difficulty,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: state.reps,
        lapses: state.lapses,
        state: state.state,
        last_review: state.lastReviewedAt,
      },
      now,
      false,
    );
  }

  private knownAreas(value: Prisma.JsonValue): string[] {
    return (Array.isArray(value) ? value : []).filter((tag): tag is string => typeof tag === 'string' && this.isKnownArea(tag));
  }

  private isKnownArea(area: string): boolean {
    return (CAREER_ROLE_AREA_IDS as readonly string[]).includes(area);
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
