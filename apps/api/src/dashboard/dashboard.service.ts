import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const [topics, attempts, totalSessions, recentSessions] = await Promise.all([
      this.prisma.topic.findMany({
        include: { _count: { select: { questions: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.answerAttempt.findMany({
        where: { userId },
        select: { questionId: true, selfRating: true, question: { select: { topicId: true } } },
      }),
      this.prisma.interviewSession.count({ where: { userId, status: 'completed' } }),
      this.prisma.interviewSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
    ]);

    const attemptedQuestions = new Set(attempts.map(({ questionId }) => questionId));
    const attemptedByTopic = new Map<string, Set<string>>();
    const ratingsByTopic = new Map<string, number[]>();
    for (const attempt of attempts) {
      const topicId = attempt.question.topicId;
      const topicQuestions = attemptedByTopic.get(topicId) ?? new Set<string>();
      topicQuestions.add(attempt.questionId);
      attemptedByTopic.set(topicId, topicQuestions);
      if (attempt.selfRating !== null) {
        const ratings = ratingsByTopic.get(topicId) ?? [];
        ratings.push(attempt.selfRating);
        ratingsByTopic.set(topicId, ratings);
      }
    }

    const topicProgress = topics.map(({ _count, ...topic }) => {
      const attempted = attemptedByTopic.get(topic.id)?.size ?? 0;
      return {
        topicId: topic.id,
        topicName: topic.name,
        attempted,
        total: _count.questions,
        percentage: _count.questions === 0 ? 0 : Math.round((attempted / _count.questions) * 100),
      };
    });
    const topicNames = new Map(topics.map((topic) => [topic.id, topic.name]));
    const weakTopics = [...ratingsByTopic.entries()]
      .map(([topicId, ratings]) => ({
        topicId,
        topicName: topicNames.get(topicId) ?? 'Unknown topic',
        avgSelfRating: Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(2)),
      }))
      .sort((left, right) => left.avgSelfRating - right.avgSelfRating)
      .slice(0, 5);
    const progressByTopic = new Map(topicProgress.map((progress) => [progress.topicId, progress.percentage]));
    const weakRank = new Map(weakTopics.map((topic, index) => [topic.topicId, index]));
    const suggestedNextTopics = topics
      .filter(({ _count }) => _count.questions > 0)
      .sort((left, right) => {
        const leftWeak = weakRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightWeak = weakRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftWeak - rightWeak || (progressByTopic.get(left.id) ?? 0) - (progressByTopic.get(right.id) ?? 0) || left.name.localeCompare(right.name);
      })
      .slice(0, 3)
      .map(({ id, name }) => ({ id, name }));

    return {
      totalQuestionsPracticed: attemptedQuestions.size,
      totalSessions,
      topicProgress,
      recentSessions,
      weakTopics,
      suggestedNextTopics,
    };
  }
}
