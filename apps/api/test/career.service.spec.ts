import { describe, expect, it, vi } from 'vitest';
import { CareerService } from '../src/career/career.service';

// MOM-129: career readiness is now grounded in the shared ReadinessService's
// per-area mastery (FSRS retrievability + graded attempts), blended 50/50 with
// keyword coverage where an area has history. These tests pin that blend with an
// empty evidence context (coverage 0), so any non-zero percentage comes purely
// from grounded mastery.
function buildService(mastery: Map<string, unknown>) {
  const prisma = {
    profile: { findUnique: vi.fn().mockResolvedValue(null) },
    answerAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    learningEvidence: { findMany: vi.fn().mockResolvedValue([]) },
    learningHighlight: { findMany: vi.fn().mockResolvedValue([]) },
    jobApplication: { findMany: vi.fn().mockResolvedValue([]) },
    task: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const readiness = {
    isPositiveAttempt: () => true,
    areaMastery: vi.fn().mockResolvedValue(mastery),
  };
  return new CareerService(prisma as never, readiness as never);
}

describe('CareerService.getReadiness — FSRS grounding (MOM-129)', () => {
  it('blends mastery into an area with history and exposes the grounded fields', async () => {
    const mastery = new Map<string, unknown>([
      ['dsa', { area: 'dsa', retrievability: 0.85, reviewedCount: 3, gradedAttempts: 5, positiveAttempts: 5, score: 0.8 }],
    ]);
    const result = await buildService(mastery).getReadiness('big-tech-swe', 'user-1');

    const dsa = result.areas.find((area) => area.area === 'dsa');
    expect(dsa).toBeDefined();
    // coverage 0 (empty context) blended 50/50 with masteryScore 80 → 40.
    expect(dsa!.masteryScore).toBe(80);
    expect(dsa!.percentage).toBe(40);
    expect(dsa!.retrievability).toBe(0.85);

    // Grounding moved the headline off zero even though keyword coverage is 0.
    expect(result.overallPercentage).toBeGreaterThan(0);
  });

  it('leaves an area with no mastery history at its coverage number, mastery null', async () => {
    const result = await buildService(new Map()).getReadiness('big-tech-swe', 'user-1');
    for (const area of result.areas) {
      expect(area.masteryScore).toBeNull();
      expect(area.retrievability).toBeNull();
      expect(area.percentage).toBe(0); // coverage 0, no history to blend
    }
    expect(result.overallPercentage).toBe(0);
  });
});
