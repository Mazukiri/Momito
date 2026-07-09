import { Injectable } from '@nestjs/common';
import { INTERVIEW_ROUND_TYPE_LABELS, PracticeRecommendationResponse } from '@momito/shared';
import { CareerService } from '../career/career.service';
import { MissionsService } from '../missions/missions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WeaknessesService } from '../weaknesses/weaknesses.service';

// MOM-033: standardized reason taxonomy (plan §6.2 wants every recommendation to
// explain, in a complete sentence, why it appears — not a mix of phrases and
// interpolated fragments). This module already had a `reason` field; this only
// normalizes the text it's populated with.
const RECOMMENDATION_REASONS = {
  activeMission: (name: string) => `"${name}" is an active mission that needs weekly execution.`,
  overdueTask: () => 'This task is overdue.',
  readinessGap: (roleTrackLabel: string) => `This closes a readiness gap for ${roleTrackLabel}.`,
  jobDeadline: () => 'This job application has an upcoming deadline.',
  jobActive: () => 'This is an active job application in your pipeline.',
  unreviewedHighlights: (count: number) =>
    `You have ${count} unreviewed learning highlight${count === 1 ? '' : 's'} waiting in your inbox.`,
  // Plan §6.2's example wording ("You failed 2 sliding-window questions
  // recently") — a weakness recommendation names the exact signal and count.
  weakReason: (label: string, count: number) =>
    `You logged "${label}" on ${count} recent attempt${count === 1 ? '' : 's'}.`,
  weakArea: (label: string, struggles: number) =>
    `You struggled with ${struggles} ${label} question${struggles === 1 ? '' : 's'} recently.`,
  // MOM-142: an interview-grounded signal (a debrief / manual entry) explains its
  // provenance so the user trusts why it outranks derived struggle patterns.
  weaknessSignal: (source: string, occurrences: number) => {
    const times = occurrences > 1 ? ` (flagged ${occurrences}×)` : '';
    if (source === 'debrief') return `An interview debrief flagged this weakness${times}.`;
    if (source === 'manual') return `You flagged this weakness to repair${times}.`;
    return `A recurring weakness surfaced from your recent attempts${times}.`;
  },
  // MOM-141: a scheduled interview round counts down toward its date so the
  // sharpest prep floats to the top of Today as the interview approaches.
  interviewCountdown: (roundLabel: string, days: number) => {
    if (days <= 0) return `Your ${roundLabel} round is today — do a final review.`;
    if (days === 1) return `Your ${roundLabel} round is tomorrow — lock in your prep.`;
    return `Your ${roundLabel} round is in ${days} days — build your prep queue now.`;
  },
};

// MOM-141: how far ahead an interview round starts appearing on Today. Rounds
// further out than this aren't urgent enough to outrank day-to-day study.
const INTERVIEW_COUNTDOWN_WINDOW_DAYS = 14;

// A weak signal needs at least this many struggles before it drives a
// recommendation — one bad attempt is noise, not a pattern.
const WEAKNESS_MIN_COUNT = 2;

// MOM-140-lite: a pipeline item's Today card should speak to the stage it's in.
// A saved lead reads "apply", an onsite reads "prep your onsite" with real
// urgency — instead of one generic "Prepare X" for every stage. This is copy +
// light stage-ranking only; the full interview-date countdown and auto-assembled
// prep queue are MOM-140/141 (migration-gated interview-round modeling).
const JOB_STAGE_CARD: Record<
  string,
  { title: (company: string, role: string) => string; reason: string; priority: number }
> = {
  saved: {
    title: (company, role) => `Apply to ${company} — ${role}`,
    reason: 'You saved this role but have not applied yet.',
    priority: 55,
  },
  applied: {
    title: (company, role) => `Follow up with ${company} — ${role}`,
    reason: 'Your application is in review — keep it warm.',
    priority: 62,
  },
  oa: {
    title: (company) => `Prep the ${company} online assessment`,
    reason: 'You are at the online-assessment stage — practice before it expires.',
    priority: 85,
  },
  interview: {
    title: (company) => `Prep for your ${company} interview`,
    reason: 'You are actively interviewing here.',
    priority: 88,
  },
  onsite: {
    title: (company) => `Prep for your ${company} onsite`,
    reason: 'You have an onsite for this role — the sharp end of the pipeline.',
    priority: 92,
  },
};

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly career: CareerService,
    private readonly missions: MissionsService,
    private readonly weaknesses: WeaknessesService,
  ) {}

  async list(userId: string): Promise<PracticeRecommendationResponse[]> {
    const now = new Date();
    const countdownHorizon = new Date(now.getTime() + INTERVIEW_COUNTDOWN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [readiness, activeMissions, overdueTasks, jobs, inboxCount, weaknessSummary, upcomingRounds] =
      await Promise.all([
        this.career.listActiveReadiness(userId),
        this.missions.list(userId),
        this.prisma.task.findMany({
          where: { userId, status: { not: 'done' }, dueDate: { lt: new Date() } },
          orderBy: { dueDate: 'asc' },
          take: 3,
        }),
        this.prisma.jobApplication.findMany({
          where: { userId, status: { in: ['saved', 'applied', 'oa', 'interview', 'onsite'] } },
          orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
          take: 3,
        }),
        this.prisma.learningHighlight.count({ where: { userId, isDeleted: false, reviewedAt: null } }),
        this.weaknesses.summary(userId),
        // MOM-141: interview rounds still ahead of us, scheduled within the countdown
        // window and not yet decided — these become the top-ranked Today cards.
        this.prisma.interviewRound.findMany({
          where: {
            userId,
            outcome: 'pending',
            scheduledAt: { gte: now, lte: countdownHorizon },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 3,
          include: { jobApplication: { select: { id: true, company: true } } },
        }),
      ]);

    const recommendations: PracticeRecommendationResponse[] = [];

    // MOM-141: a scheduled interview is the single most time-critical thing on the
    // board — an onsite in 3 days outranks every study card. Priority scales with
    // proximity (sooner = higher), landing at/above overdue tasks (100) so the
    // countdown always leads Today, and the card links to the job so tapping it
    // reaches the round + its auto-assembled prep queue.
    for (const round of upcomingRounds) {
      const scheduledAt = round.scheduledAt;
      if (!scheduledAt) continue;
      const daysUntil = Math.max(0, Math.ceil((scheduledAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.roundType as keyof typeof INTERVIEW_ROUND_TYPE_LABELS];
      const company = round.jobApplication?.company ?? 'your interview';
      const whenText = daysUntil <= 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
      recommendations.push({
        id: `round:${round.id}`,
        type: 'job',
        title: `Prep your ${company} ${roundLabel} ${whenText}`,
        reason: RECOMMENDATION_REASONS.interviewCountdown(roundLabel, daysUntil),
        roleTrackId: null,
        area: null,
        targetHref: `/jobs/${round.jobApplicationId}`,
        // 101–115: above overdue tasks (100); the nearer the round, the higher.
        priority: 101 + Math.max(0, INTERVIEW_COUNTDOWN_WINDOW_DAYS - daysUntil),
      });
    }

    // MOM-142: interview-grounded weaknesses come first. Open WeaknessSignals —
    // emitted by the MOM-113 debrief edge (or manual entry), stored and decayed by
    // MOM-127 — are first-class Today items ranked *above* derived struggle
    // patterns, because a bombed real round is stronger evidence than practice
    // noise. Severity (already decayed at read time) both orders them and nudges
    // priority. Their keys are recorded so the derived path below doesn't repeat them.
    const surfacedSignalKeys = new Set<string>();
    const openSignals = (weaknessSummary.openSignals ?? [])
      .slice()
      .sort((left, right) => right.severity - left.severity)
      .slice(0, 3);
    for (const signal of openSignals) {
      surfacedSignalKeys.add(signal.key);
      const isArea = signal.signalType === 'area' && Boolean(signal.area);
      recommendations.push({
        id: `signal:${signal.signalType}:${signal.key}:${signal.jobApplicationId ?? 'global'}`,
        type: 'practice',
        title: `Repair: ${signal.label}`,
        reason: RECOMMENDATION_REASONS.weaknessSignal(signal.source, signal.occurrences),
        roleTrackId: signal.roleTrackId as PracticeRecommendationResponse['roleTrackId'],
        area: (isArea ? signal.area : null) as PracticeRecommendationResponse['area'],
        targetHref: isArea
          ? `/practice/new?area=${signal.area}&mode=weak_area_review`
          : '/practice/new?mode=weak_area_review',
        // 95–99: at/above derived weakness (95), below overdue tasks (100).
        priority: 94 + Math.min(5, Math.max(1, Math.round(signal.severity))),
      });
    }

    // Plan §6.1 queue priority 3: weakness repair sits above readiness gaps
    // (80+) and below overdue tasks (100). Patterns/topics with repeated
    // struggles come first (they map directly to a repair session); a
    // repeated miss reason without an area (e.g. "time_pressure" across mixed
    // topics) still surfaces once so the signal is never silently dropped.
    const weakAreas = [...weaknessSummary.patterns, ...weaknessSummary.topics]
      .filter((area) => area.struggles >= WEAKNESS_MIN_COUNT && !surfacedSignalKeys.has(area.key))
      .sort((left, right) => right.struggles - left.struggles)
      .slice(0, 2);
    for (const area of weakAreas) {
      recommendations.push({
        id: `weakness:area:${area.key}`,
        type: 'practice',
        title: `Repair weak spot: ${area.label}`,
        reason: RECOMMENDATION_REASONS.weakArea(area.label, area.struggles),
        roleTrackId: null,
        area: null,
        targetHref: '/practice/new?mode=weak_area_review',
        priority: 95,
      });
    }
    if (weakAreas.length === 0) {
      const topReason = weaknessSummary.reasons.find(
        (reason) => reason.count >= WEAKNESS_MIN_COUNT && !surfacedSignalKeys.has(reason.reason),
      );
      if (topReason) {
        recommendations.push({
          id: `weakness:reason:${topReason.reason}`,
          type: 'practice',
          title: 'Repair a recurring mistake',
          reason: RECOMMENDATION_REASONS.weakReason(topReason.label, topReason.count),
          roleTrackId: null,
          area: null,
          targetHref: '/practice/new?mode=weak_area_review',
          priority: 95,
        });
      }
    }
    for (const mission of activeMissions.filter((item) => item.stage !== 'archived').slice(0, 2)) {
      recommendations.push({
        id: `mission:${mission.id}`,
        type: 'task',
        title: `Focus ${mission.name}`,
        reason: mission.diagnosisSummary ?? RECOMMENDATION_REASONS.activeMission(mission.name),
        roleTrackId: mission.roleTrackId,
        area: null,
        targetHref: `/missions/${mission.id}`,
        priority: 110,
      });
    }
    for (const task of overdueTasks) {
      recommendations.push({
        id: `task:${task.id}`,
        type: 'task',
        title: task.title,
        reason: RECOMMENDATION_REASONS.overdueTask(),
        roleTrackId: task.roleTrackId as PracticeRecommendationResponse['roleTrackId'],
        area: task.area as PracticeRecommendationResponse['area'],
        targetHref: task.missionId ? `/missions/${task.missionId}` : '/calendar',
        priority: 100,
      });
    }
    for (const role of readiness) {
      for (const gap of role.topGaps.slice(0, 2)) {
        recommendations.push({
          id: `gap:${role.roleTrackId}:${gap.id}`,
          type: gap.evidenceType === 'project' ? 'task' : 'practice',
          title: gap.evidenceType === 'project' ? `Build evidence for ${gap.title}` : `Practice ${gap.title}`,
          reason: RECOMMENDATION_REASONS.readinessGap(role.roleTrack.label),
          roleTrackId: role.roleTrackId,
          area: gap.area,
          targetHref: gap.evidenceType === 'project'
            ? `/calendar?roleTrackId=${role.roleTrackId}&area=${gap.area}`
            : `/practice/new?roleTrackId=${role.roleTrackId}&area=${gap.area}&mode=role_drill`,
          priority: 80 + gap.weight,
        });
      }
    }
    for (const job of jobs) {
      const card = JOB_STAGE_CARD[job.status] ?? {
        title: (company: string, role: string) => `Prepare ${company} ${role}`,
        reason: RECOMMENDATION_REASONS.jobActive(),
        priority: 60,
      };
      // An application deadline is only actionable-by-date while the job is still
      // a saved lead ("apply by Friday"); once applied it is moot, so from then on
      // the stage governs both the copy and the ranking.
      const deadlineUrgent = job.status === 'saved' && Boolean(job.deadline);
      recommendations.push({
        id: `job:${job.id}`,
        type: 'job',
        title: card.title(job.company, job.roleTitle),
        reason: deadlineUrgent ? RECOMMENDATION_REASONS.jobDeadline() : card.reason,
        roleTrackId: job.roleTrackId as PracticeRecommendationResponse['roleTrackId'],
        area: null,
        targetHref: `/jobs/${job.id}`,
        priority: deadlineUrgent ? 90 : card.priority,
      });
    }
    if (inboxCount > 0) {
      recommendations.push({
        id: 'readwise:inbox',
        type: 'reading',
        title: `Review ${inboxCount} Readwise highlight${inboxCount === 1 ? '' : 's'}`,
        reason: RECOMMENDATION_REASONS.unreviewedHighlights(inboxCount),
        roleTrackId: null,
        area: null,
        targetHref: '/learning/inbox',
        priority: 50,
      });
    }
    return recommendations.sort((left, right) => right.priority - left.priority).slice(0, 8);
  }
}
