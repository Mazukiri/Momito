import { Injectable } from '@nestjs/common';
import { Reminder, Task } from '@prisma/client';
import { ReminderResponse, TaskResponse } from '@momito/shared';
import { CareerService } from '../career/career.service';
import { DEFAULT_TIME_ZONE, consecutiveDayStreak } from '../common/date-key';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly career?: CareerService,
    private readonly recommendations?: RecommendationsService,
  ) {}

  async summary(userId: string) {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const taskClient = (this.prisma as PrismaService & { task?: { findMany: (args: unknown) => Promise<Task[]> } }).task;
    const reminderClient = (this.prisma as PrismaService & { reminder?: { findMany: (args: unknown) => Promise<Reminder[]> } }).reminder;
    const [topics, attempts, attemptDates, totalSessions, recentSessions, activeGoals, roleReadiness, dueTasks, reminders, recommendations] = await Promise.all([
      this.prisma.topic.findMany({
        include: { _count: { select: { questions: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.answerAttempt.findMany({
        where: { userId },
        select: { questionId: true, selfRating: true, question: { select: { topicId: true } } },
      }),
      this.prisma.answerAttempt.findMany({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
      this.prisma.interviewSession.count({ where: { userId, status: 'completed' } }),
      this.prisma.interviewSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
      this.career ? this.career.listGoals(userId).then((goals) => goals.filter((goal) => goal.status === 'active')) : Promise.resolve([]),
      this.career ? this.career.listActiveReadiness(userId) : Promise.resolve([]),
      taskClient ? taskClient.findMany({
        where: {
          userId,
          status: { not: 'done' },
          OR: [{ dueDate: { lte: weekAhead } }, { plannedFor: { lte: weekAhead } }],
        },
        orderBy: [{ dueDate: 'asc' }, { plannedFor: 'asc' }],
        take: 8,
      }) : Promise.resolve([]),
      reminderClient ? reminderClient.findMany({
        where: { userId, status: 'pending', dueAt: { lte: weekAhead } },
        orderBy: { dueAt: 'asc' },
        take: 8,
      }) : Promise.resolve([]),
      this.recommendations ? this.recommendations.list(userId) : Promise.resolve([]),
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
      streak: this.computeStreak(attemptDates.map((a) => a.createdAt)),
      topicProgress,
      recentSessions,
      weakTopics,
      suggestedNextTopics,
      activeGoals,
      roleReadiness,
      dueTasks: dueTasks.map((task) => this.serializeTask(task)),
      reminders: reminders.map((reminder) => this.serializeReminder(reminder)),
      recommendations,
    };
  }

  // A3: consecutive-day study streak. MOM-172 moved the day-key arithmetic to
  // common/date-key.ts so the V2 daily plan resolves "today" the same way this does
  // — behavior here is unchanged (same tz default, same grace for a day with no
  // attempt yet).
  private computeStreak(attemptTimestamps: Date[], timeZone = DEFAULT_TIME_ZONE): number {
    return consecutiveDayStreak(attemptTimestamps, timeZone);
  }

  private serializeTask(task: Task): TaskResponse {
    return {
      id: task.id,
      userId: task.userId,
      title: task.title,
      notes: task.notes,
      type: task.type as TaskResponse['type'],
      status: task.status as TaskResponse['status'],
      priority: task.priority as TaskResponse['priority'],
      roleTrackId: task.roleTrackId as TaskResponse['roleTrackId'],
      area: task.area as TaskResponse['area'],
      topicId: task.topicId,
      jobApplicationId: task.jobApplicationId,
      missionId: task.missionId,
      plannedFor: task.plannedFor?.toISOString() ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
      recurrence: task.recurrence,
      reminderOffsetMinutes: task.reminderOffsetMinutes,
      completedAt: task.completedAt?.toISOString() ?? null,
      snoozedUntil: task.snoozedUntil?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private serializeReminder(reminder: Reminder): ReminderResponse {
    return {
      id: reminder.id,
      userId: reminder.userId,
      taskId: reminder.taskId,
      jobApplicationId: reminder.jobApplicationId,
      type: reminder.type,
      title: reminder.title,
      dueAt: reminder.dueAt.toISOString(),
      status: reminder.status as ReminderResponse['status'],
      lastTriggeredAt: reminder.lastTriggeredAt?.toISOString() ?? null,
      dismissedAt: reminder.dismissedAt?.toISOString() ?? null,
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    };
  }
}
