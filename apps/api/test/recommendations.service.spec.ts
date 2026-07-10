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
    openSignals?: Array<Record<string, unknown>>;
  },
  jobs: Array<Record<string, unknown>> = [],
  upcomingRounds: Array<Record<string, unknown>> = [],
) {
  const prisma = {
    task: { findMany: vi.fn().mockResolvedValue([]) },
    jobApplication: { findMany: vi.fn().mockResolvedValue(jobs) },
    learningHighlight: { count: vi.fn().mockResolvedValue(0) },
    interviewRound: { findMany: vi.fn().mockResolvedValue(upcomingRounds) },
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
      openSignals: weaknessSummary.openSignals ?? [],
    }),
  };
  return new RecommendationsService(prisma as never, career as never, missions as never, weaknesses as never);
}

function openSignal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sig-1',
    signalType: 'area',
    key: 'system_design',
    label: 'System design — weak at Meta',
    roleTrackId: null,
    area: 'system_design',
    jobApplicationId: 'job-1',
    severity: 1,
    occurrences: 1,
    source: 'debrief',
    status: 'open',
    lastSignalAt: '2026-07-09T00:00:00.000Z',
    ...overrides,
  };
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

function round(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const daysAhead = (overrides.daysAhead as number | undefined) ?? 3;
  const scheduledAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  delete overrides.daysAhead;
  return {
    id: 'round-1',
    roundType: 'system_design',
    scheduledAt,
    jobApplicationId: 'job-1',
    jobApplication: { id: 'job-1', company: 'Meta' },
    ...overrides,
  };
}

describe('RecommendationsService — interview countdown (MOM-141)', () => {
  it('surfaces an upcoming round as the top-ranked Today card, scaling by proximity', async () => {
    const service = buildService({}, [], [round({ daysAhead: 3 })]);

    const recommendations = await service.list('user-1');

    const card = recommendations.find((item) => item.id === 'round:round-1');
    expect(card).toBeDefined();
    expect(card).toMatchObject({
      type: 'job',
      title: 'Prep your Meta System design in 3 days',
      targetHref: '/jobs/job-1',
    });
    // 101 + (14 - 3) = 112 — above overdue tasks (100).
    expect(card?.priority).toBe(112);
    expect(card?.reason).toBe('Your System design round is in 3 days — build your prep queue now.');
  });

  it('reads "tomorrow"/"today" and ranks a nearer round higher', async () => {
    const tomorrow = (await buildService({}, [], [round({ daysAhead: 1 })]).list('user-1')).find(
      (item) => item.id === 'round:round-1',
    );
    expect(tomorrow?.title).toBe('Prep your Meta System design tomorrow');
    expect(tomorrow?.priority).toBe(114); // 101 + (14 - 1)
    expect(tomorrow?.reason).toBe('Your System design round is tomorrow — lock in your prep.');
  });
});

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

describe('RecommendationsService — open weakness signals (MOM-142)', () => {
  it('surfaces a debrief-emitted area signal as a ranked repair card', async () => {
    const service = buildService({ openSignals: [openSignal({ severity: 2 })] });

    const recommendations = await service.list('user-1');

    const card = recommendations.find((item) => item.id === 'signal:area:system_design:job-1');
    expect(card).toBeDefined();
    expect(card).toMatchObject({
      type: 'practice',
      title: 'Repair: System design — weak at Meta',
      area: 'system_design',
      targetHref: '/practice/new?area=system_design&mode=weak_area_review',
    });
    // 94 + round(severity 2) = 96 — above derived weakness (95), below tasks (100).
    expect(card?.priority).toBe(96);
    expect(card?.reason).toBe('An interview debrief flagged this weakness.');
  });

  it('ranks a severe recurring signal higher and names the occurrence count', async () => {
    const service = buildService({ openSignals: [openSignal({ severity: 9, occurrences: 3 })] });
    const card = (await service.list('user-1')).find((item) => item.id.startsWith('signal:'));
    expect(card?.priority).toBe(99); // capped at 94 + 5
    expect(card?.reason).toBe('An interview debrief flagged this weakness (flagged 3×).');
  });

  it('does not double-count: a stored reason signal suppresses the derived reason card', async () => {
    const service = buildService({
      reasons: [{ reason: 'time_pressure', label: 'Ran out of time', count: 4, lastAt: '2026-07-05', sampleTitles: [], questionIds: [] }],
      openSignals: [openSignal({ id: 'sig-r', signalType: 'reason', key: 'time_pressure', area: null, label: 'Ran out of time — System design at Meta', jobApplicationId: 'job-1' })],
    });

    const recommendations = await service.list('user-1');

    expect(recommendations.some((item) => item.id === 'signal:reason:time_pressure:job-1')).toBe(true);
    expect(recommendations.some((item) => item.id === 'weakness:reason:time_pressure')).toBe(false);
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

describe('RecommendationsService — stall detection (MOM-105)', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  it('replaces the stage card with a follow-up nudge once an app stalls past its threshold', async () => {
    // applied threshold = 21 days; entered 25 days ago.
    const service = buildService({}, [
      job({ status: 'applied', createdAt: daysAgo(25), events: [{ eventAt: daysAgo(25) }] }),
    ]);

    const recs = await service.list('user-1');
    const stall = recs.find((item) => item.id === 'job-stall:job-1');
    expect(stall).toMatchObject({ type: 'job', title: 'Follow up on Meta — 25d in applied', priority: 68, targetHref: '/jobs/job-1' });
    expect(stall?.reason).toBe('This application has sat in applied for 25 days without moving. Follow up or mark it no-response.');
    // The generic stage card is superseded, not duplicated.
    expect(recs.some((item) => item.id === 'job:job-1')).toBe(false);
  });

  it('leaves a within-threshold app on its normal stage card', async () => {
    const service = buildService({}, [job({ status: 'applied', createdAt: daysAgo(5), events: [] })]);
    const recs = await service.list('user-1');
    expect(recs.some((item) => item.id === 'job-stall:job-1')).toBe(false);
    expect(recs.some((item) => item.id === 'job:job-1')).toBe(true);
  });
});
