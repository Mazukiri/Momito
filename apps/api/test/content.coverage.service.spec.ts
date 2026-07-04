import { describe, expect, it, vi } from 'vitest';
import { ContentService } from '../src/content/content.service';

describe('ContentService.coverage', () => {
  it('aggregates counts by type/difficulty and computes domain progress', async () => {
    const prisma = {
      question: {
        groupBy: vi.fn().mockImplementation(({ by }) => {
          if (by[0] === 'type') {
            return [
              { type: 'dsa', _count: { _all: 149 } },
              { type: 'behavioral', _count: { _all: 60 } },
              { type: 'backend', _count: { _all: 12 } },
            ];
          }
          return [
            { difficulty: 'easy', _count: { _all: 10 } },
            { difficulty: 'medium', _count: { _all: 20 } },
          ];
        }),
        count: vi.fn().mockResolvedValue(221),
      },
      company: { count: vi.fn().mockResolvedValue(20) },
    };
    const service = new ContentService(prisma as never);

    const result = await service.coverage();

    expect(result.totalQuestions).toBe(221);
    expect(result.byType).toEqual({ dsa: 149, behavioral: 60, backend: 12 });
    expect(result.byDifficulty).toEqual({ easy: 10, medium: 20 });
    expect(result.companyCount).toBe(20);
    expect(result.roleTrackCount).toBeGreaterThanOrEqual(8);

    const dsaDomain = result.domains.find((d) => d.label === 'dsa');
    expect(dsaDomain).toEqual({ label: 'dsa', count: 149, target: 150, percentage: 99 });

    const behavioralDomain = result.domains.find((d) => d.label === 'behavioral');
    expect(behavioralDomain).toEqual({ label: 'behavioral', count: 60, target: 60, percentage: 100 });

    const csFundamentalsDomain = result.domains.find((d) => d.label === 'cs fundamentals');
    expect(csFundamentalsDomain?.count).toBe(12);
  });

  it('caps percentage at 100 even if a domain exceeds its target', async () => {
    const prisma = {
      question: {
        groupBy: vi.fn().mockReturnValue([{ type: 'behavioral', _count: { _all: 999 } }]),
        count: vi.fn().mockResolvedValue(999),
      },
      company: { count: vi.fn().mockResolvedValue(0) },
    };
    const service = new ContentService(prisma as never);

    const result = await service.coverage();
    const behavioralDomain = result.domains.find((d) => d.label === 'behavioral');

    expect(behavioralDomain?.percentage).toBe(100);
  });
});
