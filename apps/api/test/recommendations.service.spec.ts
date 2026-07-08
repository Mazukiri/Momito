import { describe, expect, it, vi } from 'vitest';
import { RecommendationsService } from '../src/recommendations/recommendations.service';

// The other sources (missions, tasks, readiness, jobs, inbox) are covered by
// their own services; these tests pin the new weakness-repair source: plan
// §6.1 priority 3, with §6.2-style concrete reasons.

function buildService(
  weaknessSummary: {
    patterns?: Array<{ key: string; label: string; struggles: number; attempts: number; lastAt: string; questionIds: string[] }>;
    topics?: Array<{ key: string; label: string; struggles: number; attempts: number; lastAt: string; questionIds: string[] }>;
    reasons?: Array<{ reason: string; label: string; count: number; lastAt: string; sampleTitles: string[]; questionIds: string[] }>;
  },
  jobs: Array<Record<string, unknown>> = [],
) {
  const prisma = {
    task: { findMany: vi.fn().mockResolvedValue([]) },
    jobApplication: { findMany: vi.fn().mockResolvedValue(jobs) },
    learningHighlight: { count: vi.fn().mockResolvedValue(0) },
  };
  const career = { listActiveReadiness: vi.fn().mockResolvedValue([]) };
  const missions = { list: vi.fn().mockResolvedValue([]) };
  const weaknesses = {
    summary: vi.fn().mockResolvedValue({
      windowDays: 30,
      totalAttempts: 10,
      totalStruggles: 4,
      reasons: weaknessSummary.reasons ?? [],
      patterns: weaknessSummary.patterns ?? [],
      topics: weaknessSummary.topics ?? [],
    }),
  };
  return new RecommendationsService(prisma as never, career as never, missions as never, weaknesses as never);
}

function job(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'job-1',
    company: 'Meta',
    roleTitle: 'E5 SWE',
    status: 'saved',
    deadline: null,
    roleTrackId: 'big-tech-swe',
    ...overrides,
  };
}

describe('RecommendationsService — weakness repair', () => {
  it('recommends repairing an area with repeated struggles, naming the count', async () => {
    const service = buildService({
      patterns: [
        { key: 'sliding-window', label: 'sliding-window', struggles: 3, attempts: 5, lastAt: '2026-07-05', questionIds: [] },
      ],
    });

    const recommendations = await service.list('user-1');

    const weakness = recommendations.find((item) => item.id === 'weakness:area:sliding-window');
    expect(weakness).toBeDefined();
    expect(weakness).toMatchObject({
      type: 'practice',
      priority: 95,
      targetHref: '/practice/new?mode=weak_area_review',
    });
    expect(weakness?.reason).toBe('You struggled with 3 sliding-window questions recently.');
  });

  it('ignores single-struggle noise but still surfaces a repeated miss reason with no area', async () => {
    const service = buildService({
      patterns: [
        { key: 'graphs', label: 'graphs', struggles: 1, attempts: 2, lastAt: '2026-07-05', questionIds: [] },
      ],
      reasons: [
        { reason: 'time_pressure', label: 'Ran out of time', count: 3, lastAt: '2026-07-05', sampleTitles: [], questionIds: [] },
      ],
    });

    const recommendations = await service.list('user-1');

    expect(recommendations.find((item) => item.id === 'weakness:area:graphs')).toBeUndefined();
    const reason = recommendations.find((item) => item.id === 'weakness:reason:time_pressure');
    expect(reason?.reason).toBe('You logged "Ran out of time" on 3 recent attempts.');
  });

  it('adds no weakness recommendation when there are no repeated signals', async () => {
    const service = buildService({});
    const recommendations = await service.list('user-1');
    expect(recommendations.some((item) => item.id.startsWith('weakness:'))).toBe(false);
  });
});

describe('RecommendationsService — stage-aware job cards (MOM-140-lite)', () => {
  it('gives an onsite the sharp-end copy and outranks a saved lead', async () => {
    const service = buildService({}, [job({ status: 'onsite' })]);
    const card = (await service.list('user-1')).find((item) => item.id === 'job:job-1');
    expect(card).toMatchObject({
      type: 'job',
      title: 'Prep for your Meta onsite',
      priority: 92,
    });
    expect(card?.reason).toBe('You have an onsite for this role — the sharp end of the pipeline.');
  });

  it('reads "apply" for a saved lead and surfaces the deadline when one is set', async () => {
    const withDeadline = buildService({}, [job({ status: 'saved', deadline: new Date('2026-08-01') })]);
    const withoutDeadline = buildService({}, [job({ status: 'saved', deadline: null })]);

    const urgent = (await withDeadline.list('user-1')).find((item) => item.id === 'job:job-1');
    expect(urgent).toMatchObject({ title: 'Apply to Meta — E5 SWE', priority: 90 });
    expect(urgent?.reason).toBe('This job application has an upcoming deadline.');

    const calm = (await withoutDeadline.list('user-1')).find((item) => item.id === 'job:job-1');
    expect(calm).toMatchObject({ priority: 55 });
    expect(calm?.reason).toBe('You saved this role but have not applied yet.');
  });

  it('does not treat a post-application deadline as apply-by urgency', async () => {
    // Once applied, the application deadline is moot; the stage governs ranking.
    const service = buildService({}, [job({ status: 'interview', deadline: new Date('2026-08-01') })]);
    const card = (await service.list('user-1')).find((item) => item.id === 'job:job-1');
    expect(card).toMatchObject({ title: 'Prep for your Meta interview', priority: 88 });
    expect(card?.reason).toBe('You are actively interviewing here.');
  });
});
