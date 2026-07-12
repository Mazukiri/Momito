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
    company: { findMany: vi.fn().mockResolvedValue([]) },
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

  it('weights the verdict by the linked company\'s focus areas (MOM-122-followup)', async () => {
    // dsa strong (mastery .9 → pct 45), behavioral weak (.2 → pct 10); empty
    // evidence context means coverage 0, so pct = round(0.5*mastery*100).
    const mastery = new Map<string, unknown>([
      ['dsa', { area: 'dsa', retrievability: 0.9, reviewedCount: 3, gradedAttempts: 5, positiveAttempts: 5, score: 0.9 }],
      ['behavioral', { area: 'behavioral', retrievability: 0.2, reviewedCount: 2, gradedAttempts: 3, positiveAttempts: 1, score: 0.2 }],
    ]);
    const linkedJob = { ...job, roleTrackId: 'big-tech-swe', companyRef: { focusAreas: { dsa: 5, behavioral: 1 }, roleTrackIds: ['big-tech-swe'] } };
    const service = buildService(mastery, {
      prisma: { jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(linkedJob) } },
    });

    const verdict = await service.getJobReadiness('job-1', 'user-1');

    // company-weighted = round((45*5 + 10*1)/6) = 39; no signals → score 39.
    expect(verdict.score).toBe(39);
    // dsa drags hardest for this company (5*(100-45)=275 > behavioral 1*(100-10)=90).
    expect(verdict.weakestAreas[0].area).toBe('dsa');
  });

  // MOM-158 — a company's focusAreas is validated against CAREER_ROLE_AREA_IDS but NOT against
  // the chosen role track's areas, so the two can be disjoint. Weighting over an empty
  // intersection used to return 0 — reporting a strong candidate as "0/100, not ready".
  it('falls back to the flat mean when the company\'s focus areas miss the role track entirely (MOM-158)', async () => {
    const mastery = new Map<string, unknown>([
      ['dsa', { area: 'dsa', retrievability: 0.9, reviewedCount: 3, gradedAttempts: 5, positiveAttempts: 5, score: 0.9 }],
      ['system_design', { area: 'system_design', retrievability: 0.9, reviewedCount: 3, gradedAttempts: 5, positiveAttempts: 5, score: 0.9 }],
    ]);
    // cs_fundamentals is a valid area but NOT in the big-tech-swe track → zero intersection.
    const disjointJob = { ...job, roleTrackId: 'big-tech-swe', companyRef: { focusAreas: { cs_fundamentals: 5 }, roleTrackIds: ['big-tech-swe'] } };
    const service = buildService(mastery, {
      prisma: { jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(disjointJob) } },
    });

    const verdict = await service.getJobReadiness('job-1', 'user-1');

    // NOT 0: the verdict is the flat overall percentage, and a genuinely strong candidate reads as such.
    const flat = await buildService(mastery).getReadiness('big-tech-swe', 'user-1');
    expect(verdict.score).toBe(flat.overallPercentage);
    expect(verdict.score).toBeGreaterThan(0);
    // weakestAreas fall back to lowest-percentage ordering, not the all-zero focusDrag no-op.
    expect(verdict.weakestAreas.length).toBeGreaterThan(0);
  });
});

describe('CareerService.getTargetShortlist — targeting shortlist (MOM-125)', () => {
  // dsa strong (score .9 → pct 45 with empty coverage), system_design weak (.2 → 10).
  const mastery = () =>
    new Map<string, unknown>([
      ['dsa', { area: 'dsa', retrievability: 0.9, reviewedCount: 3, gradedAttempts: 5, positiveAttempts: 5, score: 0.9 }],
      ['system_design', { area: 'system_design', retrievability: 0.2, reviewedCount: 2, gradedAttempts: 3, positiveAttempts: 1, score: 0.2 }],
    ]);

  function company(over: Record<string, unknown>) {
    return { id: over.name as string, name: 'X', region: 'Global', focusAreas: {}, roleTrackIds: ['big-tech-swe'], sponsorshipStatus: 'sponsored', ...over };
  }

  it('ranks by focus-weighted fit × sponsorship, scaling non-sponsors down and skipping focus-less companies', async () => {
    const service = buildService(mastery(), {
      prisma: {
        company: {
          findMany: vi.fn().mockResolvedValue([
            company({ name: 'Alpha', focusAreas: { dsa: 5, system_design: 1 }, sponsorshipStatus: 'sponsored' }),
            company({ name: 'Beta', focusAreas: { dsa: 5, system_design: 1 }, sponsorshipStatus: 'not_sponsoring' }),
            company({ name: 'Gamma', focusAreas: {} }), // no emphasis → not scorable
          ]),
        },
        jobApplication: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      },
    });

    const result = await service.getTargetShortlist('user-1');

    // Gamma dropped; Alpha (sponsored) outranks Beta (not sponsoring) on the same fit.
    expect(result.items.map((item) => item.name)).toEqual(['Alpha', 'Beta']);
    // fit = round((45*5 + 10*1)/6) = 39.
    expect(result.items[0]).toMatchObject({ name: 'Alpha', fitScore: 39, sponsorshipMultiplier: 1, score: 39 });
    expect(result.items[1]).toMatchObject({ name: 'Beta', fitScore: 39, sponsorshipMultiplier: 0.2, score: 8 });
    // Top focus area carries the company weight and the user's readiness in it.
    expect(result.items[0].topFocusAreas[0]).toEqual({ area: 'dsa', weight: 5, percentage: 45 });
    expect(result.preferredRegions).toEqual([]);
  });

  it('demerits an off-target region only once the pipeline reveals a preference', async () => {
    const service = buildService(mastery(), {
      prisma: {
        company: {
          findMany: vi.fn().mockResolvedValue([
            company({ name: 'USorg', region: 'US', focusAreas: { dsa: 5 } }),
            company({ name: 'EUorg', region: 'EU', focusAreas: { dsa: 5 } }),
          ]),
        },
        // An existing linked job in the US makes 'us' the preferred region.
        jobApplication: { findMany: vi.fn().mockResolvedValue([{ companyRef: { region: 'US' } }]), findFirst: vi.fn().mockResolvedValue(null) },
      },
    });

    const result = await service.getTargetShortlist('user-1');

    expect(result.preferredRegions).toEqual(['us']);
    const us = result.items.find((item) => item.name === 'USorg')!;
    const eu = result.items.find((item) => item.name === 'EUorg')!;
    expect(us.regionMultiplier).toBe(1);
    expect(eu.regionMultiplier).toBe(0.85);
    // Same fit (45), EU discounted → US ranks first.
    expect(result.items[0].name).toBe('USorg');
    expect(us.score).toBe(45);
    expect(eu.score).toBe(38); // round(45 * 0.85)
  });
});

describe('CareerService.getJobStoryGaps — company role-track fallback (MOM-122-followup)', () => {
  it('uses the linked company\'s primary track when the job has no explicit roleTrack', async () => {
    const service = buildService(new Map(), {
      prisma: {
        jobApplication: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue({ id: 'job-1', company: 'Two Sigma', roleTitle: 'Quant Dev', roleTrackId: null, companyRef: { roleTrackIds: ['quant-swe'] } }),
        },
        story: { findMany: vi.fn().mockResolvedValue([]) },
      },
    });

    const result = await service.getJobStoryGaps('job-1', 'user-1');

    expect(result.roleTrackId).toBe('quant-swe');
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

// MOM-169: readiness for several role tracks in one request must scan the heavy per-user
// areaMastery ONCE, not once per track.
describe('CareerService.listActiveReadiness — shared mastery (MOM-169)', () => {
  it('computes areaMastery once across multiple active goals, not once per goal', async () => {
    const areaMastery = vi.fn().mockResolvedValue(new Map());
    const prisma = {
      careerGoal: {
        findMany: vi.fn().mockResolvedValue([
          { roleTrackId: 'big-tech-swe' },
          { roleTrackId: 'google-l4-swe' },
          { roleTrackId: 'quant-swe' },
        ]),
      },
      profile: { findUnique: vi.fn().mockResolvedValue(null) },
      answerAttempt: { findMany: vi.fn().mockResolvedValue([]) },
      learningEvidence: { findMany: vi.fn().mockResolvedValue([]) },
      learningHighlight: { findMany: vi.fn().mockResolvedValue([]) },
      jobApplication: { findMany: vi.fn().mockResolvedValue([]) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const readiness = { isPositiveAttempt: () => true, areaMastery };
    const weaknesses = { listOpenSignals: vi.fn().mockResolvedValue([]) };
    const service = new CareerService(prisma as never, readiness as never, weaknesses as never);

    const result = await service.listActiveReadiness('user-1');

    expect(result).toHaveLength(3);
    expect(areaMastery).toHaveBeenCalledTimes(1); // once per goal before MOM-169
  });
});
