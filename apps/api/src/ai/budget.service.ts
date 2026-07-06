import { Injectable } from '@nestjs/common';
import { getAiDailyBudgetUsd } from '../common/config';
import { PrismaService } from '../prisma/prisma.service';
import { costUsdFor } from './ai.config';

export interface AiUsageSnapshot {
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  dailyBudgetUsd: number;
  remainingUsd: number;
}

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  async getUsage(userId: string): Promise<AiUsageSnapshot> {
    const day = this.today();
    const dailyBudgetUsd = getAiDailyBudgetUsd();
    const usage = await this.prisma.aiUsage.findUnique({ where: { userId_day: { userId, day } } });
    const costUsd = usage?.costUsd ?? 0;
    return {
      day: day.toISOString().slice(0, 10),
      requests: usage?.requests ?? 0,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      costUsd,
      dailyBudgetUsd,
      remainingUsd: Math.max(0, dailyBudgetUsd - costUsd),
    };
  }

  // The real cost is only known after Claude replies, so this can't reserve
  // an exact dollar amount upfront — record() applies the actual cost
  // afterwards. What it does close is the read-then-write race: reading
  // today's usage via a plain getUsage() call and deciding "allowed" from
  // that snapshot lets two concurrent grade requests both read "under
  // budget" and both proceed, overshooting the budget once both eventually
  // call record(). ensureRow() + this conditional updateMany run as one
  // atomic UPDATE ... WHERE cost_usd < budget statement in Postgres, so a
  // second concurrent call sees the first's (still budget-only, not yet
  // cost-bearing) row change and is correctly refused if the first request
  // already pushed spend over budget by the time it committed.
  async checkAndReserve(userId: string): Promise<{ allowed: boolean; remainingUsd: number }> {
    const day = this.today();
    const dailyBudgetUsd = getAiDailyBudgetUsd();
    await this.ensureRow(userId, day);

    const claimed = await this.prisma.aiUsage.updateMany({
      where: { userId, day, costUsd: { lt: dailyBudgetUsd } },
      // No-op write (+0) — only here so the WHERE clause is evaluated inside
      // a single atomic UPDATE statement rather than a separate read.
      data: { requests: { increment: 0 } },
    });

    const usage = await this.prisma.aiUsage.findUniqueOrThrow({ where: { userId_day: { userId, day } } });
    return { allowed: claimed.count > 0, remainingUsd: Math.max(0, dailyBudgetUsd - usage.costUsd) };
  }

  private async ensureRow(userId: string, day: Date): Promise<void> {
    await this.prisma.aiUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day },
      update: {},
    });
  }

  async record(userId: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
    const day = this.today();
    const costUsd = costUsdFor(model, inputTokens, outputTokens);
    await this.prisma.aiUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, requests: 1, inputTokens, outputTokens, costUsd },
      update: {
        requests: { increment: 1 },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        costUsd: { increment: costUsd },
      },
    });
  }
}
