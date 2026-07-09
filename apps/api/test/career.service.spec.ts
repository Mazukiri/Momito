import { describe, expect, it, vi } from 'vitest';
import { CareerService } from '../src/career/career.service';

// MOM-129: career readiness is now grounded in the shared ReadinessService's
// per-area mastery (FSRS retrievability + graded attempts), blended 50/50 with
// keyword coverage where an area has history. These tests pin that blend with an
// empty evidence context (coverage 0), so any non-zero percentage comes purely
// from grounded mastery.
function buildService(mastery: Map<string, unknown>, extra: { prisma?: Record<string, unknown>; openSignals?: unknown[] } = {}) {
  const prisma = {
    profile: { findUnique: vi.fn().mockResolvedValue(null) },
    answerAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    learningEvidence: { findMany: vi.fn().mockResolvedValue([]) },
    learningHighlight: { findMany: vi.fn().mockResolvedValue([]) },
    jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    task: { findMany: vi.fn().mockResolvedValue([]) },
    ...extra.prisma,
  };
  const readiness = {
    isPositiveAttempt: () => true,
    areaMastery: vi.fn().mockResolvedValue(mastery),
  };
  const weaknesses = {
    listOpenSignals: vi.fn().mockResolvedValue(extra.openSignals ?? []),
  };
  return new CareerService(prisma as never, readiness as never, weaknesses as never);
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

describe('CareerService.getJobReadiness — "am I ready?" verdict (MOM-130)', () => {
  const strongMastery = () =>
    new Map<string, unknown>(
      ['dsa', 'system_design', 'lld_oop', 'projects', 'behavioral'].map((area) => [
        area,
        { area, retrievability: 0.95, reviewedCount: 5, gradedAttempts: 6, positiveAttempts: 6, score: 0.9 },
      ]),
    );

  const job = { id: 'job-1', company: 'Meta', roleTitle: 'E5 SWE', roleTrackId: 'big-tech-swe' };

  function signal(area: string, severity: number) {
    return { id: `sig-${area}`, signalType: 'area', key: area, label: `${area} weak`, roleTrackId: null, area, jobApplicationId: 'job-1', severity, occurrences: 1, source: 'debrief', status: 'open', lastSignalAt: '2026-07-09T00:00:00.000Z' };
  }

  it('docks the verdict for the job\'s open weakness signals', async () => {
    const service = buildService(strongMastery(), {
      prisma: { jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(job) } },
      openSignals: [signal('system_design', 2)],
    });

    const verdict = await service.getJobReadiness('job-1', 'user-1');

    expect(verdict.company).toBe('Meta');
    expect(verdict.penalty).toBe(10); // severity 2 * 5
    expect(verdict.blockingSignals).toHaveLength(1);
    // Strong mastery everywhere → high base, minus 10.
    expect(verdict.score).toBeGreaterThan(0);
    expect(verdict.weakestAreas.length).toBeGreaterThan(0);
    expect(['ready', 'almost', 'not_ready']).toContain(verdict.status);
  });

  it('caps the penalty and never goes negative', async () => {
    const service = buildService(new Map(), {
      prisma: { jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(job) } },
      openSignals: [signal('dsa', 10), signal('system_design', 10)],
    });

    const verdict = await service.getJobReadiness('job-1', 'user-1');

    expect(verdict.penalty).toBe(30); // capped
    expect(verdict.score).toBe(0); // base 0 - 30, clamped
    expect(verdict.status).toBe('not_ready');
  });

  it('throws when the job is not the user\'s', async () => {
    const service = buildService(new Map(), {
      prisma: { jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) } },
    });
    await expect(service.getJobReadiness('job-x', 'user-1')).rejects.toThrow();
  });
});

describe('CareerService.getJobStoryGaps — behavioral gap map (MOM-131)', () => {
  const job = { id: 'job-1', company: 'Meta', roleTitle: 'E5 SWE', roleTrackId: 'big-tech-swe' };

  function withStories(stories: Array<{ competencyTags: string[] }>, jobRow: unknown = job) {
    return buildService(new Map(), {
      prisma: {
        jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(jobRow) },
        story: { findMany: vi.fn().mockResolvedValue(stories) },
      },
    });
  }

  it('marks covered competencies and names the missing ones (case-insensitive tags)', async () => {
    // big-tech-swe expects ownership/conflict/ambiguity/failure. Cover two.
    const service = withStories([
      { competencyTags: ['Ownership', 'delivery'] },
      { competencyTags: ['conflict'] },
    ]);

    const result = await service.getJobStoryGaps('job-1', 'user-1');

    expect(result.company).toBe('Meta');
    // Order follows STORY_COMPETENCIES declaration order (the intersection preserves it).
    expect(result.competencies.map((c) => c.id)).toEqual(['ownership', 'conflict', 'failure', 'ambiguity']);
    expect(result.coveredCount).toBe(2);
    expect(result.missingCount).toBe(2);
    const ownership = result.competencies.find((c) => c.id === 'ownership');
    expect(ownership).toMatchObject({ covered: true, storyCount: 1 });
    const ambiguity = result.competencies.find((c) => c.id === 'ambiguity');
    expect(ambiguity).toMatchObject({ covered: false, storyCount: 0 });
    expect(result.totalStories).toBe(2);
  });

  it('reports every competency missing when the bank is empty', async () => {
    const service = withStories([]);

    const result = await service.getJobStoryGaps('job-1', 'user-1');

    expect(result.totalStories).toBe(0);
    expect(result.coveredCount).toBe(0);
    expect(result.missingCount).toBe(result.competencies.length);
    expect(result.competencies.every((c) => !c.covered)).toBe(true);
  });

  it('throws when the job is not the user\'s', async () => {
    const service = withStories([], null);
    await expect(service.getJobStoryGaps('job-x', 'user-1')).rejects.toThrow();
  });
});
