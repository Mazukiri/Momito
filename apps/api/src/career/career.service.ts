import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CareerGoal, Prisma } from '@prisma/client';
import {
  CAREER_ROLE_TRACKS,
  CareerGoalResponse,
  CareerRoleAreaId,
  CareerRoleTrack,
  CareerRoleTrackId,
  JobReadinessResponse,
  JobReadinessStatus,
  RoleAreaReadiness,
  RoleChecklistItem,
  RoleReadinessResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ReadinessService, type AreaMastery } from '../readiness/readiness.service';
import { WeaknessesService } from '../weaknesses/weaknesses.service';
import { UpsertCareerGoalDto } from './dto/upsert-career-goal.dto';

// MOM-130 job-readiness tuning.
const DEFAULT_JOB_ROLE_TRACK: CareerRoleTrackId = 'big-tech-swe';
// Each point of a job-scoped open weakness signal's decayed severity docks this
// many verdict points; the total dock is capped so signals can't zero out a
// genuinely strong candidate.
const SIGNAL_PENALTY_PER_SEVERITY = 5;
const SIGNAL_PENALTY_CAP = 30;
const READY_THRESHOLD = 75;
const ALMOST_THRESHOLD = 50;

type EvidenceContext = {
  profileText: string;
  projectText: string;
  practice: Array<{ roleTags: string[]; areaTags: string[]; text: string }>;
  learning: Array<{ roleTrackId: string | null; area: string | null; text: string }>;
  jobs: Array<{ roleTrackId: string | null; text: string }>;
  tasks: Array<{ roleTrackId: string | null; area: string | null; text: string; done: boolean }>;
};

@Injectable()
export class CareerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readiness: ReadinessService,
    private readonly weaknesses: WeaknessesService,
  ) {}

  listRoleTracks() {
    return Object.values(CAREER_ROLE_TRACKS);
  }

  async listGoals(userId: string): Promise<CareerGoalResponse[]> {
    const goals = await this.prisma.careerGoal.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    return goals.map((goal) => this.serializeGoal(goal));
  }

  async upsertGoal(dto: UpsertCareerGoalDto, userId: string): Promise<CareerGoalResponse> {
    this.getRoleTrack(dto.roleTrackId);
    const goal = await this.prisma.careerGoal.upsert({
      where: { userId_roleTrackId: { userId, roleTrackId: dto.roleTrackId } },
      update: {
        ...(dto.horizon && { horizon: dto.horizon }),
        ...(dto.status && { status: dto.status }),
        ...(dto.targetDate !== undefined && { targetDate: this.parseDate(dto.targetDate) }),
      },
      create: {
        userId,
        roleTrackId: dto.roleTrackId,
        horizon: dto.horizon ?? CAREER_ROLE_TRACKS[dto.roleTrackId].defaultHorizon,
        status: dto.status ?? 'active',
        targetDate: this.parseDate(dto.targetDate),
      },
    });
    return this.serializeGoal(goal);
  }

  async updateGoal(id: string, dto: UpsertCareerGoalDto, userId: string): Promise<CareerGoalResponse> {
    this.getRoleTrack(dto.roleTrackId);
    const result = await this.prisma.careerGoal.updateMany({
      where: { id, userId },
      data: {
        roleTrackId: dto.roleTrackId,
        ...(dto.horizon && { horizon: dto.horizon }),
        ...(dto.status && { status: dto.status }),
        ...(dto.targetDate !== undefined && { targetDate: this.parseDate(dto.targetDate) }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Career goal not found');
    const goal = await this.prisma.careerGoal.findUniqueOrThrow({ where: { id } });
    return this.serializeGoal(goal);
  }

  async getReadiness(roleTrackId: CareerRoleTrackId, userId: string): Promise<RoleReadinessResponse> {
    const roleTrack = this.getRoleTrack(roleTrackId);
    const [context, mastery] = await Promise.all([
      this.loadEvidenceContext(roleTrackId, userId),
      this.readiness.areaMastery(userId),
    ]);
    const areas = this.computeAreas(roleTrack, context, mastery);
    const totalWeight = areas.reduce((sum, area) => sum + area.totalWeight, 0);
    const topGaps = areas.flatMap((area) => area.gapItems).sort((left, right) => right.weight - left.weight).slice(0, 5);
    // MOM-129: the headline is the weight-weighted mean of the (grounded) area
    // percentages, so FSRS retrievability + graded attempts move the number, not
    // just keyword coverage. Falls back to coverage where an area has no history.
    const overallPercentage = totalWeight
      ? Math.round(areas.reduce((sum, area) => sum + area.percentage * area.totalWeight, 0) / totalWeight)
      : 0;
    return {
      roleTrackId,
      roleTrack,
      overallPercentage,
      areas,
      topGaps,
      nextActions: topGaps.slice(0, 3).map((gap) => this.nextAction(gap)),
    };
  }

  async listActiveReadiness(userId: string): Promise<RoleReadinessResponse[]> {
    const goals = await this.prisma.careerGoal.findMany({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    const roleIds = goals.length
      ? goals.map((goal) => goal.roleTrackId as CareerRoleTrackId)
      : (['big-tech-swe'] satisfies CareerRoleTrackId[]);
    return Promise.all(roleIds.map((roleTrackId) => this.getReadiness(roleTrackId, userId)));
  }

  // MOM-130: "am I ready for <company>?" — the target's grounded role readiness
  // (MOM-129) docked by that job's open weakness signals (MOM-113 debriefs). One
  // 0–100 verdict + the areas dragging it down, so a bombed round visibly lowers
  // the go/no-go for that specific application.
  async getJobReadiness(jobId: string, userId: string): Promise<JobReadinessResponse> {
    const job = await this.prisma.jobApplication.findFirst({
      where: { id: jobId, userId },
      select: { id: true, company: true, roleTitle: true, roleTrackId: true },
    });
    if (!job) throw new NotFoundException('Job application not found');

    const roleTrackId = (job.roleTrackId as CareerRoleTrackId | null) ?? DEFAULT_JOB_ROLE_TRACK;
    const [readiness, blockingSignals] = await Promise.all([
      this.getReadiness(roleTrackId, userId),
      this.weaknesses.listOpenSignals(userId, jobId),
    ]);

    // Penalty from this job's open weakness signals, weighted by decayed severity.
    const rawPenalty = blockingSignals.reduce((sum, signal) => sum + signal.severity * SIGNAL_PENALTY_PER_SEVERITY, 0);
    const penalty = Math.min(SIGNAL_PENALTY_CAP, Math.round(rawPenalty));
    const score = Math.max(0, Math.min(100, readiness.overallPercentage - penalty));
    const status: JobReadinessStatus = score >= READY_THRESHOLD ? 'ready' : score >= ALMOST_THRESHOLD ? 'almost' : 'not_ready';

    // The areas most in the way: lowest grounded percentage first (weight breaks ties).
    const weakestAreas = [...readiness.areas]
      .sort((left, right) => left.percentage - right.percentage || right.totalWeight - left.totalWeight)
      .slice(0, 3)
      .map((area) => ({ area: area.area as CareerRoleAreaId, percentage: area.percentage }));

    return {
      jobApplicationId: job.id,
      company: job.company,
      roleTitle: job.roleTitle,
      roleTrackId,
      roleTrack: readiness.roleTrack,
      score,
      status,
      penalty,
      areas: readiness.areas,
      weakestAreas,
      blockingSignals,
      nextActions: readiness.nextActions,
    };
  }

  private async loadEvidenceContext(roleTrackId: CareerRoleTrackId, userId: string): Promise<EvidenceContext> {
    const [profile, attempts, evidence, highlights, jobs, tasks] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.answerAttempt.findMany({
        where: { userId },
        include: {
          question: {
            select: {
              title: true,
              prompt: true,
              roleTags: true,
              areaTags: true,
              patternTags: true,
              topic: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.learningEvidence.findMany({
        where: { userId, OR: [{ roleTrackId }, { roleTrackId: null }] },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.learningHighlight.findMany({
        where: {
          userId,
          isDeleted: false,
          reviewedAt: { not: null },
          OR: [{ roleTrackId }, { roleTrackId: null }],
        },
        include: { source: { select: { title: true } } },
        orderBy: { reviewedAt: 'desc' },
      }),
      this.prisma.jobApplication.findMany({
        where: { userId, OR: [{ roleTrackId }, { roleTrackId: null }] },
      }),
      this.prisma.task.findMany({
        where: { userId, OR: [{ roleTrackId }, { roleTrackId: null }] },
      }),
    ]);

    return {
      profileText: profile ? this.profileText(profile) : '',
      projectText: profile ? this.jsonText(profile.projects) : '',
      practice: attempts
        .filter((attempt) => this.readiness.isPositiveAttempt(attempt))
        .map((attempt) => ({
          roleTags: this.asStringArray(attempt.question.roleTags),
          areaTags: this.asStringArray(attempt.question.areaTags),
          text: `${attempt.question.title} ${attempt.question.prompt} ${attempt.question.topic.name} ${this.asStringArray(attempt.question.patternTags).join(' ')}`,
        })),
      learning: [
        ...evidence.map((item) => ({
          roleTrackId: item.roleTrackId,
          area: item.area,
          text: `${item.title} ${item.body ?? ''} ${this.jsonText(item.metadata)}`,
        })),
        ...highlights.map((item) => ({
          roleTrackId: item.roleTrackId,
          area: item.area,
          text: `${item.text} ${item.note ?? ''} ${item.source?.title ?? ''}`,
        })),
      ],
      jobs: jobs.map((job) => ({ roleTrackId: job.roleTrackId, text: `${job.company} ${job.roleTitle} ${job.jdText ?? ''} ${job.status}` })),
      tasks: tasks.map((task) => ({
        roleTrackId: task.roleTrackId,
        area: task.area,
        text: `${task.title} ${task.notes ?? ''} ${task.type}`,
        done: task.status === 'done',
      })),
    };
  }

  private computeAreas(
    roleTrack: CareerRoleTrack,
    context: EvidenceContext,
    mastery: Map<string, AreaMastery>,
  ): RoleAreaReadiness[] {
    const areaIds = [...new Set(roleTrack.checklist.map((item) => item.area))];
    return areaIds.map((area) => {
      const items = roleTrack.checklist.filter((item) => item.area === area);
      const completedItems = items.filter((item) => this.hasEvidence(roleTrack.id, item, context));
      const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
      const completedWeight = completedItems.reduce((sum, item) => sum + item.weight, 0);
      const coverage = totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0;

      // MOM-129: ground the area percentage. When the area has real review/attempt
      // history, blend keyword coverage 50/50 with the FSRS-grounded mastery score
      // so recall + graded performance count (and decay). With no history, keep the
      // coverage number so profile/project-only areas aren't zeroed out.
      const areaMastery = mastery.get(area) ?? null;
      const hasHistory = areaMastery !== null && (areaMastery.gradedAttempts > 0 || areaMastery.reviewedCount > 0);
      const masteryScore = areaMastery ? Math.round(areaMastery.score * 100) : null;
      const percentage = hasHistory ? Math.round(0.5 * coverage + 0.5 * (masteryScore ?? 0)) : coverage;

      return {
        area,
        totalWeight,
        completedWeight,
        percentage,
        completedItems: completedItems.map((item) => item.id),
        gapItems: items.filter((item) => !completedItems.includes(item)),
        masteryScore,
        retrievability: areaMastery?.retrievability ?? null,
      };
    });
  }

  private hasEvidence(roleTrackId: CareerRoleTrackId, item: RoleChecklistItem, context: EvidenceContext): boolean {
    const keywords = [item.title, ...item.keywords].map((keyword) => keyword.toLowerCase());
    const matchesKeyword = (text: string) => {
      const normalized = text.toLowerCase();
      return keywords.some((keyword) => normalized.includes(keyword));
    };
    const matchesRole = (value: string | null) => value === null || value === roleTrackId;
    const matchesArea = (value: string | null) => value === null || value === item.area;

    if (item.evidenceType === 'profile') return matchesKeyword(context.profileText);
    if (item.evidenceType === 'project') return matchesKeyword(context.projectText);
    if (item.evidenceType === 'job') return context.jobs.some((job) => matchesRole(job.roleTrackId) && matchesKeyword(job.text));
    if (item.evidenceType === 'practice') {
      return context.practice.some((attempt) =>
        (attempt.roleTags.length === 0 || attempt.roleTags.includes(roleTrackId)) &&
        (attempt.areaTags.length === 0 || attempt.areaTags.includes(item.area)) &&
        matchesKeyword(attempt.text),
      ) || context.tasks.some((task) => task.done && matchesRole(task.roleTrackId) && matchesArea(task.area) && matchesKeyword(task.text));
    }
    return context.learning.some((entry) => matchesRole(entry.roleTrackId) && matchesArea(entry.area) && matchesKeyword(entry.text));
  }

  private nextAction(gap: RoleChecklistItem): string {
    if (gap.evidenceType === 'practice') return `Run a focused practice session for ${gap.title}.`;
    if (gap.evidenceType === 'project') return `Add or improve project evidence for ${gap.title}.`;
    if (gap.evidenceType === 'profile') return `Update your profile with measurable evidence for ${gap.title}.`;
    if (gap.evidenceType === 'job') return `Add job applications related to ${gap.title}.`;
    return `Review learning material for ${gap.title}.`;
  }

  private serializeGoal(goal: CareerGoal): CareerGoalResponse {
    const roleTrack = this.getRoleTrack(goal.roleTrackId as CareerRoleTrackId);
    return {
      id: goal.id,
      userId: goal.userId,
      roleTrackId: roleTrack.id,
      roleTrack,
      horizon: goal.horizon as CareerGoalResponse['horizon'],
      status: goal.status as CareerGoalResponse['status'],
      targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }

  private getRoleTrack(roleTrackId: CareerRoleTrackId): CareerRoleTrack {
    const roleTrack = CAREER_ROLE_TRACKS[roleTrackId];
    if (!roleTrack) throw new BadRequestException('Unknown role track');
    return roleTrack;
  }

  private parseDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined || value === null) return value;
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private profileText(profile: { skills: Prisma.JsonValue; experience: Prisma.JsonValue; projects: Prisma.JsonValue; education: Prisma.JsonValue }): string {
    return `${this.jsonText(profile.skills)} ${this.jsonText(profile.experience)} ${this.jsonText(profile.projects)} ${this.jsonText(profile.education)}`;
  }

  private jsonText(value: Prisma.JsonValue): string {
    return JSON.stringify(value ?? '');
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
