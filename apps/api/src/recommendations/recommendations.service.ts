import { Injectable } from '@nestjs/common';
import { PracticeRecommendationResponse } from '@momito/shared';
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
};

// A weak signal needs at least this many struggles before it drives a
// recommendation — one bad attempt is noise, not a pattern.
const WEAKNESS_MIN_COUNT = 2;

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly career: CareerService,
    private readonly missions: MissionsService,
    private readonly weaknesses: WeaknessesService,
  ) {}

  async list(userId: string): Promise<PracticeRecommendationResponse[]> {
    const [readiness, activeMissions, overdueTasks, jobs, inboxCount, weaknessSummary] = await Promise.all([
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
    ]);

    const recommendations: PracticeRecommendationResponse[] = [];

    // Plan §6.1 queue priority 3: weakness repair sits above readiness gaps
    // (80+) and below overdue tasks (100). Patterns/topics with repeated
    // struggles come first (they map directly to a repair session); a
    // repeated miss reason without an area (e.g. "time_pressure" across mixed
    // topics) still surfaces once so the signal is never silently dropped.
    const weakAreas = [...weaknessSummary.patterns, ...weaknessSummary.topics]
      .filter((area) => area.struggles >= WEAKNESS_MIN_COUNT)
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
      const topReason = weaknessSummary.reasons.find((reason) => reason.count >= WEAKNESS_MIN_COUNT);
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
      recommendations.push({
        id: `job:${job.id}`,
        type: 'job',
        title: `Prepare ${job.company} ${job.roleTitle}`,
        reason: job.deadline ? RECOMMENDATION_REASONS.jobDeadline() : RECOMMENDATION_REASONS.jobActive(),
        roleTrackId: job.roleTrackId as PracticeRecommendationResponse['roleTrackId'],
        area: null,
        targetHref: `/jobs/${job.id}`,
        priority: job.deadline ? 90 : 60,
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
