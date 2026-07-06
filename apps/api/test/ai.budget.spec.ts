import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetService } from '../src/ai/budget.service';

describe('BudgetService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the full daily budget as remaining with no usage yet', async () => {
    vi.stubEnv('AI_DAILY_BUDGET_USD', '1.00');
    const prisma = { aiUsage: { findUnique: vi.fn().mockResolvedValue(null) } };
    const usage = await new BudgetService(prisma as never).getUsage('user-1');

    expect(usage.costUsd).toBe(0);
    expect(usage.dailyBudgetUsd).toBe(1.0);
    expect(usage.remainingUsd).toBe(1.0);
  });

  it('allows grading while under budget and refuses once spend meets the limit', async () => {
    vi.stubEnv('AI_DAILY_BUDGET_USD', '1.00');

    const underBudget = {
      aiUsage: {
        upsert: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ costUsd: 0.5 }),
      },
    };
    const { allowed, remainingUsd } = await new BudgetService(underBudget as never).checkAndReserve('user-1');
    expect(allowed).toBe(true);
    expect(remainingUsd).toBeCloseTo(0.5);
    // The conditional gate must be evaluated inside the UPDATE's WHERE, not a
    // separate read — this is what closes the check-then-write race.
    expect(underBudget.aiUsage.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', day: expect.any(Date), costUsd: { lt: 1.0 } },
      data: { requests: { increment: 0 } },
    });

    const overBudget = {
      aiUsage: {
        upsert: vi.fn().mockResolvedValue({}),
        // The conditional UPDATE's WHERE (cost_usd < budget) does not match
        // once spend has already met the limit, so no row is touched.
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ costUsd: 1.0 }),
      },
    };
    const result = await new BudgetService(overBudget as never).checkAndReserve('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remainingUsd).toBe(0);
  });

  it('creates today\'s usage row before the conditional check so a first-ever call is allowed', async () => {
    vi.stubEnv('AI_DAILY_BUDGET_USD', '1.00');
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      aiUsage: {
        upsert,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ costUsd: 0 }),
      },
    };

    const { allowed } = await new BudgetService(prisma as never).checkAndReserve('user-1');

    expect(allowed).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where.userId_day.userId).toBe('user-1');
    expect(call.create).toEqual({ userId: 'user-1', day: expect.any(Date) });
  });

  it('records usage with a cost computed from the model price table', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = { aiUsage: { upsert } };

    await new BudgetService(prisma as never).record('user-1', 'claude-opus-4-8', 1_000_000, 1_000_000);

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where.userId_day.userId).toBe('user-1');
    expect(call.create.costUsd).toBeCloseTo(30); // $5 + $25 per 1M tokens
    expect(call.update.costUsd.increment).toBeCloseTo(30);
  });
});
