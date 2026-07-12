import { describe, expect, it, vi } from 'vitest';
import { ReadinessService } from '../src/readiness/readiness.service';

describe('ReadinessService.isPositiveAttempt', () => {
  const service = new ReadinessService({} as never);

  it('accepts each canonical positive signal', () => {
    expect(service.isPositiveAttempt({ rubricScore: 0.6 })).toBe(true);
    expect(service.isPositiveAttempt({ aiScore: 0.6 })).toBe(true);
    expect(service.isPositiveAttempt({ selfRating: 3 })).toBe(true);
    expect(service.isPositiveAttempt({ correctness: 'correct' })).toBe(true);
    expect(service.isPositiveAttempt({ correctness: 'STRONG' })).toBe(true);
  });

  it('rejects partial / weak / empty attempts', () => {
    expect(service.isPositiveAttempt({ correctness: 'partial' })).toBe(false);
    expect(service.isPositiveAttempt({ selfRating: 2, rubricScore: 0.5, aiScore: 0.4 })).toBe(false);
    expect(service.isPositiveAttempt({})).toBe(false);
  });
});

describe('ReadinessService.areaMastery', () => {
  // A card reviewed recently with healthy stability should read high retrievability.
  const recentlyReviewed = {
    objectId: 'q-sd',
    stability: 30,
    difficulty: 5,
    due: new Date(Date.now() + 20 * 86_400_000),
    state: 2,
    reps: 4,
    lapses: 0,
    lastReviewedAt: new Date(Date.now() - 2 * 86_400_000),
  };
  const neverReviewed = {
    objectId: 'q-new',
    stability: 0,
    difficulty: 0,
    due: new Date(),
    state: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
  };

  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      reviewState: { findMany: vi.fn().mockResolvedValue([recentlyReviewed]) },
      answerAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { area: 'system_design', selfRating: 4, correctness: null, rubricScore: null, aiScore: null },
          { area: 'system_design', selfRating: 1, correctness: null, rubricScore: null, aiScore: null },
          { area: 'dsa', selfRating: 5, correctness: null, rubricScore: null, aiScore: null },
        ]),
      },
      question: { findMany: vi.fn().mockResolvedValue([{ id: 'q-sd', areaTags: ['system_design'] }]) },
      ...overrides,
    };
    return new ReadinessService(prisma as never);
  }

  it('grounds an area in retrievability + graded attempts', async () => {
    const mastery = await (buildService()).areaMastery('user-1');

    const sd = mastery.get('system_design');
    expect(sd).toBeDefined();
    expect(sd!.reviewedCount).toBe(1);
    expect(sd!.gradedAttempts).toBe(2);
    expect(sd!.positiveAttempts).toBe(1);
    expect(sd!.retrievability).not.toBeNull();
    expect(sd!.retrievability!).toBeGreaterThan(0.5);
    expect(sd!.retrievability!).toBeLessThanOrEqual(1);
    // 0.6*retrievability + 0.4*min(1, 1/5) → clearly positive, below 1.
    expect(sd!.score).toBeGreaterThan(0);
    expect(sd!.score).toBeLessThan(1);
  });

  it('scores an attempt-only area with no reviews via partial retention credit', async () => {
    const mastery = await (buildService()).areaMastery('user-1');
    const dsa = mastery.get('dsa'); // one positive attempt, no review state
    expect(dsa).toBeDefined();
    expect(dsa!.retrievability).toBeNull();
    expect(dsa!.positiveAttempts).toBe(1);
    // retention falls back to 0.5 → score = 0.6*0.5 + 0.4*(1/5) = 0.38.
    expect(dsa!.score).toBeCloseTo(0.38, 2);
  });

  it('ignores never-reviewed (New) cards for retrievability', async () => {
    const service = buildService({
      reviewState: { findMany: vi.fn().mockResolvedValue([neverReviewed]) },
      answerAttempt: { findMany: vi.fn().mockResolvedValue([]) },
      question: { findMany: vi.fn().mockResolvedValue([{ id: 'q-new', areaTags: ['system_design'] }]) },
    });
    const mastery = await service.areaMastery('user-1');
    // No retrievable review and no attempts → the area produces no signal at all.
    expect(mastery.get('system_design')).toBeUndefined();
  });
});
