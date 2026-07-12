import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobApplication, JobEvent, Prisma } from '@prisma/client';
import {
  CAREER_ROLE_TRACKS,
  CareerRoleTrackId,
  CompanyFocusAreas,
  JOB_FUNNEL_STAGES,
  JOB_STAGE_STALL_THRESHOLDS,
  JobApplicationResponse,
  JobCompanyRef,
  JobEventResponse,
  JobFunnelBreakdownRow,
  JobFunnelResponse,
  JobRejectionBreakdownRow,
  RejectionReason,
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
  // MOM-105: the most recent status_change gives the current stage's entry time
  // (falls back to createdAt when the app has never transitioned). take:1 keeps it
  // cheap on the list query. NOTE: get() overrides `events` with the full timeline,
  // so it reconstructs this shape from that list before serializing.
  events: { where: { type: 'status_change' }, orderBy: { eventAt: 'desc' }, take: 1, select: { eventAt: true } },
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
    // Reconstruct jobInclude's take:1 status_change shape from the full timeline
    // so serializeJob can compute daysInStage/isStalled (MOM-105).
    const latestTransition = events.filter((event) => event.type === 'status_change').slice(0, 1).map((event) => ({ eventAt: event.eventAt }));
    return {
      ...this.serializeJob({ ...rest, events: latestTransition }),
      events: events.map((event) => this.serializeEvent(event)),
      tasks,
      reminders,
    };
  }

  // MOM-101: the job-hunt funnel + conversion analytics. Cumulative counts come
  // from current status; MOM-104 adds per-stage median timing from the structured
  // status_change transition history.
  async funnel(userId: string): Promise<JobFunnelResponse> {
    const [jobs, transitions, resumeVersions] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where: { userId },
        // MOM-160: appliedDate is the ever-reached fallback for a pre-MOM-102 terminal
        // app that carries no transition history (see maxStageReached).
        select: { id: true, status: true, source: true, visaTag: true, rejectionReason: true, createdAt: true, appliedDate: true },
      }),
      // Ordered so each job's transitions are chronological; fromStatus/toStatus
      // reconstruct how long each stage was occupied before the app moved on.
      this.prisma.jobEvent.findMany({
        where: { userId, type: 'status_change' },
        select: { jobApplicationId: true, fromStatus: true, toStatus: true, eventAt: true },
        orderBy: [{ jobApplicationId: 'asc' }, { eventAt: 'asc' }],
      }),
      // MOM-145: which résumé version was sent to which application. A version's
      // jobApplicationId is the record of "this is what I sent them".
      this.prisma.resumeVersion.findMany({
        where: { userId, jobApplicationId: { not: null } },
        select: { label: true, jobApplicationId: true },
      }),
    ]);

    // A job could in principle have several versions pointing at it; last write wins.
    const versionByJob = new Map(resumeVersions.map((version) => [version.jobApplicationId!, version.label]));

    const medianByStage = this.stageTimings(jobs, transitions);
    const stageIndex = new Map(JOB_FUNNEL_STAGES.map((stage, index) => [stage as string, index]));

    // atStage = current-status snapshot ("who is sitting at each stage right now").
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

    // MOM-160 (D-022): reached[k] = how many apps EVER got to stage k or deeper, from
    // transition history — NOT just the ones still active there. A rejected app that
    // reached an onsite still counts toward onsite; excluding it (the old snapshot
    // behavior) inflated every conversion rate by erasing the losses.
    const maxStageByJob = this.maxStageReached(jobs, transitions, stageIndex);
    const reached = JOB_FUNNEL_STAGES.map(
      (_, index) => jobs.reduce((sum, job) => sum + ((maxStageByJob.get(job.id) ?? -1) >= index ? 1 : 0), 0),
    );

    const stages = JOB_FUNNEL_STAGES.map((stage, index) => ({
      stage,
      atStage: atStage[index],
      reached: reached[index],
      conversionFromPrev: index === 0 ? null : this.ratio(reached[index], reached[index - 1]),
      medianDaysInStage: medianByStage.get(stage) ?? null,
    }));

    const appliedIdx = stageIndex.get('applied')!;
    const oaIdx = stageIndex.get('oa')!;
    // Headline offers = offers currently held (snapshot); active = still in play (not a
    // terminal status). `active` can no longer come from reached[0], which now equals total.
    const offers = atStage[stageIndex.get('offer')!];
    const active = jobs.filter((job) => job.status !== 'rejected' && job.status !== 'withdrawn').length;

    return {
      total: jobs.length,
      active,
      offers,
      rejected,
      withdrawn,
      responseRate: this.ratio(reached[oaIdx], reached[appliedIdx]) ?? 0,
      stages,
      bySource: this.breakdown(jobs, (job) => job.source ?? 'unspecified', maxStageByJob, stageIndex),
      byVisaTag: this.breakdown(jobs, (job) => job.visaTag ?? 'unknown', maxStageByJob, stageIndex),
      byRejectionReason: this.rejectionBreakdown(jobs),
      // MOM-145: which résumé actually converts. Apps with no version linked are
      // excluded (null key) — they say nothing about résumé performance.
      byResumeVersion: this.breakdown(jobs, (job) => versionByJob.get(job.id) ?? null, maxStageByJob, stageIndex),
    };
  }

  // MOM-160 (D-022): the deepest funnel stage each job EVER occupied, keyed by job id.
  // Sources, unioned: the current status (covers an app created directly at a deep stage),
  // and every fromStatus/toStatus of its status_change transitions (covers an app that has
  // since moved on OR been rejected out of a deep stage — the fromStatus preserves the depth).
  // A terminal app (rejected/withdrawn) is not itself a funnel stage; one with NO transition
  // history at all (pre-MOM-102) falls back to `applied` when it has an appliedDate, else
  // `saved` — so a rejected-but-applied app still lands in the responseRate denominator.
  private maxStageReached(
    jobs: Array<{ id: string; status: string; appliedDate: Date | null }>,
    transitions: Array<{ jobApplicationId: string; fromStatus: string | null; toStatus: string | null }>,
    stageIndex: Map<string, number>,
  ): Map<string, number> {
    const byJob = new Map<string, number>();
    const consider = (jobId: string, status: string | null) => {
      if (!status) return;
      const idx = stageIndex.get(status);
      if (idx === undefined) return; // a terminal/unknown status is not a funnel stage
      byJob.set(jobId, Math.max(byJob.get(jobId) ?? -1, idx));
    };
    for (const job of jobs) consider(job.id, job.status);
    for (const transition of transitions) {
      consider(transition.jobApplicationId, transition.fromStatus);
      consider(transition.jobApplicationId, transition.toStatus);
    }
    for (const job of jobs) {
      if (byJob.has(job.id)) continue; // terminal app with no funnel-stage signal
      consider(job.id, job.appliedDate ? 'applied' : 'saved');
    }
    return byJob;
  }

  // MOM-106: loss analysis over the rejected applications — a plain count per
  // reason (unset → 'unspecified'), most common first.
  private rejectionBreakdown(jobs: Array<{ status: string; rejectionReason: string | null }>): JobRejectionBreakdownRow[] {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      if (job.status !== 'rejected') continue;
      const key = job.rejectionReason ?? 'unspecified';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((left, right) => right.count - left.count);
  }

  // keyOf returning null drops the job from the breakdown entirely — used by
  // MOM-145's byResumeVersion, where apps with no résumé version linked carry no
  // signal about which résumé converts and would just dilute the comparison.
  // MOM-160 (D-022): offers/interviewing are EVER-reached, not current status — a
  // rejected app that got an interview is positive evidence about the résumé/source
  // that got it there, which is exactly what this comparison exists to measure.
  private breakdown<T extends { id: string; status: string }>(
    jobs: T[],
    keyOf: (job: T) => string | null,
    maxStageByJob: Map<string, number>,
    stageIndex: Map<string, number>,
  ): JobFunnelBreakdownRow[] {
    const offerIdx = stageIndex.get('offer')!;
    const interviewIdx = stageIndex.get('interview')!;
    const groups = new Map<string, { total: number; offers: number; interviewing: number }>();
    for (const job of jobs) {
      const key = keyOf(job);
      if (key === null) continue;
      const depth = maxStageByJob.get(job.id) ?? -1;
      const row = groups.get(key) ?? { total: 0, offers: 0, interviewing: 0 };
      row.total += 1;
      if (depth >= offerIdx) row.offers += 1;
      if (depth >= interviewIdx) row.interviewing += 1;
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
    const status = dto.status ?? 'saved';
    // MOM-106: a rejection reason only belongs on a rejected application.
    if (dto.rejectionReason != null && status !== 'rejected') {
      throw new BadRequestException('rejectionReason can only be set when status is rejected');
    }
    const job = await this.prisma.jobApplication.create({
      data: {
        userId,
        company: dto.company.trim(),
        companyId: dto.companyId ?? null,
        roleTitle: dto.roleTitle.trim(),
        url: this.cleanNullable(dto.url),
        location: this.cleanNullable(dto.location),
        status,
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
        rejectionReason: status === 'rejected' ? (dto.rejectionReason ?? null) : null,
      },
      include: jobInclude,
    });
    await this.ensureDeadlineReminder(job);
    return this.serializeJob(job);
  }

  async update(id: string, dto: UpdateJobDto, userId: string): Promise<JobApplicationResponse> {
    if (dto.roleTrackId) this.ensureRole(dto.roleTrackId);
    if (dto.companyId) await this.ensureCompanyExists(dto.companyId);
    // MOM-102: capture the prior status *before* the write so a transition can be
    // logged. Also needed (MOM-106) to know the resulting status when only a
    // rejectionReason is being set. Queried whenever status or reason is in play.
    const previousStatus =
      dto.status !== undefined || dto.rejectionReason !== undefined
        ? (await this.prisma.jobApplication.findFirst({ where: { id, userId }, select: { status: true } }))?.status
        : undefined;
    // MOM-106: a rejection reason only belongs on a (resulting) rejected application.
    if (dto.rejectionReason != null && (dto.status ?? previousStatus) !== 'rejected') {
      throw new BadRequestException('rejectionReason can only be set when status is rejected');
    }
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
          // MOM-106: when this transition is the rejection, record the reason on the
          // event too (the JobApplication column is the queryable source of truth).
          notes: dto.status === 'rejected' && dto.rejectionReason ? `Rejection reason: ${dto.rejectionReason}` : null,
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
      // MOM-106: an explicit reason wins; otherwise moving the app out of `rejected`
      // clears any stale reason so loss analysis never counts a reopened app.
      ...(dto.rejectionReason !== undefined
        ? { rejectionReason: dto.rejectionReason }
        : dto.status !== undefined && dto.status !== 'rejected'
          ? { rejectionReason: null }
          : {}),
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
    const { daysInStage, isStalled } = this.stallState(job);
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
      rejectionReason: (job.rejectionReason as RejectionReason | null) ?? null,
      daysInStage,
      isStalled,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      _count: job._count,
    };
  }

  // MOM-105: how long the app has sat in its current stage (since its last
  // status_change, else since creation) and whether that passes the stage's stall
  // threshold. Terminal statuses (rejected/withdrawn) never stall → null days.
  private stallState(job: { status: string; createdAt: Date; events: Array<{ eventAt: Date }> }): { daysInStage: number | null; isStalled: boolean } {
    const threshold = JOB_STAGE_STALL_THRESHOLDS[job.status];
    if (threshold === undefined) return { daysInStage: null, isStalled: false };
    const enteredAt = job.events[0]?.eventAt ?? job.createdAt;
    const daysInStage = Math.floor((Date.now() - enteredAt.getTime()) / (24 * 60 * 60 * 1000));
    return { daysInStage, isStalled: daysInStage >= threshold };
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
