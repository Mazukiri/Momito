import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobApplication, JobEvent, Prisma } from '@prisma/client';
import {
  CAREER_ROLE_TRACKS,
  CareerRoleTrackId,
  CompanyFocusAreas,
  JOB_FUNNEL_STAGES,
  JobApplicationResponse,
  JobCompanyRef,
  JobEventResponse,
  JobFunnelBreakdownRow,
  JobFunnelResponse,
  RoleTemplateId,
  VisaTag,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileScoresService } from '../profile-scores/profile-scores.service';
import { CreateJobEventDto } from './dto/create-job-event.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

const jobInclude = {
  _count: { select: { events: true, tasks: true, reminders: true } },
  // MOM-122: the linked catalog company, slim projection for pipeline display.
  companyRef: { select: { id: true, name: true, region: true, sponsorshipStatus: true, focusAreas: true } },
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

  // MOM-101: the job-hunt funnel + conversion analytics. Cumulative counts come
  // from current status; MOM-104 adds per-stage median timing from the structured
  // status_change transition history.
  async funnel(userId: string): Promise<JobFunnelResponse> {
    const [jobs, transitions] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where: { userId },
        select: { id: true, status: true, source: true, visaTag: true, createdAt: true },
      }),
      // Ordered so each job's transitions are chronological; fromStatus/toStatus
      // reconstruct how long each stage was occupied before the app moved on.
      this.prisma.jobEvent.findMany({
        where: { userId, type: 'status_change' },
        select: { jobApplicationId: true, fromStatus: true, toStatus: true, eventAt: true },
        orderBy: [{ jobApplicationId: 'asc' }, { eventAt: 'asc' }],
      }),
    ]);

    const medianByStage = this.stageTimings(jobs, transitions);
    const stageIndex = new Map(JOB_FUNNEL_STAGES.map((stage, index) => [stage as string, index]));
    const atStage = JOB_FUNNEL_STAGES.map(() => 0);
    let rejected = 0;
    let withdrawn = 0;

    for (const job of jobs) {
      if (job.status === 'rejected') rejected += 1;
      else if (job.status === 'withdrawn') withdrawn += 1;
      else {
        const index = stageIndex.get(job.status);
        if (index !== undefined) atStage[index] += 1;
      }
    }

    // reached[k] = active apps at stage k or deeper (cumulative funnel).
    const reached = atStage.map((_, index) => atStage.slice(index).reduce((sum, count) => sum + count, 0));
    const active = reached[0] ?? 0;

    const stages = JOB_FUNNEL_STAGES.map((stage, index) => ({
      stage,
      atStage: atStage[index],
      reached: reached[index],
      conversionFromPrev: index === 0 ? null : this.ratio(reached[index], reached[index - 1]),
      medianDaysInStage: medianByStage.get(stage) ?? null,
    }));

    const appliedIdx = stageIndex.get('applied')!;
    const oaIdx = stageIndex.get('oa')!;
    const offers = atStage[stageIndex.get('offer')!];

    return {
      total: jobs.length,
      active,
      offers,
      rejected,
      withdrawn,
      responseRate: this.ratio(reached[oaIdx], reached[appliedIdx]) ?? 0,
      stages,
      bySource: this.breakdown(jobs, (job) => job.source ?? 'unspecified'),
      byVisaTag: this.breakdown(jobs, (job) => job.visaTag ?? 'unknown'),
    };
  }

  private breakdown(
    jobs: Array<{ status: string }>,
    keyOf: (job: { status: string; source: string | null; visaTag: string | null }) => string,
  ): JobFunnelBreakdownRow[] {
    const groups = new Map<string, { total: number; offers: number; interviewing: number }>();
    const interviewingStatuses = new Set(['interview', 'onsite', 'offer']);
    for (const job of jobs as Array<{ status: string; source: string | null; visaTag: string | null }>) {
      const key = keyOf(job);
      const row = groups.get(key) ?? { total: 0, offers: 0, interviewing: 0 };
      row.total += 1;
      if (job.status === 'offer') row.offers += 1;
      if (interviewingStatuses.has(job.status)) row.interviewing += 1;
      groups.set(key, row);
    }
    return [...groups.entries()]
      .map(([key, row]) => ({ key, ...row, conversion: this.ratio(row.offers, row.total) ?? 0 }))
      .sort((left, right) => right.total - left.total);
  }

  // Rounded 0-1 ratio; null when the denominator is 0 (no meaningful conversion).
  private ratio(numerator: number, denominator: number): number | null {
    if (denominator <= 0) return null;
    return Math.round((numerator / denominator) * 1000) / 1000;
  }

  // MOM-104: median days each funnel stage was occupied, reconstructed from the
  // ordered status_change transitions. A stage is *entered* at the eventAt of the
  // transition into it (or the app's createdAt for its very first stage) and *left*
  // at the next transition's eventAt; the gap is one completed occupancy sample.
  // The current (still-open) stage contributes no sample. Stage revisits each count
  // as their own sample, which is why we take a median rather than a single span.
  private stageTimings(
    jobs: Array<{ id: string; createdAt: Date }>,
    transitions: Array<{ jobApplicationId: string; fromStatus: string | null; toStatus: string | null; eventAt: Date }>,
  ): Map<string, number> {
    const funnelStages = new Set<string>(JOB_FUNNEL_STAGES);
    const createdAt = new Map(jobs.map((job) => [job.id, job.createdAt]));
    const byJob = new Map<string, Array<{ fromStatus: string | null; eventAt: Date }>>();
    for (const transition of transitions) {
      if (!byJob.has(transition.jobApplicationId)) byJob.set(transition.jobApplicationId, []);
      byJob.get(transition.jobApplicationId)!.push({ fromStatus: transition.fromStatus, eventAt: transition.eventAt });
    }

    const samples = new Map<string, number[]>();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    for (const [jobId, events] of byJob) {
      // Entry into the stage being left by the first transition is the app's
      // creation (a pre-MOM-102 approximation, documented in ADR-0009).
      let enteredAt = createdAt.get(jobId) ?? events[0].eventAt;
      for (const event of events) {
        const stage = event.fromStatus;
        const days = (event.eventAt.getTime() - enteredAt.getTime()) / MS_PER_DAY;
        if (stage && funnelStages.has(stage) && days >= 0) {
          if (!samples.has(stage)) samples.set(stage, []);
          samples.get(stage)!.push(days);
        }
        enteredAt = event.eventAt;
      }
    }

    const medians = new Map<string, number>();
    for (const [stage, values] of samples) medians.set(stage, this.median(values));
    return medians;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    const raw = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return Math.round(raw * 10) / 10;
  }

  async create(dto: CreateJobDto, userId: string): Promise<JobApplicationResponse> {
    if (dto.roleTrackId) this.ensureRole(dto.roleTrackId);
    if (dto.companyId) await this.ensureCompanyExists(dto.companyId);
    const job = await this.prisma.jobApplication.create({
      data: {
        userId,
        company: dto.company.trim(),
        companyId: dto.companyId ?? null,
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
    if (dto.companyId) await this.ensureCompanyExists(dto.companyId);
    // MOM-102: capture the prior status *before* the write so a transition can
    // be logged. Only queried when the caller is actually changing status.
    const previousStatus =
      dto.status !== undefined
        ? (await this.prisma.jobApplication.findFirst({ where: { id, userId }, select: { status: true } }))?.status
        : undefined;
    const result = await this.prisma.jobApplication.updateMany({
      where: { id, userId },
      data: this.updateData(dto),
    });
    if (result.count === 0) throw new NotFoundException('Job not found');
    // A status change becomes a structured JobEvent — every stage transition
    // gets an automatic audit trail (the foundation for funnel timing, MOM-104),
    // instead of a silent field overwrite.
    if (dto.status !== undefined && previousStatus !== undefined && dto.status !== previousStatus) {
      await this.prisma.jobEvent.create({
        data: {
          userId,
          jobApplicationId: id,
          type: 'status_change',
          title: `${previousStatus} → ${dto.status}`,
          // MOM-103: the structured pair drives funnel timing (MOM-104) and stall
          // detection (MOM-105); `title` stays for human-readable display.
          fromStatus: previousStatus,
          toStatus: dto.status,
          eventAt: new Date(),
        },
      });
    }
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

  private updateData(dto: UpdateJobDto): Prisma.JobApplicationUncheckedUpdateManyInput {
    return {
      ...(dto.company !== undefined && { company: dto.company.trim() }),
      ...(dto.companyId !== undefined && { companyId: dto.companyId }),
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

  // MOM-122: a linked company must exist in the catalog (companies are global, not
  // user-scoped). Free-text `company` is unaffected — this only guards the FK.
  private async ensureCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new BadRequestException('Unknown company');
  }

  private serializeCompanyRef(
    companyRef: { id: string; name: string; region: string | null; sponsorshipStatus: string | null; focusAreas: Prisma.JsonValue } | null,
  ): JobCompanyRef | null {
    if (!companyRef) return null;
    return {
      id: companyRef.id,
      name: companyRef.name,
      region: companyRef.region,
      sponsorshipStatus: (companyRef.sponsorshipStatus as VisaTag | null) ?? null,
      focusAreas: this.asFocusAreas(companyRef.focusAreas),
    };
  }

  private asFocusAreas(value: Prisma.JsonValue): CompanyFocusAreas {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [area, weight] of Object.entries(value)) {
      if (typeof weight === 'number') out[area] = weight;
    }
    return out as CompanyFocusAreas;
  }

  private serializeJob(job: JobWithCounts): JobApplicationResponse {
    return {
      id: job.id,
      userId: job.userId,
      company: job.company,
      companyId: job.companyId,
      companyRef: this.serializeCompanyRef(job.companyRef),
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
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
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
