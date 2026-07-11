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
  JobStoryGapResponse,
  RoleAreaReadiness,
  RoleChecklistItem,
  RoleReadinessResponse,
  STORY_COMPETENCIES,
  StoryGapCompetency,
  TargetShortlistFocusArea,
  TargetShortlistItem,
  TargetShortlistResponse,
  VisaTag,
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

// MOM-131: the near-universal behavioral-interview themes, used as the expected
// competency set when a role track's behavioral checklist doesn't name concrete
// STORY_COMPETENCIES ids in its keywords (e.g. infra's "incident/postmortem").
const DEFAULT_BEHAVIORAL_COMPETENCIES = ['ownership', 'conflict', 'ambiguity', 'failure'];

// MOM-125 targeting shortlist tuning. Sponsorship gates emigration, so it scales
// the whole score hard; a null status is treated as 'unknown' (some hope, unproven).
const SPONSORSHIP_FIT_MULTIPLIER: Record<VisaTag, number> = {
  sponsored: 1.0,
  unknown: 0.7,
  not_sponsoring: 0.2,
};
// A specific region the user hasn't shown interest in is a soft demerit only;
// 'Global'/null and regions already in their pipeline stay at full weight.
const REGION_MATCH_MULTIPLIER = 1.0;
const REGION_OFF_TARGET_MULTIPLIER = 0.85;
const GLOBAL_REGION = 'global';

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
      // MOM-122-followup: pull the linked company's focus weights so the verdict
      // reflects what THIS company emphasizes, not just the flat role checklist.
      select: {
        id: true,
        company: true,
        roleTitle: true,
        roleTrackId: true,
        companyRef: { select: { focusAreas: true, roleTrackIds: true } },
      },
    });
    if (!job) throw new NotFoundException('Job application not found');

    const focusAreas = this.asFocusAreas(job.companyRef?.focusAreas ?? null);
    const roleTrackId =
      (job.roleTrackId as CareerRoleTrackId | null) ??
      this.firstRoleTrack(job.companyRef?.roleTrackIds ?? null) ??
      DEFAULT_JOB_ROLE_TRACK;
    const [readiness, blockingSignals] = await Promise.all([
      this.getReadiness(roleTrackId, userId),
      this.weaknesses.listOpenSignals(userId, jobId),
    ]);

    // MOM-122-followup: when the job is linked to a catalog company, weight the
    // headline by that company's focus areas (a weak area the company drills hard
    // hurts more than one it barely tests). Unlinked → the role-checklist mean.
    // MOM-158: use the company-weighted headline only when the company's focus areas actually
    // intersect this role track's measured areas; otherwise fall back to the flat mean rather
    // than let a disjoint emphasis collapse the verdict to a false 0.
    const focusKeys = Object.keys(focusAreas);
    const weighted = focusKeys.length > 0 ? this.companyWeightedPercentage(readiness.areas, focusAreas) : null;
    const base = weighted ?? readiness.overallPercentage;
    const companyWeighted = weighted !== null;

    // Penalty from this job's open weakness signals, weighted by decayed severity.
    const rawPenalty = blockingSignals.reduce((sum, signal) => sum + signal.severity * SIGNAL_PENALTY_PER_SEVERITY, 0);
    const penalty = Math.min(SIGNAL_PENALTY_CAP, Math.round(rawPenalty));
    const score = Math.max(0, Math.min(100, base - penalty));
    const status: JobReadinessStatus = score >= READY_THRESHOLD ? 'ready' : score >= ALMOST_THRESHOLD ? 'almost' : 'not_ready';

    // The areas most in the way. When company-weighted, the company's emphasis
    // (focus weight × how far the area is from 100) orders the drag; otherwise
    // lowest grounded percentage first (weight breaks ties).
    const weakestAreas = [...readiness.areas]
      .sort((left, right) =>
        companyWeighted
          ? this.focusDrag(right, focusAreas) - this.focusDrag(left, focusAreas)
          : left.percentage - right.percentage || right.totalWeight - left.totalWeight,
      )
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

  // MOM-131: story coverage → this target's behavioral gap map. The role's
  // behavioral loop expects a set of STAR competencies; we check which the user's
  // story bank covers (by competencyTags) and surface the missing ones — so a
  // specific interview gets "you have ownership + conflict but no ambiguity story
  // for Meta" instead of a generic "practice behavioral". Role-scoped for now;
  // company-specific weighting enriches when the structured Company FK (MOM-121)
  // lands.
  async getJobStoryGaps(jobId: string, userId: string): Promise<JobStoryGapResponse> {
    const job = await this.prisma.jobApplication.findFirst({
      where: { id: jobId, userId },
      select: { id: true, company: true, roleTitle: true, roleTrackId: true, companyRef: { select: { roleTrackIds: true } } },
    });
    if (!job) throw new NotFoundException('Job application not found');

    // MOM-122-followup: a linked company's primary track sharpens the expected
    // competency set when the job itself has no explicit roleTrack.
    const roleTrackId =
      (job.roleTrackId as CareerRoleTrackId | null) ??
      this.firstRoleTrack(job.companyRef?.roleTrackIds ?? null) ??
      DEFAULT_JOB_ROLE_TRACK;
    const roleTrack = this.getRoleTrack(roleTrackId);
    const expectedIds = this.expectedBehavioralCompetencies(roleTrack);

    const stories = await this.prisma.story.findMany({ where: { userId }, select: { competencyTags: true } });
    // Count stories per competency (case-insensitive on the free-form tag).
    const countByCompetency = new Map<string, number>();
    for (const story of stories) {
      for (const tag of new Set(story.competencyTags.map((value) => value.toLowerCase()))) {
        countByCompetency.set(tag, (countByCompetency.get(tag) ?? 0) + 1);
      }
    }

    const competencies: StoryGapCompetency[] = expectedIds.map((id) => {
      const meta = STORY_COMPETENCIES.find((competency) => competency.id === id);
      const storyCount = countByCompetency.get(id) ?? 0;
      return { id, name: meta?.name ?? id, covered: storyCount > 0, storyCount };
    });

    const coveredCount = competencies.filter((competency) => competency.covered).length;
    return {
      jobApplicationId: job.id,
      company: job.company,
      roleTitle: job.roleTitle,
      roleTrackId,
      competencies,
      coveredCount,
      missingCount: competencies.length - coveredCount,
      totalStories: stories.length,
    };
  }

  // MOM-125: the targeting shortlist — "who should I apply to next?". Ranks catalog
  // companies by how well the user's grounded readiness (MOM-129) matches each
  // company's interview emphasis (MOM-121 focusAreas), scaled by whether the company
  // sponsors visas (the emigration gate) and by region preference. Reuses the same
  // focus-weighting as the "am I ready for Meta?" verdict, run across the catalog.
  async getTargetShortlist(userId: string): Promise<TargetShortlistResponse> {
    const [companies, linkedJobs] = await Promise.all([
      this.prisma.company.findMany({
        select: { id: true, name: true, region: true, focusAreas: true, roleTrackIds: true, sponsorshipStatus: true },
        orderBy: { name: 'asc' },
      }),
      // Region preference is inferred from the user's existing pipeline: the regions
      // of companies they've already linked jobs to. No pipeline → no preference.
      this.prisma.jobApplication.findMany({
        where: { userId, companyId: { not: null } },
        select: { companyRef: { select: { region: true } } },
      }),
    ]);

    const preferredRegions = new Set(
      linkedJobs
        .map((job) => job.companyRef?.region?.trim().toLowerCase())
        .filter((region): region is string => Boolean(region) && region !== GLOBAL_REGION),
    );

    // Memoize grounded readiness per distinct role track (companies share tracks, so
    // this is a handful of computations, not one heavy evidence load per company).
    const readinessByTrack = new Map<CareerRoleTrackId, RoleReadinessResponse>();
    const trackReadiness = async (trackId: CareerRoleTrackId) => {
      const cached = readinessByTrack.get(trackId);
      if (cached) return cached;
      const computed = await this.getReadiness(trackId, userId);
      readinessByTrack.set(trackId, computed);
      return computed;
    };

    const items: TargetShortlistItem[] = [];
    for (const company of companies) {
      const focusAreas = this.asFocusAreas(company.focusAreas);
      if (Object.keys(focusAreas).length === 0) continue; // can't score fit without an emphasis

      const roleTrackId = this.firstRoleTrack(company.roleTrackIds) ?? DEFAULT_JOB_ROLE_TRACK;
      const readiness = await trackReadiness(roleTrackId);
      // MOM-158: a company whose focus areas don't intersect its role track ranks on flat
      // readiness rather than a false 0 fit that would bury it at the bottom of the shortlist.
      const fitScore = this.companyWeightedPercentage(readiness.areas, focusAreas) ?? readiness.overallPercentage;

      const sponsorship = (company.sponsorshipStatus as VisaTag | null) ?? 'unknown';
      const sponsorshipMultiplier = SPONSORSHIP_FIT_MULTIPLIER[sponsorship];
      const regionMultiplier = this.regionMultiplier(company.region, preferredRegions);
      const score = Math.round(fitScore * sponsorshipMultiplier * regionMultiplier);

      const percentageByArea = new Map(readiness.areas.map((area) => [area.area, area.percentage]));
      const topFocusAreas: TargetShortlistFocusArea[] = Object.entries(focusAreas)
        .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
        .slice(0, 3)
        .map(([area, weight]) => ({
          area: area as CareerRoleAreaId,
          weight: weight ?? 0,
          percentage: percentageByArea.get(area as CareerRoleAreaId) ?? 0,
        }));

      items.push({
        companyId: company.id,
        name: company.name,
        region: company.region,
        sponsorshipStatus: company.sponsorshipStatus as VisaTag | null,
        roleTrackId,
        fitScore,
        sponsorshipMultiplier,
        regionMultiplier,
        score,
        topFocusAreas,
        reason: this.shortlistReason(fitScore, sponsorship, topFocusAreas),
      });
    }

    items.sort((left, right) => right.score - left.score || right.fitScore - left.fitScore || left.name.localeCompare(right.name));
    return { items, preferredRegions: [...preferredRegions] };
  }

  // 'Global'/null regions and regions already in the user's pipeline stay at full
  // weight; a specific off-target region is a soft demerit. With no pipeline signal
  // at all, nothing is penalized (we don't guess a preference).
  private regionMultiplier(region: string | null, preferred: Set<string>): number {
    const normalized = region?.trim().toLowerCase();
    if (!normalized || normalized === GLOBAL_REGION || preferred.size === 0) return REGION_MATCH_MULTIPLIER;
    return preferred.has(normalized) ? REGION_MATCH_MULTIPLIER : REGION_OFF_TARGET_MULTIPLIER;
  }

  private shortlistReason(fitScore: number, sponsorship: VisaTag, topFocusAreas: TargetShortlistFocusArea[]): string {
    const sponsorshipPhrase =
      sponsorship === 'sponsored' ? 'sponsors visas' : sponsorship === 'not_sponsoring' ? 'no sponsorship' : 'sponsorship unknown';
    const focus = topFocusAreas[0];
    const focusPhrase = focus ? `drills ${focus.area.replace(/_/g, ' ')} — you're at ${focus.percentage}%` : 'general fit';
    return `${fitScore}% focus-weighted readiness · ${sponsorshipPhrase} · ${focusPhrase}`;
  }

  // The behavioral competencies a role's loop expects: the concrete
  // STORY_COMPETENCIES ids named in its behavioral checklist keywords, or the
  // universal default set when the track names none.
  private expectedBehavioralCompetencies(roleTrack: CareerRoleTrack): string[] {
    const keywords = new Set(
      roleTrack.checklist
        .filter((item) => item.area === 'behavioral')
        .flatMap((item) => item.keywords.map((keyword) => keyword.toLowerCase())),
    );
    const named = STORY_COMPETENCIES.filter((competency) => keywords.has(competency.id)).map((competency) => competency.id);
    return named.length > 0 ? named : DEFAULT_BEHAVIORAL_COMPETENCIES;
  }

  // MOM-122-followup: the focus-weighted mean of area percentages (over the areas
  // the company actually emphasizes), so "ready for Meta?" reflects Meta's bar.
  // MOM-158: returns null — NOT 0 — when none of the company's focus areas intersect the role
  // track's measured areas. A company's focusAreas (MOM-121 seed) is validated against
  // CAREER_ROLE_AREA_IDS, but NOT against the chosen role track's checklist areas, so the two can
  // be disjoint (a user tags a job with a track that doesn't cover what the company drills). When
  // that happens there is no basis to weight, and returning a hard 0 was a bug: it reported a
  // strong candidate as "0/100, not ready". Callers fall back to the flat overall percentage.
  private companyWeightedPercentage(areas: RoleAreaReadiness[], focusAreas: Record<string, number>): number | null {
    const weightSum = areas.reduce((sum, area) => sum + (focusAreas[area.area] ?? 0), 0);
    if (weightSum <= 0) return null;
    return Math.round(areas.reduce((sum, area) => sum + area.percentage * (focusAreas[area.area] ?? 0), 0) / weightSum);
  }

  // How much an area drags a company-scoped verdict: its focus weight × distance
  // from mastery. A weak area the company drills hard rises to the top.
  private focusDrag(area: RoleAreaReadiness, focusAreas: Record<string, number>): number {
    return (focusAreas[area.area] ?? 0) * (100 - area.percentage);
  }

  private firstRoleTrack(value: Prisma.JsonValue | null): CareerRoleTrackId | null {
    if (!Array.isArray(value)) return null;
    const first = value.find((item): item is string => typeof item === 'string' && item in CAREER_ROLE_TRACKS);
    return (first as CareerRoleTrackId | undefined) ?? null;
  }

  private asFocusAreas(value: Prisma.JsonValue | null): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [area, weight] of Object.entries(value)) {
      if (typeof weight === 'number') out[area] = weight;
    }
    return out;
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
