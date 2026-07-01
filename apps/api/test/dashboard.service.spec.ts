import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from '../src/dashboard/dashboard.service';

describe('DashboardService', () => {
  it('counts distinct practiced questions and ranks weak topics', async () => {
    const prisma = {
      topic: { findMany: vi.fn().mockResolvedValue([
        { id: 'topic-1', name: 'Backend', _count: { questions: 4 } },
        { id: 'topic-2', name: 'Databases', _count: { questions: 2 } },
      ]) },
      answerAttempt: { findMany: vi.fn().mockResolvedValue([
        { questionId: 'q-1', selfRating: 2, question: { topicId: 'topic-1' } },
        { questionId: 'q-1', selfRating: 4, question: { topicId: 'topic-1' } },
        { questionId: 'q-2', selfRating: 1, question: { topicId: 'topic-2' } },
      ]) },
      interviewSession: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([{ id: 'session-1' }]),
      },
    };
    const summary = await new DashboardService(prisma as never).summary('user-1');

    expect(summary.totalQuestionsPracticed).toBe(2);
    expect(summary.totalSessions).toBe(3);
    expect(summary.topicProgress).toEqual([
      expect.objectContaining({ topicId: 'topic-1', attempted: 1, total: 4, percentage: 25 }),
      expect.objectContaining({ topicId: 'topic-2', attempted: 1, total: 2, percentage: 50 }),
    ]);
    expect(summary.weakTopics[0]).toEqual(expect.objectContaining({ topicId: 'topic-2', avgSelfRating: 1 }));
    expect(prisma.answerAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
    expect(prisma.interviewSession.count).toHaveBeenCalledWith({ where: { userId: 'user-1', status: 'completed' } });
  });
});
