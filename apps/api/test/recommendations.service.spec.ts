import { describe, expect, it, vi } from 'vitest';
import { RecommendationsService } from '../src/recommendations/recommendations.service';

// The other sources (missions, tasks, readiness, jobs, inbox) are covered by
// their own services; these tests pin the new weakness-repair source: plan
// §6.1 priority 3, with §6.2-style concrete reasons.

function buildService(weaknessSummary: {
  patterns?: Array<{ key: string; label: string; struggles: number; attempts: number; lastAt: string; questionIds: string[] }>;
  topics?: Array<{ key: string; label: string; struggles: number; attempts: number; lastAt: string; questionIds: string[] }>;
  reasons?: Array<{ reason: string; label: string; count: number; lastAt: string; sampleTitles: string[]; questionIds: string[] }>;
}) {
  const prisma = {
    task: { findMany: vi.fn().mockResolvedValue([]) },
    jobApplication: { findMany: vi.fn().mockResolvedValue([]) },
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
