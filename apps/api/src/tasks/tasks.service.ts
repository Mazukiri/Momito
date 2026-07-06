import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Reminder, Task } from '@prisma/client';
import { ReminderResponse, TaskResponse } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { SnoozeTaskDto } from './dto/snooze-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskInclude = {
  topic: { select: { id: true, name: true } },
  jobApplication: { select: { id: true, company: true, roleTitle: true, status: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTasksDto, userId: string): Promise<TaskResponse[]> {
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      ...(query.roleTrackId && { roleTrackId: query.roleTrackId }),
      ...(query.missionId && { missionId: query.missionId }),
      ...this.rangeWhere(query.range),
    };
    const tasks = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { plannedFor: 'asc' }, { createdAt: 'desc' }],
    });
    return tasks.map((task) => this.serializeTask(task));
  }

  async create(dto: CreateTaskDto, userId: string): Promise<TaskResponse> {
    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title.trim(),
        notes: this.cleanNullable(dto.notes),
        type: dto.type ?? 'study',
        status: dto.status ?? 'todo',
        priority: dto.priority ?? 'medium',
        roleTrackId: dto.roleTrackId ?? null,
        area: dto.area ?? null,
        topicId: dto.topicId ?? null,
        jobApplicationId: dto.jobApplicationId ?? null,
        missionId: dto.missionId ?? null,
        plannedFor: this.parseDateTime(dto.plannedFor),
        dueDate: this.parseDateTime(dto.dueDate),
        recurrence: this.cleanNullable(dto.recurrence),
        reminderOffsetMinutes: dto.reminderOffsetMinutes ?? null,
      },
      include: taskInclude,
    });
    await this.createReminderForTask(task);
    return this.serializeTask(task);
  }

  async update(id: string, dto: UpdateTaskDto, userId: string): Promise<TaskResponse> {
    const result = await this.prisma.task.updateMany({
      where: { id, userId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.notes !== undefined && { notes: this.cleanNullable(dto.notes) }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.roleTrackId !== undefined && { roleTrackId: dto.roleTrackId }),
        ...(dto.area !== undefined && { area: dto.area }),
        ...(dto.topicId !== undefined && { topicId: dto.topicId }),
        ...(dto.jobApplicationId !== undefined && { jobApplicationId: dto.jobApplicationId }),
        ...(dto.missionId !== undefined && { missionId: dto.missionId }),
        ...(dto.plannedFor !== undefined && { plannedFor: this.parseDateTime(dto.plannedFor) }),
        ...(dto.dueDate !== undefined && { dueDate: this.parseDateTime(dto.dueDate) }),
        ...(dto.recurrence !== undefined && { recurrence: this.cleanNullable(dto.recurrence) }),
        ...(dto.reminderOffsetMinutes !== undefined && { reminderOffsetMinutes: dto.reminderOffsetMinutes }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Task not found');
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    await this.createReminderForTask(task);
    return this.serializeTask(task);
  }

  async complete(id: string, userId: string): Promise<TaskResponse> {
    const result = await this.prisma.task.updateMany({
      where: { id, userId },
      data: { status: 'done', completedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Task not found');
    await this.prisma.reminder.updateMany({ where: { taskId: id, userId }, data: { status: 'completed' } });
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    await this.prisma.learningEvidence.create({
      data: {
        userId,
        taskId: id,
        type: 'task_completed',
        title: task.title,
        body: task.notes,
        roleTrackId: task.roleTrackId,
        area: task.area,
        topicId: task.topicId,
        jobApplicationId: task.jobApplicationId,
        missionId: task.missionId,
      },
    });
    return this.serializeTask(task);
  }

  async remove(id: string, userId: string): Promise<void> {
    // Reminder.task is onDelete: Cascade (schema.prisma), so a hard delete here also
    // removes any reminder tied to this task in the same statement.
    const result = await this.prisma.task.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Task not found');
  }

  async snooze(id: string, dto: SnoozeTaskDto, userId: string): Promise<TaskResponse> {
    const result = await this.prisma.task.updateMany({
      where: { id, userId },
      data: { snoozedUntil: this.parseDateTime(dto.snoozedUntil) },
    });
    if (result.count === 0) throw new NotFoundException('Task not found');
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    return this.serializeTask(task);
  }

  async listReminders(userId: string): Promise<ReminderResponse[]> {
    const reminders = await this.prisma.reminder.findMany({
      where: { userId, status: 'pending' },
      orderBy: { dueAt: 'asc' },
      take: 50,
    });
    return reminders.map((reminder) => this.serializeReminder(reminder));
  }

  async dismissReminder(id: string, userId: string): Promise<ReminderResponse> {
    const result = await this.prisma.reminder.updateMany({
      where: { id, userId },
      data: { status: 'dismissed', dismissedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Reminder not found');
    const reminder = await this.prisma.reminder.findUniqueOrThrow({ where: { id } });
    return this.serializeReminder(reminder);
  }

  private rangeWhere(range: ListTasksDto['range']): Prisma.TaskWhereInput {
    if (!range || range === 'all') return {};
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const tomorrow = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const week = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (range === 'overdue') return { status: { not: 'done' }, dueDate: { lt: start } };
    const end = range === 'today' ? tomorrow : week;
    return {
      OR: [
        { plannedFor: { gte: start, lt: end } },
        { dueDate: { gte: start, lt: end } },
      ],
    };
  }

  private async createReminderForTask(task: Task) {
    const base = task.dueDate ?? task.plannedFor;
    if (!base) return;
    const dueAt = new Date(base.getTime() - (task.reminderOffsetMinutes ?? 0) * 60 * 1000);
    const existing = await this.prisma.reminder.findFirst({ where: { taskId: task.id, type: 'task_due' } });
    if (existing) {
      await this.prisma.reminder.update({
        where: { id: existing.id },
        data: { dueAt, title: task.title, status: 'pending', dismissedAt: null },
      });
      return;
    }
    await this.prisma.reminder.create({
      data: { userId: task.userId, taskId: task.id, type: 'task_due', title: task.title, dueAt },
    });
  }

  private serializeTask(task: TaskWithRelations): TaskResponse {
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
      topic: task.topic,
      jobApplicationId: task.jobApplicationId,
      missionId: task.missionId,
      jobApplication: task.jobApplication
        ? { ...task.jobApplication, status: task.jobApplication.status as NonNullable<TaskResponse['jobApplication']>['status'] }
        : null,
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

  private parseDateTime(value: string | null | undefined): Date | null | undefined {
    if (value === undefined || value === null) return value;
    return new Date(value.length <= 10 ? `${value}T09:00:00.000Z` : value);
  }

  private cleanNullable(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
