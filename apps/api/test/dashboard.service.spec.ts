import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from '../src/dashboard/dashboard.service';

describe('DashboardService', () => {
  it('counts distinct practiced questions and ranks weak topics', async () => {
    const prisma = {
      topic: { findMany: vi.fn().mockResolvedValue([
        { id: 'topic-1', name: 'Backend', _count: { questions: 4 } },
        { id: 'topic-2', name: 'Databases', _count: { questions: 2 } },
      ]) },
      answerAttempt: { findMany: vi.fn()
        .mockResolvedValueOnce([
          { questionId: 'q-1', selfRating: 2, question: { topicId: 'topic-1' } },
          { questionId: 'q-1', selfRating: 4, question: { topicId: 'topic-1' } },
          { questionId: 'q-2', selfRating: 1, question: { topicId: 'topic-2' } },
        ])
        .mockResolvedValueOnce([]) },
      interviewSession: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([{ id: 'session-1' }]),
      },
    };
    const summary = await new DashboardService(prisma as never).summary('user-1');

    expect(summary.totalQuestionsPracticed).toBe(2);
    expect(summary.totalSessions).toBe(3);
    expect(summary.streak).toBe(0);
    expect(summary.topicProgress).toEqual([
      expect.objectContaining({ topicId: 'topic-1', attempted: 1, total: 4, percentage: 25 }),
      expect.objectContaining({ topicId: 'topic-2', attempted: 1, total: 2, percentage: 50 }),
    ]);
    expect(summary.weakTopics[0]).toEqual(expect.objectContaining({ topicId: 'topic-2', avgSelfRating: 1 }));
    expect(prisma.answerAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
    expect(prisma.interviewSession.count).toHaveBeenCalledWith({ where: { userId: 'user-1', status: 'completed' } });
  });

  it('computes a consecutive-day streak that survives today having no attempt yet', async () => {
    const service = new DashboardService({} as never);
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    // Attempts on "today", "yesterday", and "the day before" (3-day streak),
    // then a gap, then one more day 10 days ago (should NOT extend the streak).
    const timestamps = [
      new Date(now),
      new Date(now - dayMs),
      new Date(now - 2 * dayMs),
      new Date(now - 10 * dayMs),
    ];

    // computeStreak is private; access via bracket notation for this focused unit test.
    const streak = (service as unknown as { computeStreak: (dates: Date[]) => number }).computeStreak(timestamps);

    expect(streak).toBe(3);
  });

  it('does not break the streak when today has no attempt yet, but breaks after a full missed day', async () => {
    const service = new DashboardService({} as never);
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const streakIncludingYesterday = (service as unknown as { computeStreak: (dates: Date[]) => number }).computeStreak([
      new Date(now - dayMs),
      new Date(now - 2 * dayMs),
    ]);
    expect(streakIncludingYesterday).toBe(2);

    const brokenStreak = (service as unknown as { computeStreak: (dates: Date[]) => number }).computeStreak([
      new Date(now - 2 * dayMs),
    ]);
    expect(brokenStreak).toBe(0);
  });

  it('returns 0 streak with no attempts', () => {
    const service = new DashboardService({} as never);
    const streak = (service as unknown as { computeStreak: (dates: Date[]) => number }).computeStreak([]);
    expect(streak).toBe(0);
  });
});
