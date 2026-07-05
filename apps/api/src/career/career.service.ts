import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CareerGoal, Prisma } from '@prisma/client';
import {
  CAREER_ROLE_TRACKS,
  CareerGoalResponse,
  CareerRoleAreaId,
  CareerRoleTrack,
  CareerRoleTrackId,
  isAttemptSolved,
  RoleAreaReadiness,
  RoleChecklistItem,
  RoleReadinessResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCareerGoalDto } from './dto/upsert-career-goal.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
    const context = await this.loadEvidenceContext(roleTrackId, userId);
    const areas = this.computeAreas(roleTrack, context);
    const totalWeight = areas.reduce((sum, area) => sum + area.totalWeight, 0);
    const completedWeight = areas.reduce((sum, area) => sum + area.completedWeight, 0);
    const topGaps = areas.flatMap((area) => area.gapItems).sort((left, right) => right.weight - left.weight).slice(0, 5);
    return {
      roleTrackId,
      roleTrack,
      overallPercentage: totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0,
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
        .filter((attempt) => this.isPositiveAttempt(attempt))
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

  private computeAreas(roleTrack: CareerRoleTrack, context: EvidenceContext): RoleAreaReadiness[] {
    const areaIds = [...new Set(roleTrack.checklist.map((item) => item.area))];
    return areaIds.map((area) => {
      const items = roleTrack.checklist.filter((item) => item.area === area);
      const completedItems = items.filter((item) => this.hasEvidence(roleTrack.id, item, context));
      const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
      const completedWeight = completedItems.reduce((sum, item) => sum + item.weight, 0);
      return {
        area,
        totalWeight,
        completedWeight,
        percentage: totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0,
        completedItems: completedItems.map((item) => item.id),
        gapItems: items.filter((item) => !completedItems.includes(item)),
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

  private isPositiveAttempt(attempt: {
    selfRating: number | null;
    correctness: string | null;
    rubricScore: number | null;
    aiScore?: number | null;
  }): boolean {
    return isAttemptSolved(attempt);
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
