import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type InterviewRound } from '@prisma/client';
import {
  CAREER_ROLE_TRACKS,
  CareerRoleTrackId,
  INTERVIEW_ROUND_TYPE_LABELS,
  InterviewRoundOutcome,
  InterviewRoundResponse,
  InterviewRoundType,
  MISS_TAG_LABELS,
  MissTagReason,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WeaknessesService, type RecordWeaknessSignalInput } from '../weaknesses/weaknesses.service';
import { CreateInterviewRoundDto } from './dto/create-interview-round.dto';
import { UpdateInterviewRoundDto } from './dto/update-interview-round.dto';

// MOM-113: one LearningEvidence row of this type per round is the OUTCOME record
// *and* the idempotency ledger — its metadata.emittedKeys tracks which weakness
// signals the round has already fired, so re-saving the same debrief does not
// re-accrue severity.
const DEBRIEF_EVIDENCE_TYPE = 'interview_debrief';

// MOM-111: which competency areas each round type actually tests, so prep is
// scoped to the round ("system_design onsite" → design tasks, not a generic
// checklist). An empty list means "use the whole role-track checklist".
const ROUND_TYPE_FOCUS: Record<string, string[]> = {
  recruiter_screen: ['behavioral', 'profile'],
  phone_screen: ['dsa', 'cs_fundamentals'],
  online_assessment: ['dsa'],
  technical: ['dsa', 'cs_fundamentals'],
  coding: ['dsa'],
  system_design: ['system_design'],
  behavioral: ['behavioral'],
  hiring_manager: ['behavioral', 'projects'],
  onsite: ['dsa', 'system_design', 'behavioral'],
  final: ['behavioral'],
  other: [],
};

const MAX_PREP_TASKS = 5;

const humanizeArea = (id: string): string => {
  const words = id.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

@Injectable()
export class InterviewRoundsService {
  private readonly logger = new Logger(InterviewRoundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weaknesses: WeaknessesService,
  ) {}

  async listForJob(jobId: string, userId: string): Promise<InterviewRoundResponse[]> {
    await this.ensureJob(jobId, userId);
    const rounds = await this.prisma.interviewRound.findMany({
      where: { jobApplicationId: jobId, userId },
      orderBy: [{ sequence: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });
    return rounds.map((round) => this.serialize(round));
  }

  async create(jobId: string, dto: CreateInterviewRoundDto, userId: string): Promise<InterviewRoundResponse> {
    await this.ensureJob(jobId, userId);
    const round = await this.prisma.interviewRound.create({
      data: {
        userId,
        jobApplicationId: jobId,
        roundType: dto.roundType,
        sequence: dto.sequence ?? 0,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        durationMinutes: dto.durationMinutes ?? null,
        interviewer: dto.interviewer ?? null,
      },
    });
    // MOM-112: keep a per-round interview-date reminder in sync.
    await this.ensureRoundReminder(round);
    return this.serialize(round);
  }

  async update(jobId: string, roundId: string, dto: UpdateInterviewRoundDto, userId: string): Promise<InterviewRoundResponse> {
    await this.ensureJob(jobId, userId);
    const result = await this.prisma.interviewRound.updateMany({
      where: { id: roundId, jobApplicationId: jobId, userId },
      data: {
        ...(dto.roundType !== undefined && { roundType: dto.roundType }),
        ...(dto.sequence !== undefined && { sequence: dto.sequence }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.interviewer !== undefined && { interviewer: dto.interviewer }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome }),
        ...(dto.debrief !== undefined && { debrief: dto.debrief }),
        ...(dto.areasWeak !== undefined && { areasWeak: dto.areasWeak }),
        ...(dto.missTags !== undefined && { missTags: dto.missTags }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Interview round not found');
    const round = await this.prisma.interviewRound.findUniqueOrThrow({ where: { id: roundId } });

    // MOM-112: re-sync the interview-date reminder when the date or type changed.
    if (dto.scheduledAt !== undefined || dto.roundType !== undefined) {
      await this.ensureRoundReminder(round);
    }

    // MOM-113 — the loop-closing edge. When this update carried debrief content
    // (the "Save debrief" action, not a bare outcome toggle), turn what the round
    // exposed into stored WeaknessSignals + a LearningEvidence outcome record.
    // Best-effort: a signal-emission failure must not fail the user's save.
    const touchedDebrief = dto.debrief !== undefined || dto.areasWeak !== undefined || dto.missTags !== undefined;
    if (touchedDebrief) {
      try {
        await this.emitDebriefSignals(round, userId);
      } catch (error) {
        this.logger.warn(`Debrief signal emission failed for round ${roundId}: ${String(error)}`);
      }
    }

    return this.serialize(round);
  }

  async remove(jobId: string, roundId: string, userId: string): Promise<{ deleted: boolean }> {
    await this.ensureJob(jobId, userId);
    const result = await this.prisma.interviewRound.deleteMany({ where: { id: roundId, jobApplicationId: jobId, userId } });
    if (result.count === 0) throw new NotFoundException('Interview round not found');
    return { deleted: true };
  }

  // MOM-111: generate prep Tasks scoped to a specific round — the role-track
  // checklist filtered to the areas that round type tests, staggered to come due
  // before the round's scheduledAt, and back-referenced to the round so the
  // auto-assembled prep queue (MOM-141) and Today can group them.
  async generatePrep(jobId: string, roundId: string, userId: string): Promise<{ created: number }> {
    const job = await this.prisma.jobApplication.findFirst({
      where: { id: jobId, userId },
      select: { id: true, company: true, roleTitle: true, roleTrackId: true, deadline: true },
    });
    if (!job) throw new NotFoundException('Job application not found');
    const round = await this.prisma.interviewRound.findFirst({
      where: { id: roundId, jobApplicationId: jobId, userId },
    });
    if (!round) throw new NotFoundException('Interview round not found');

    const roleTrackId = (job.roleTrackId as CareerRoleTrackId | null) ?? 'big-tech-swe';
    const checklist = CAREER_ROLE_TRACKS[roleTrackId].checklist;
    const focus = ROUND_TYPE_FOCUS[round.roundType] ?? [];
    const focused = focus.length > 0 ? checklist.filter((item) => focus.includes(item.area)) : checklist;
    // Never dead-end: if the focus filter matched nothing, fall back to the full list.
    const items = (focused.length > 0 ? focused : checklist).slice(0, MAX_PREP_TASKS);

    const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.roundType as InterviewRoundType] ?? round.roundType;
    // Anchor due dates before the round (or its job deadline, or a week out).
    const dueBase = round.scheduledAt ?? job.deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const taskData = items.map((item, index) => ({
      userId,
      jobApplicationId: jobId,
      interviewRoundId: roundId,
      roleTrackId: job.roleTrackId,
      area: item.area,
      type: item.evidenceType === 'project' ? 'project' : 'practice',
      priority: index < 2 ? 'high' : 'medium',
      title: `Prep ${item.title} for ${job.company} ${roundLabel}`,
      notes: `${job.roleTitle} — ${roundLabel} round: ${item.description}`,
      // Stagger: the first task is due earliest, the last closest to the round.
      dueDate: this.offsetDays(dueBase, -Math.max(1, items.length - index)),
    }));

    const created = await this.prisma.task.createMany({ data: taskData, skipDuplicates: true });
    return { created: created.count };
  }

  // MOM-141: for every pending round scheduled within `withinDays` that has no
  // prep tasks yet, auto-fire generatePrep so the prep queue assembles itself as
  // the date approaches. Idempotent — skips rounds that already have tasks — so
  // it is safe to run on a daily cron (InterviewPrepScheduler).
  async autoAssembleUpcomingPrep(withinDays = 7): Promise<{ roundsPrepared: number; tasksCreated: number }> {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    const rounds = await this.prisma.interviewRound.findMany({
      where: { outcome: 'pending', scheduledAt: { gte: now, lte: horizon } },
      select: { id: true, jobApplicationId: true, userId: true, _count: { select: { tasks: true } } },
    });

    let roundsPrepared = 0;
    let tasksCreated = 0;
    for (const round of rounds) {
      if (round._count.tasks > 0) continue; // already has a prep queue
      const { created } = await this.generatePrep(round.jobApplicationId, round.id, round.userId);
      if (created > 0) {
        roundsPrepared += 1;
        tasksCreated += created;
      }
    }
    return { roundsPrepared, tasksCreated };
  }

  private offsetDays(base: Date, days: number): Date {
    return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // MOM-112: keep one idempotent "prep for this round" reminder per round, due a
  // day before its scheduledAt (reusing jobs.service's sentinel-upsert idea, keyed
  // by interviewRoundId). No date → no reminder (and any stale one is removed).
  private async ensureRoundReminder(round: InterviewRound): Promise<void> {
    const existing = await this.prisma.reminder.findFirst({
      where: { interviewRoundId: round.id, type: 'interview_round' },
      select: { id: true },
    });
    if (!round.scheduledAt) {
      if (existing) await this.prisma.reminder.delete({ where: { id: existing.id } });
      return;
    }
    const job = await this.prisma.jobApplication.findUnique({
      where: { id: round.jobApplicationId },
      select: { company: true },
    });
    const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.roundType as InterviewRoundType] ?? round.roundType;
    const dueAt = this.reminderLeadTime(round.scheduledAt);
    const title = `Prep for your ${job?.company ?? 'interview'} ${roundLabel} on ${round.scheduledAt.toISOString().slice(0, 10)}`;
    if (existing) {
      await this.prisma.reminder.update({
        where: { id: existing.id },
        data: { dueAt, title, status: 'pending', dismissedAt: null },
      });
    } else {
      await this.prisma.reminder.create({
        data: {
          userId: round.userId,
          jobApplicationId: round.jobApplicationId,
          interviewRoundId: round.id,
          type: 'interview_round',
          title,
          dueAt,
        },
      });
    }
  }

  // A day before the round, at 09:00 UTC (mirrors jobs.service's deadline lead).
  private reminderLeadTime(scheduledAt: Date): Date {
    const date = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    date.setUTCHours(9, 0, 0, 0);
    return date;
  }

  // Convert the round's current debrief into target-scoped weakness signals and a
  // ledger row. Idempotent per round: only signal keys not already emitted by this
  // round fire, so editing/re-saving a debrief does not inflate severity. Removing
  // an area does not retract its earlier signal — read-time decay handles that.
  private async emitDebriefSignals(round: InterviewRound, userId: string): Promise<void> {
    const hasSubstance = Boolean(round.debrief) || round.areasWeak.length > 0 || round.missTags.length > 0;
    if (!hasSubstance) return;

    const job = await this.prisma.jobApplication.findUnique({
      where: { id: round.jobApplicationId },
      select: { company: true },
    });
    const company = job?.company ?? 'this company';
    const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.roundType as InterviewRoundType] ?? round.roundType;

    // Desired signals from the round's current debrief. Area signals are the
    // actionable ones (a weak_area_review / job_prep session draws by area);
    // reason signals feed the reason summary. Both are scoped to this job.
    const desired: Array<{ dedupKey: string; input: RecordWeaknessSignalInput }> = [];
    for (const area of round.areasWeak) {
      desired.push({
        dedupKey: `area:${area}`,
        input: {
          signalType: 'area',
          key: area,
          label: `${humanizeArea(area)} — weak at ${company}`,
          source: 'debrief',
          area,
          jobApplicationId: round.jobApplicationId,
        },
      });
    }
    for (const tag of round.missTags as MissTagReason[]) {
      if (!(tag in MISS_TAG_LABELS)) continue;
      desired.push({
        dedupKey: `reason:${tag}`,
        input: {
          signalType: 'reason',
          key: tag,
          label: `${MISS_TAG_LABELS[tag]} — ${roundLabel} at ${company}`,
          source: 'debrief',
          jobApplicationId: round.jobApplicationId,
        },
      });
    }

    // Locate this round's prior ledger row (small N per job) to read emittedKeys.
    const priorRows = await this.prisma.learningEvidence.findMany({
      where: { userId, jobApplicationId: round.jobApplicationId, type: DEBRIEF_EVIDENCE_TYPE },
    });
    const prior = priorRows.find((row) => (row.metadata as Record<string, unknown>)?.roundId === round.id) ?? null;
    const priorMeta = (prior?.metadata ?? {}) as Record<string, unknown>;
    const emitted = new Set<string>(
      Array.isArray(priorMeta.emittedKeys)
        ? (priorMeta.emittedKeys as unknown[]).filter((key): key is string => typeof key === 'string')
        : [],
    );

    for (const { dedupKey, input } of desired) {
      if (emitted.has(dedupKey)) continue;
      await this.weaknesses.recordSignal(userId, input);
      emitted.add(dedupKey);
    }

    const metadata = {
      roundId: round.id,
      roundType: round.roundType,
      outcome: round.outcome,
      areasWeak: round.areasWeak,
      missTags: round.missTags,
      emittedKeys: [...emitted],
    } satisfies Record<string, unknown>;
    const title = `Debrief: ${roundLabel} — ${company}`;
    const area = round.areasWeak[0] ?? null;

    if (prior) {
      await this.prisma.learningEvidence.update({
        where: { id: prior.id },
        data: { title, body: round.debrief, area, metadata: metadata as Prisma.InputJsonValue, occurredAt: new Date() },
      });
    } else {
      await this.prisma.learningEvidence.create({
        data: {
          userId,
          type: DEBRIEF_EVIDENCE_TYPE,
          title,
          body: round.debrief,
          area,
          jobApplicationId: round.jobApplicationId,
          metadata: metadata as Prisma.InputJsonValue,
          occurredAt: new Date(),
        },
      });
    }
  }

  private async ensureJob(jobId: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobId, userId }, select: { id: true } });
    if (!job) throw new NotFoundException('Job application not found');
  }

  private serialize(round: InterviewRound): InterviewRoundResponse {
    return {
      id: round.id,
      userId: round.userId,
      jobApplicationId: round.jobApplicationId,
      roundType: round.roundType as InterviewRoundType,
      sequence: round.sequence,
      scheduledAt: round.scheduledAt?.toISOString() ?? null,
      durationMinutes: round.durationMinutes,
      interviewer: round.interviewer,
      outcome: round.outcome as InterviewRoundOutcome,
      debrief: round.debrief,
      areasWeak: round.areasWeak,
      missTags: round.missTags as MissTagReason[],
      createdAt: round.createdAt.toISOString(),
      updatedAt: round.updatedAt.toISOString(),
    };
  }
}
