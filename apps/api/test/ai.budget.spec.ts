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
    const underBudget = { aiUsage: { findUnique: vi.fn().mockResolvedValue({ costUsd: 0.5, requests: 3, inputTokens: 100, outputTokens: 100 }) } };
    const { allowed, remainingUsd } = await new BudgetService(underBudget as never).checkAndReserve('user-1');
    expect(allowed).toBe(true);
    expect(remainingUsd).toBeCloseTo(0.5);

    const overBudget = { aiUsage: { findUnique: vi.fn().mockResolvedValue({ costUsd: 1.0, requests: 5, inputTokens: 100, outputTokens: 100 }) } };
    const result = await new BudgetService(overBudget as never).checkAndReserve('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remainingUsd).toBe(0);
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
