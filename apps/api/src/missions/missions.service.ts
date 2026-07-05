import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Mission, MissionCheckIn, MissionCompetencyState, PlanItem, Prisma, Task, WeeklyPlan } from '@prisma/client';
import { CAREER_ROLE_TRACKS, CareerRoleTrackId, CareerRoleTrack, PlanItemResponse, WeeklyPlanResponse } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { CreateMissionDto } from './dto/create-mission.dto';
import { ReviewPlanDto } from './dto/review-plan.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';

const missionInclude = {
  jobApplication: { select: { id: true, company: true, roleTitle: true, status: true, deadline: true } },
} satisfies Prisma.MissionInclude;

const planInclude = {
  items: { orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.WeeklyPlanInclude;

type MissionRecord = Prisma.MissionGetPayload<{ include: typeof missionInclude }>;
type PlanRecord = Prisma.WeeklyPlanGetPayload<{ include: typeof planInclude }>;

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, stage?: string) {
    const missions = await this.prisma.mission.findMany({
      where: { userId, ...(stage && { stage }) },
      include: missionInclude,
      orderBy: [{ targetDate: 'asc' }, { updatedAt: 'desc' }],
    });
    return missions.map((mission) => this.serializeMission(mission));
  }

  async create(dto: CreateMissionDto, userId: string) {
    const roleTrack = this.getRoleTrack(dto.roleTrackId);
    await this.ensureReferences(dto.careerGoalId, dto.jobApplicationId, userId, roleTrack.id);
    const mission = await this.prisma.mission.create({
      data: {
        userId,
        name: dto.name.trim(),
        summary: this.cleanNullable(dto.summary),
        sourceType: dto.sourceType ?? (dto.jobApplicationId ? 'job_application' : dto.careerGoalId ? 'career_goal' : 'manual'),
        roleTrackId: roleTrack.id,
        careerGoalId: dto.careerGoalId ?? null,
        jobApplicationId: dto.jobApplicationId ?? null,
        targetDate: this.parseDate(dto.targetDate),
        weeklyHours: dto.weeklyHours ?? 8,
        successDefinition: this.cleanNullable(dto.successDefinition),
      },
      include: missionInclude,
    });
    await this.syncCompetencies(mission.id, userId, roleTrack.id);
    return this.serializeMission(mission);
  }

  async createFromJob(jobId: string, userId: string) {
    const existing = await this.prisma.mission.findFirst({
      where: { userId, jobApplicationId: jobId },
      include: missionInclude,
    });
    if (existing) return this.get(existing.id, userId);

    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobId, userId } });
    if (!job) throw new NotFoundException('Job not found');
    const roleTrackId = (job.roleTrackId as CareerRoleTrackId | null) ?? 'big-tech-swe';
    const mission = await this.prisma.mission.create({
      data: {
        userId,
        name: `${job.company} ${job.roleTitle}`,
        summary: job.jdText ?? job.notes,
        sourceType: 'job_application',
        roleTrackId,
        jobApplicationId: job.id,
        targetDate: job.deadline,
        weeklyHours: 8,
        successDefinition: `Land ${job.roleTitle} at ${job.company}`,
      },
      include: missionInclude,
    });
    await this.syncCompetencies(mission.id, userId, roleTrackId);
    return this.get(mission.id, userId);
  }

  async get(id: string, userId: string) {
    const mission = await this.prisma.mission.findFirst({
      where: { id, userId },
      include: {
        ...missionInclude,
        competencyStates: { orderBy: [{ status: 'asc' }, { weight: 'desc' }, { title: 'asc' }] },
        plans: { include: planInclude, orderBy: { weekStart: 'desc' }, take: 4 },
        checkIns: { orderBy: { checkInAt: 'desc' }, take: 6 },
      },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    return {
      ...this.serializeMission(mission),
      competencyStates: mission.competencyStates.map((item) => this.serializeCompetency(item)),
      plans: mission.plans.map((plan) => this.serializePlan(plan)),
      recentCheckIns: mission.checkIns.map((item) => this.serializeCheckIn(item)),
    };
  }

  async update(id: string, dto: UpdateMissionDto, userId: string) {
    const existing = await this.prisma.mission.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Mission not found');
    const roleTrackId = (dto.roleTrackId ?? existing.roleTrackId) as CareerRoleTrackId;
    this.getRoleTrack(roleTrackId);
    await this.ensureReferences(dto.careerGoalId, dto.jobApplicationId, userId, roleTrackId);
    const mission = await this.prisma.mission.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.summary !== undefined && { summary: this.cleanNullable(dto.summary) }),
        ...(dto.sourceType !== undefined && { sourceType: dto.sourceType }),
        ...(dto.roleTrackId !== undefined && { roleTrackId: dto.roleTrackId }),
        ...(dto.careerGoalId !== undefined && { careerGoalId: dto.careerGoalId }),
        ...(dto.jobApplicationId !== undefined && { jobApplicationId: dto.jobApplicationId }),
        ...(dto.targetDate !== undefined && { targetDate: this.parseDate(dto.targetDate) }),
        ...(dto.weeklyHours !== undefined && { weeklyHours: dto.weeklyHours }),
        ...(dto.successDefinition !== undefined && { successDefinition: this.cleanNullable(dto.successDefinition) }),
        ...(dto.stage !== undefined && { stage: dto.stage }),
        ...(dto.diagnosisSummary !== undefined && { diagnosisSummary: this.cleanNullable(dto.diagnosisSummary) }),
      },
      include: missionInclude,
    });
    await this.syncCompetencies(id, userId, roleTrackId);
    return this.serializeMission(mission);
  }

  async diagnose(id: string, userId: string) {
    const mission = await this.requireMission(id, userId);
    const roleTrackId = mission.roleTrackId as CareerRoleTrackId;
    const checklist = CAREER_ROLE_TRACKS[roleTrackId].checklist;
    await this.syncCompetencies(id, userId, roleTrackId);

    const [profile, evidences, tasks, attempts] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.learningEvidence.findMany({
        where: {
          userId,
          OR: [
            { missionId: id },
            { jobApplicationId: mission.jobApplicationId },
            { roleTrackId },
          ],
        },
        orderBy: { occurredAt: 'desc' },
        take: 250,
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          status: 'done',
          OR: [
            { missionId: id },
            { jobApplicationId: mission.jobApplicationId },
            { roleTrackId },
          ],
        },
        orderBy: { completedAt: 'desc' },
        take: 150,
      }),
      this.prisma.answerAttempt.findMany({
        where: { userId },
        include: {
          question: { select: { roleTags: true, areaTags: true, title: true } },
          session: { select: { missionId: true, roleTrackId: true, area: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    ]);

    const profileText = this.profileText(profile);
    const jobText = `${mission.jobApplication?.company ?? ''} ${mission.jobApplication?.roleTitle ?? ''} ${(mission.summary ?? '')}`;
    const updates = checklist.map((item) => {
      const itemKeywords = item.keywords.map((keyword) => keyword.toLowerCase());
      const evidenceMatches = evidences.filter((entry) => this.matchesEvidence(entry, roleTrackId, item.area, itemKeywords));
      const taskMatches = tasks.filter((task) => this.matchesTask(task, roleTrackId, item.area, itemKeywords));
      const attemptMatches = attempts.filter((attempt) => this.matchesAttempt(attempt, id, roleTrackId, item.area));
      const profileHits = this.countKeywordHits(profileText, itemKeywords);
      const jobHits = this.countKeywordHits(jobText.toLowerCase(), itemKeywords);
      const evidenceCount = evidenceMatches.length + taskMatches.length + attemptMatches.length + (profileHits > 0 ? 1 : 0);
      const currentLevel = this.currentLevel(item.evidenceType, evidenceMatches.length, taskMatches.length, attemptMatches.length, profileHits);
      const status = currentLevel >= 3 ? 'ready' : currentLevel > 0 ? 'building' : 'missing';
      const confidence = Math.min(100, currentLevel * 25 + evidenceCount * 10 + Math.min(jobHits, 3) * 5);
      const rationale = currentLevel === 0
        ? `Missing recent evidence for ${item.title}.`
        : jobHits > 0
          ? `Target job emphasizes ${item.keywords.slice(0, 2).join(', ')}.`
          : `Evidence is building for ${item.title}.`;
      return {
        checklistItemId: item.id,
        roleTrackId,
        area: item.area,
        title: item.title,
        description: item.description,
        evidenceType: item.evidenceType,
        weight: item.weight,
        targetLevel: 3,
        currentLevel,
        confidence,
        status,
        rationale,
        evidenceCount,
        lastEvidenceAt: this.lastEvidenceAt(evidenceMatches, taskMatches, attemptMatches),
      };
    });

    await this.prisma.$transaction([
      ...updates.map((update) => this.prisma.missionCompetencyState.updateMany({
        where: { missionId: id, checklistItemId: update.checklistItemId },
        data: update,
      })),
      this.prisma.mission.update({
        where: { id },
        data: {
          stage: 'weekly_plan',
          diagnosisSummary: this.buildDiagnosisSummary(updates),
        },
      }),
    ]);

    return this.get(id, userId);
  }

  async generatePlan(id: string, userId: string) {
    const diagnosed = await this.diagnose(id, userId);
    const gapStates = diagnosed.competencyStates
      .filter((item) => item.status !== 'ready')
      .sort((left, right) => right.weight - left.weight || left.currentLevel - right.currentLevel)
      .slice(0, 4);
    const weekStart = this.startOfDay(new Date());
    const weekEnd = this.startOfDay(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000));
    const focusSummary = gapStates.length
      ? `Focus on ${gapStates.slice(0, 2).map((item) => item.title).join(' and ')} this week.`
      : 'Maintain interview rhythm and review finished competencies.';

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.weeklyPlan.updateMany({
        where: { missionId: id, status: 'active' },
        data: { status: 'archived' },
      });

      const createdPlan = await tx.weeklyPlan.create({
        data: {
          userId,
          missionId: id,
          weekStart,
          weekEnd,
          focusSummary,
          generatedFromDiagnosis: diagnosed.diagnosisSummary,
          totalPlannedHours: diagnosed.weeklyHours,
        },
      });

      const itemTemplates = this.buildPlanTemplates(diagnosed, gapStates);
      for (const [index, template] of itemTemplates.entries()) {
        const scheduledFor = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
        const task = await tx.task.create({
          data: {
            userId,
            missionId: id,
            jobApplicationId: diagnosed.jobApplicationId,
            roleTrackId: diagnosed.roleTrackId,
            area: template.area,
            title: template.title,
            notes: template.description,
            type: template.taskType,
            priority: index < 2 ? 'high' : 'medium',
            plannedFor: scheduledFor,
            dueDate: scheduledFor,
            reminderOffsetMinutes: 60,
          },
        });
        await tx.planItem.create({
          data: {
            userId,
            planId: createdPlan.id,
            missionId: id,
            taskId: task.id,
            title: template.title,
            description: template.description,
            type: template.type,
            roleTrackId: diagnosed.roleTrackId,
            area: template.area,
            estimatedMinutes: template.estimatedMinutes,
            expectedArtifact: template.expectedArtifact,
            scheduledFor,
          },
        });
      }

      return tx.weeklyPlan.findUniqueOrThrow({ where: { id: createdPlan.id }, include: planInclude });
    });

    await this.prisma.mission.update({
      where: { id },
      data: { activePlanId: plan.id, stage: 'execute' },
    });

    return this.serializePlan(plan);
  }

  async today(id: string, userId: string) {
    const mission = await this.requireMission(id, userId);
    const [activePlan, dueTasks, recentEvidence, topCompetencies] = await Promise.all([
      mission.activePlanId
        ? this.prisma.weeklyPlan.findFirst({ where: { id: mission.activePlanId, missionId: id, userId }, include: planInclude })
        : this.prisma.weeklyPlan.findFirst({ where: { missionId: id, userId, status: 'active' }, include: planInclude, orderBy: { weekStart: 'desc' } }),
      this.prisma.task.findMany({
        where: {
          userId,
          missionId: id,
          status: { not: 'done' },
          OR: [{ plannedFor: { lte: new Date() } }, { dueDate: { lte: new Date() } }],
        },
        include: { topic: { select: { id: true, name: true } }, jobApplication: { select: { id: true, company: true, roleTitle: true, status: true } } },
        orderBy: [{ dueDate: 'asc' }, { plannedFor: 'asc' }],
        take: 8,
      }),
      this.prisma.learningEvidence.findMany({
        where: { userId, OR: [{ missionId: id }, { roleTrackId: mission.roleTrackId }] },
        orderBy: { occurredAt: 'desc' },
        take: 6,
      }),
      this.prisma.missionCompetencyState.findMany({
        where: { missionId: id },
        orderBy: [{ status: 'asc' }, { weight: 'desc' }, { currentLevel: 'asc' }],
        take: 4,
      }),
    ]);

    return {
      mission: this.serializeMission(mission),
      activePlan: activePlan ? this.serializePlan(activePlan) : null,
      dueTasks: dueTasks.map((task) => this.serializeTask(task)),
      recentEvidence: recentEvidence.map((evidence) => this.serializeEvidence(evidence)),
      topCompetencies: topCompetencies.map((item) => this.serializeCompetency(item)),
    };
  }

  async createCheckIn(id: string, dto: CreateCheckInDto, userId: string) {
    await this.requireMission(id, userId);
    const item = await this.prisma.missionCheckIn.create({
      data: {
        userId,
        missionId: id,
        summary: dto.summary.trim(),
        wins: this.cleanNullable(dto.wins),
        blockers: this.cleanNullable(dto.blockers),
        adjustments: this.cleanNullable(dto.adjustments),
      },
    });
    return this.serializeCheckIn(item);
  }

  async reviewPlan(id: string, dto: ReviewPlanDto, userId: string) {
    const plan = await this.prisma.weeklyPlan.findFirst({
      where: { id, userId },
      include: { items: { include: { task: true } } },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    await this.prisma.$transaction(async (tx) => {
      for (const item of plan.items) {
        if (item.task?.status === 'done' && item.status !== 'done') {
          await tx.planItem.update({
            where: { id: item.id },
            data: { status: 'done', completedAt: item.task.completedAt ?? new Date() },
          });
        }
      }

      const refreshed = await tx.planItem.findMany({ where: { planId: id } });
      const finished = refreshed.filter((item) => item.status === 'done' || item.status === 'skipped').length;
      const nextStatus = finished === refreshed.length && refreshed.length > 0 ? 'completed' : 'active';

      await tx.weeklyPlan.update({
        where: { id },
        data: { status: nextStatus },
      });
      await tx.mission.update({
        where: { id: plan.missionId },
        data: { stage: nextStatus === 'completed' ? 'retrospective' : 'execute' },
      });
      await tx.missionCheckIn.create({
        data: {
          userId,
          missionId: plan.missionId,
          summary: dto.summary?.trim() || `Plan review: completed ${finished}/${refreshed.length} items.`,
          wins: this.cleanNullable(dto.wins),
          blockers: this.cleanNullable(dto.blockers),
          adjustments: this.cleanNullable(dto.adjustments),
        },
      });
    });

    const refreshed = await this.prisma.weeklyPlan.findUniqueOrThrow({ where: { id }, include: planInclude });
    return this.serializePlan(refreshed);
  }

  private async requireMission(id: string, userId: string) {
    const mission = await this.prisma.mission.findFirst({ where: { id, userId }, include: missionInclude });
    if (!mission) throw new NotFoundException('Mission not found');
    return mission;
  }

  private async ensureReferences(careerGoalId: string | null | undefined, jobApplicationId: string | null | undefined, userId: string, roleTrackId: CareerRoleTrackId) {
    if (careerGoalId) {
      const goal = await this.prisma.careerGoal.findFirst({ where: { id: careerGoalId, userId } });
      if (!goal) throw new BadRequestException('Career goal not found');
      if (goal.roleTrackId !== roleTrackId) throw new BadRequestException('Career goal role track mismatch');
    }
    if (jobApplicationId) {
      const job = await this.prisma.jobApplication.findFirst({ where: { id: jobApplicationId, userId } });
      if (!job) throw new BadRequestException('Job application not found');
    }
  }

  private async syncCompetencies(missionId: string, userId: string, roleTrackId: CareerRoleTrackId) {
    const checklist = CAREER_ROLE_TRACKS[roleTrackId].checklist;
    await this.prisma.$transaction(checklist.map((item) => this.prisma.missionCompetencyState.upsert({
      where: { missionId_checklistItemId: { missionId, checklistItemId: item.id } },
      update: {
        roleTrackId,
        area: item.area,
        title: item.title,
        description: item.description,
        evidenceType: item.evidenceType,
        weight: item.weight,
      },
      create: {
        userId,
        missionId,
        checklistItemId: item.id,
        roleTrackId,
        area: item.area,
        title: item.title,
        description: item.description,
        evidenceType: item.evidenceType,
        weight: item.weight,
      },
    })));
  }

  private buildDiagnosisSummary(states: Array<{ title: string; status: string; currentLevel: number; evidenceCount: number }>) {
    const gaps = states
      .filter((item) => item.status !== 'ready')
      .sort((left, right) => left.currentLevel - right.currentLevel || right.evidenceCount - left.evidenceCount)
      .slice(0, 3)
      .map((item) => item.title);
    return gaps.length ? `Top gaps: ${gaps.join(', ')}.` : 'Current mission is broadly covered. Maintain repetition and interview rhythm.';
  }

  private buildPlanTemplates(
    mission: { roleTrackId: CareerRoleTrackId; jobApplicationId: string | null; competencyStates: Array<{ title: string; description: string | null; area: string | null; evidenceType: string; }>; weeklyHours: number },
    gaps: Array<{ title: string; description: string; area: string; evidenceType: string }>,
  ) {
    const items = gaps.map((gap, index) => {
      const type = this.planTypeForEvidence(gap.evidenceType);
      return {
        title: `${this.planTitlePrefix(type)} ${gap.title}`,
        description: gap.description,
        type,
        taskType: this.taskTypeForPlanType(type),
        area: gap.area as PlanItemResponse['area'],
        estimatedMinutes: index === 0 ? 120 : 90,
        expectedArtifact: this.expectedArtifact(type, gap.title),
      };
    });
    items.push({
      title: 'Review this week and update the mission',
      description: 'Capture what improved, what blocked you, and what should change next week.',
      type: 'review',
      taskType: 'review',
      area: null,
      estimatedMinutes: 45,
      expectedArtifact: 'Mission check-in and next-week adjustment',
    });
    const cap = Math.max(3, Math.min(items.length, Math.ceil(mission.weeklyHours / 2)));
    return items.slice(0, cap);
  }

  private currentLevel(evidenceType: string, evidenceMatches: number, taskMatches: number, attemptMatches: number, profileHits: number) {
    if (evidenceType === 'practice') {
      if (attemptMatches >= 4 || taskMatches >= 3) return 3;
      if (attemptMatches >= 2 || taskMatches >= 1) return 2;
      return attemptMatches + taskMatches > 0 ? 1 : 0;
    }
    if (evidenceType === 'project') {
      if (evidenceMatches >= 2 || taskMatches >= 2) return 3;
      if (evidenceMatches + taskMatches >= 1) return 2;
      return 0;
    }
    if (evidenceType === 'profile') {
      if (profileHits >= 3) return 3;
      if (profileHits >= 1) return 2;
      return 0;
    }
    if (evidenceType === 'job') return taskMatches > 0 ? 2 : 0;
    if (evidenceMatches >= 3) return 3;
    if (evidenceMatches >= 1 || profileHits >= 1) return 2;
    return 0;
  }

  private matchesEvidence(evidence: { roleTrackId: string | null; area: string | null; title: string; body: string | null; metadata: Prisma.JsonValue }, roleTrackId: string, area: string, keywords: string[]) {
    const text = `${evidence.title} ${evidence.body ?? ''} ${JSON.stringify(evidence.metadata)}`.toLowerCase();
    return (evidence.roleTrackId === null || evidence.roleTrackId === roleTrackId) &&
      (evidence.area === null || evidence.area === area) &&
      keywords.some((keyword) => text.includes(keyword));
  }

  private matchesTask(task: Task, roleTrackId: string, area: string, keywords: string[]) {
    const text = `${task.title} ${task.notes ?? ''}`.toLowerCase();
    return (task.roleTrackId === null || task.roleTrackId === roleTrackId) &&
      (task.area === null || task.area === area) &&
      keywords.some((keyword) => text.includes(keyword));
  }

  private matchesAttempt(
    attempt: Prisma.AnswerAttemptGetPayload<{ include: { question: { select: { roleTags: true; areaTags: true; title: true } }; session: { select: { missionId: true; roleTrackId: true; area: true } } } }>,
    missionId: string,
    roleTrackId: string,
    area: string,
  ) {
    const roleTags = this.asStringArray(attempt.question.roleTags);
    const areaTags = this.asStringArray(attempt.question.areaTags);
    const inMission = attempt.session?.missionId === missionId;
    const roleMatch = inMission || roleTags.length === 0 || roleTags.includes(roleTrackId) || attempt.session?.roleTrackId === roleTrackId;
    const areaMatch = areaTags.length === 0 || areaTags.includes(area) || attempt.session?.area === area;
    // 'partial' correctness (a valid, reachable CreateAnswerDto value) means attempted-but-
    // not-there-yet, not a clean/strong result — excluded here to match the same
    // solved/positive semantics as career.service.ts's isPositiveAttempt and
    // dsa.service.ts's isSolvedAttempt.
    const positive = (attempt.rubricScore ?? 0) >= 0.6 || (attempt.aiScore ?? 0) >= 0.6 || (attempt.selfRating ?? 0) >= 3 || ['correct', 'strong'].includes((attempt.correctness ?? '').toLowerCase());
    return roleMatch && areaMatch && positive;
  }

  private lastEvidenceAt(
    evidences: Array<{ occurredAt: Date }>,
    tasks: Array<{ completedAt: Date | null; updatedAt: Date }>,
    attempts: Array<{ createdAt: Date }>,
  ) {
    const candidates = [
      ...evidences.map((item) => item.occurredAt.getTime()),
      ...tasks.map((item) => (item.completedAt ?? item.updatedAt).getTime()),
      ...attempts.map((item) => item.createdAt.getTime()),
    ];
    return candidates.length ? new Date(Math.max(...candidates)) : null;
  }

  private planTypeForEvidence(evidenceType: string): 'learn' | 'practice' | 'build' | 'apply' | 'review' {
    if (evidenceType === 'project') return 'build';
    if (evidenceType === 'job') return 'apply';
    if (evidenceType === 'learning' || evidenceType === 'profile') return 'learn';
    return 'practice';
  }

  private taskTypeForPlanType(type: 'learn' | 'practice' | 'build' | 'apply' | 'review') {
    if (type === 'learn') return 'reading';
    if (type === 'build') return 'project';
    if (type === 'apply') return 'application';
    if (type === 'review') return 'review';
    return 'practice';
  }

  private planTitlePrefix(type: 'learn' | 'practice' | 'build' | 'apply' | 'review') {
    if (type === 'learn') return 'Study';
    if (type === 'build') return 'Build proof for';
    if (type === 'apply') return 'Advance';
    return 'Practice';
  }

  private expectedArtifact(type: 'learn' | 'practice' | 'build' | 'apply' | 'review', title: string) {
    if (type === 'learn') return `Reviewed notes mapped to ${title}`;
    if (type === 'build') return `Project artifact or commit proving ${title}`;
    if (type === 'apply') return `Application or round update for ${title}`;
    if (type === 'review') return 'Weekly retrospective';
    return `Solved set or written answer for ${title}`;
  }

  private serializeMission(mission: MissionRecord | (Mission & { jobApplication?: MissionRecord['jobApplication'] | null })) {
    const roleTrack = this.getRoleTrack(mission.roleTrackId as CareerRoleTrackId);
    return {
      id: mission.id,
      userId: mission.userId,
      name: mission.name,
      summary: mission.summary,
      sourceType: mission.sourceType as 'manual' | 'career_goal' | 'job_application',
      stage: mission.stage as 'diagnose' | 'weekly_plan' | 'execute' | 'interview' | 'retrospective' | 'archived',
      roleTrackId: roleTrack.id,
      roleTrack,
      careerGoalId: mission.careerGoalId,
      jobApplicationId: mission.jobApplicationId,
      jobApplication: mission.jobApplication
        ? {
            ...mission.jobApplication,
            status: mission.jobApplication.status as 'saved' | 'applied' | 'oa' | 'interview' | 'onsite' | 'offer' | 'rejected' | 'withdrawn',
            deadline: mission.jobApplication.deadline?.toISOString().slice(0, 10) ?? null,
          }
        : null,
      targetDate: mission.targetDate?.toISOString().slice(0, 10) ?? null,
      weeklyHours: mission.weeklyHours,
      successDefinition: mission.successDefinition,
      diagnosisSummary: mission.diagnosisSummary,
      activePlanId: mission.activePlanId,
      createdAt: mission.createdAt.toISOString(),
      updatedAt: mission.updatedAt.toISOString(),
    };
  }

  private serializeCompetency(item: MissionCompetencyState) {
    return {
      id: item.id,
      missionId: item.missionId,
      checklistItemId: item.checklistItemId,
      roleTrackId: item.roleTrackId as CareerRoleTrackId,
      area: item.area as CareerRoleTrack['checklist'][number]['area'],
      title: item.title,
      description: item.description,
      evidenceType: item.evidenceType as 'practice' | 'learning' | 'project' | 'profile' | 'job',
      weight: item.weight,
      targetLevel: item.targetLevel,
      currentLevel: item.currentLevel,
      confidence: item.confidence,
      status: item.status as 'missing' | 'building' | 'ready',
      rationale: item.rationale,
      evidenceCount: item.evidenceCount,
      lastEvidenceAt: item.lastEvidenceAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private serializePlan(plan: PlanRecord | (WeeklyPlan & { items?: PlanItem[] })) : WeeklyPlanResponse {
    return {
      id: plan.id,
      missionId: plan.missionId,
      weekStart: plan.weekStart.toISOString().slice(0, 10),
      weekEnd: plan.weekEnd.toISOString().slice(0, 10),
      status: plan.status as WeeklyPlanResponse['status'],
      focusSummary: plan.focusSummary,
      generatedFromDiagnosis: plan.generatedFromDiagnosis,
      totalPlannedHours: plan.totalPlannedHours,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      items: (plan.items ?? []).map((item) => this.serializePlanItem(item)),
    };
  }

  private serializePlanItem(item: PlanItem) {
    return {
      id: item.id,
      planId: item.planId,
      missionId: item.missionId,
      taskId: item.taskId,
      title: item.title,
      description: item.description,
      type: item.type as PlanItemResponse['type'],
      status: item.status as PlanItemResponse['status'],
      roleTrackId: item.roleTrackId as PlanItemResponse['roleTrackId'],
      area: item.area as PlanItemResponse['area'],
      estimatedMinutes: item.estimatedMinutes,
      expectedArtifact: item.expectedArtifact,
      scheduledFor: item.scheduledFor?.toISOString() ?? null,
      completedAt: item.completedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private serializeCheckIn(item: MissionCheckIn) {
    return {
      id: item.id,
      missionId: item.missionId,
      summary: item.summary,
      wins: item.wins,
      blockers: item.blockers,
      adjustments: item.adjustments,
      checkInAt: item.checkInAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    };
  }

  private serializeTask(task: Prisma.TaskGetPayload<{ include: { topic: { select: { id: true; name: true } }; jobApplication: { select: { id: true; company: true; roleTitle: true; status: true } } } }>) {
    return {
      id: task.id,
      userId: task.userId,
      title: task.title,
      notes: task.notes,
      type: task.type,
      status: task.status,
      priority: task.priority,
      roleTrackId: task.roleTrackId as CareerRoleTrackId | null,
      area: task.area as PlanItemResponse['area'],
      topicId: task.topicId,
      topic: task.topic,
      jobApplicationId: task.jobApplicationId,
      missionId: task.missionId,
      jobApplication: task.jobApplication ? { ...task.jobApplication, status: task.jobApplication.status as 'saved' | 'applied' | 'oa' | 'interview' | 'onsite' | 'offer' | 'rejected' | 'withdrawn' } : null,
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

  private serializeEvidence(evidence: Prisma.LearningEvidenceGetPayload<{}>) {
    return {
      id: evidence.id,
      userId: evidence.userId,
      type: evidence.type,
      title: evidence.title,
      body: evidence.body,
      roleTrackId: evidence.roleTrackId as CareerRoleTrackId | null,
      area: evidence.area as PlanItemResponse['area'],
      topicId: evidence.topicId,
      sourceId: evidence.sourceId,
      highlightId: evidence.highlightId,
      taskId: evidence.taskId,
      questionId: evidence.questionId,
      jobApplicationId: evidence.jobApplicationId,
      missionId: evidence.missionId,
      metadata: this.asRecord(evidence.metadata),
      occurredAt: evidence.occurredAt.toISOString(),
      createdAt: evidence.createdAt.toISOString(),
    };
  }

  private profileText(profile: { skills: Prisma.JsonValue; experience: Prisma.JsonValue; projects: Prisma.JsonValue; rawCvText: string | null } | null) {
    if (!profile) return '';
    return `${profile.rawCvText ?? ''} ${JSON.stringify(profile.skills)} ${JSON.stringify(profile.experience)} ${JSON.stringify(profile.projects)}`.toLowerCase();
  }

  private countKeywordHits(text: string, keywords: string[]) {
    return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
  }

  private asStringArray(value: Prisma.JsonValue) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private getRoleTrack(roleTrackId: CareerRoleTrackId) {
    const roleTrack = CAREER_ROLE_TRACKS[roleTrackId];
    if (!roleTrack) throw new BadRequestException('Unknown role track');
    return roleTrack;
  }

  private startOfDay(date: Date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private parseDate(value: string | null | undefined) {
    if (value === undefined || value === null) return value;
    return new Date(`${value}T00:00:00.000Z`);
  }

  private cleanNullable(value: string | null | undefined) {
    if (value === undefined || value === null) return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
