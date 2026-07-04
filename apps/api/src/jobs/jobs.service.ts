import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobApplication, JobEvent, Prisma } from '@prisma/client';
import {
  CAREER_ROLE_TRACKS,
  CareerRoleTrackId,
  JobApplicationResponse,
  JobEventResponse,
  RoleTemplateId,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileScoresService } from '../profile-scores/profile-scores.service';
import { CreateJobEventDto } from './dto/create-job-event.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

const jobInclude = {
  _count: { select: { events: true, tasks: true, reminders: true } },
} satisfies Prisma.JobApplicationInclude;

type JobWithCounts = Prisma.JobApplicationGetPayload<{ include: typeof jobInclude }>;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileScores: ProfileScoresService,
  ) {}

  async list(userId: string, status?: string): Promise<JobApplicationResponse[]> {
    const jobs = await this.prisma.jobApplication.findMany({
      where: { userId, ...(status && { status }) },
      include: jobInclude,
      orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
    });
    return jobs.map((job) => this.serializeJob(job));
  }

  async get(id: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({
      where: { id, userId },
      include: {
        ...jobInclude,
        events: { orderBy: { eventAt: 'desc' } },
        tasks: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] },
        reminders: { orderBy: { dueAt: 'asc' } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    const { events, tasks, reminders, ...rest } = job;
    return {
      ...this.serializeJob(rest),
      events: events.map((event) => this.serializeEvent(event)),
      tasks,
      reminders,
    };
  }

  async create(dto: CreateJobDto, userId: string): Promise<JobApplicationResponse> {
    if (dto.roleTrackId) this.ensureRole(dto.roleTrackId);
    const job = await this.prisma.jobApplication.create({
      data: {
        userId,
        company: dto.company.trim(),
        roleTitle: dto.roleTitle.trim(),
        url: this.cleanNullable(dto.url),
        location: this.cleanNullable(dto.location),
        status: dto.status ?? 'saved',
        roleTrackId: dto.roleTrackId ?? null,
        jdText: this.cleanNullable(dto.jdText),
        appliedDate: this.parseDate(dto.appliedDate),
        deadline: this.parseDate(dto.deadline),
        source: dto.source ?? null,
        referralName: this.cleanNullable(dto.referralName),
        visaTag: dto.visaTag ?? 'unknown',
        h1bCountLastYear: dto.h1bCountLastYear ?? null,
        compensationNotes: this.cleanNullable(dto.compensationNotes),
        notes: this.cleanNullable(dto.notes),
      },
      include: jobInclude,
    });
    await this.ensureDeadlineReminder(job);
    return this.serializeJob(job);
  }

  async update(id: string, dto: UpdateJobDto, userId: string): Promise<JobApplicationResponse> {
    if (dto.roleTrackId) this.ensureRole(dto.roleTrackId);
    const result = await this.prisma.jobApplication.updateMany({
      where: { id, userId },
      data: this.updateData(dto),
    });
    if (result.count === 0) throw new NotFoundException('Job not found');
    const job = await this.prisma.jobApplication.findUniqueOrThrow({ where: { id }, include: jobInclude });
    await this.ensureDeadlineReminder(job);
    return this.serializeJob(job);
  }

  async addEvent(id: string, dto: CreateJobEventDto, userId: string): Promise<JobEventResponse> {
    const job = await this.prisma.jobApplication.findFirst({ where: { id, userId }, select: { id: true, company: true, roleTitle: true } });
    if (!job) throw new NotFoundException('Job not found');
    const event = await this.prisma.jobEvent.create({
      data: {
        userId,
        jobApplicationId: id,
        type: dto.type.trim(),
        title: dto.title.trim(),
        notes: this.cleanNullable(dto.notes),
        eventAt: dto.eventAt ? new Date(dto.eventAt) : new Date(),
      },
    });
    return this.serializeEvent(event);
  }

  async generatePrep(id: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id, userId } });
    if (!job) throw new NotFoundException('Job not found');
    const roleTrackId = job.roleTrackId as CareerRoleTrackId | null;
    const checklist = roleTrackId ? CAREER_ROLE_TRACKS[roleTrackId].checklist : CAREER_ROLE_TRACKS['big-tech-swe'].checklist;
    const dueBase = job.deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const taskData = checklist.slice(0, 5).map((item, index) => ({
      userId,
      jobApplicationId: id,
      roleTrackId,
      area: item.area,
      type: item.evidenceType === 'project' ? 'project' : 'practice',
      priority: index < 2 ? 'high' : 'medium',
      title: `Prep ${item.title} for ${job.company}`,
      notes: `${job.roleTitle}: ${item.description}`,
      dueDate: this.offsetDate(dueBase, -Math.max(1, 5 - index)),
    }));
    const created = await this.prisma.task.createMany({ data: taskData, skipDuplicates: true });
    await this.ensureDeadlineReminder(job);
    return { created: created.count };
  }

  async scoreProfile(id: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id, userId } });
    if (!job) throw new NotFoundException('Job not found');
    const role = this.profileRole(job.roleTrackId);
    return this.profileScores.create({ role, jdText: job.jdText }, userId);
  }

  private updateData(dto: UpdateJobDto): Prisma.JobApplicationUpdateManyMutationInput {
    return {
      ...(dto.company !== undefined && { company: dto.company.trim() }),
      ...(dto.roleTitle !== undefined && { roleTitle: dto.roleTitle.trim() }),
      ...(dto.url !== undefined && { url: this.cleanNullable(dto.url) }),
      ...(dto.location !== undefined && { location: this.cleanNullable(dto.location) }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.roleTrackId !== undefined && { roleTrackId: dto.roleTrackId }),
      ...(dto.jdText !== undefined && { jdText: this.cleanNullable(dto.jdText) }),
      ...(dto.appliedDate !== undefined && { appliedDate: this.parseDate(dto.appliedDate) }),
      ...(dto.deadline !== undefined && { deadline: this.parseDate(dto.deadline) }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.referralName !== undefined && { referralName: this.cleanNullable(dto.referralName) }),
      ...(dto.visaTag !== undefined && { visaTag: dto.visaTag }),
      ...(dto.h1bCountLastYear !== undefined && { h1bCountLastYear: dto.h1bCountLastYear }),
      ...(dto.compensationNotes !== undefined && { compensationNotes: this.cleanNullable(dto.compensationNotes) }),
      ...(dto.notes !== undefined && { notes: this.cleanNullable(dto.notes) }),
    };
  }

  private async ensureDeadlineReminder(job: JobApplication) {
    if (!job.deadline) return;
    await this.prisma.reminder.upsert({
      where: { id: await this.findExistingDeadlineReminder(job.id) },
      update: {
        dueAt: this.deadlineReminderTime(job.deadline),
        title: `Prepare for ${job.company} ${job.roleTitle} deadline`,
        status: 'pending',
        dismissedAt: null,
      },
      create: {
        userId: job.userId,
        jobApplicationId: job.id,
        type: 'job_deadline',
        title: `Prepare for ${job.company} ${job.roleTitle} deadline`,
        dueAt: this.deadlineReminderTime(job.deadline),
      },
    });
  }

  private async findExistingDeadlineReminder(jobApplicationId: string): Promise<string> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { jobApplicationId, type: 'job_deadline' },
      select: { id: true },
    });
    return reminder?.id ?? '00000000-0000-0000-0000-000000000000';
  }

  private deadlineReminderTime(deadline: Date): Date {
    const date = new Date(deadline);
    date.setUTCHours(9, 0, 0, 0);
    return date;
  }

  private profileRole(roleTrackId: string | null): RoleTemplateId {
    if (roleTrackId === 'hpc-gpu-engineer') return 'hpc-engineer';
    if (roleTrackId === 'quant-swe') return 'quant-hedge-fund-swe';
    return 'google-l4-swe';
  }

  private ensureRole(roleTrackId: CareerRoleTrackId) {
    if (!CAREER_ROLE_TRACKS[roleTrackId]) throw new BadRequestException('Unknown role track');
  }

  private serializeJob(job: JobWithCounts): JobApplicationResponse {
    return {
      id: job.id,
      userId: job.userId,
      company: job.company,
      roleTitle: job.roleTitle,
      url: job.url,
      location: job.location,
      status: job.status as JobApplicationResponse['status'],
      roleTrackId: job.roleTrackId as JobApplicationResponse['roleTrackId'],
      jdText: job.jdText,
      appliedDate: job.appliedDate?.toISOString().slice(0, 10) ?? null,
      deadline: job.deadline?.toISOString().slice(0, 10) ?? null,
      source: job.source as JobApplicationResponse['source'],
      referralName: job.referralName,
      visaTag: job.visaTag as JobApplicationResponse['visaTag'],
      h1bCountLastYear: job.h1bCountLastYear,
      compensationNotes: job.compensationNotes,
      notes: job.notes,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      _count: job._count,
    };
  }

  private serializeEvent(event: JobEvent): JobEventResponse {
    return {
      id: event.id,
      userId: event.userId,
      jobApplicationId: event.jobApplicationId,
      type: event.type,
      title: event.title,
      notes: event.notes,
      eventAt: event.eventAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
    };
  }

  private parseDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined || value === null) return value;
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private offsetDate(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private cleanNullable(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
