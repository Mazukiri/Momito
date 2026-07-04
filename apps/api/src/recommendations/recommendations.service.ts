import { Injectable } from '@nestjs/common';
import { PracticeRecommendationResponse } from '@momito/shared';
import { CareerService } from '../career/career.service';
import { MissionsService } from '../missions/missions.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly career: CareerService,
    private readonly missions: MissionsService,
  ) {}

  async list(userId: string): Promise<PracticeRecommendationResponse[]> {
    const [readiness, activeMissions, overdueTasks, jobs, inboxCount] = await Promise.all([
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
    ]);

    const recommendations: PracticeRecommendationResponse[] = [];
    for (const mission of activeMissions.filter((item) => item.stage !== 'archived').slice(0, 2)) {
      recommendations.push({
        id: `mission:${mission.id}`,
        type: 'task',
        title: `Focus ${mission.name}`,
        reason: mission.diagnosisSummary ?? 'Active mission needs weekly execution',
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
        reason: 'Overdue scheduled work',
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
          reason: `${role.roleTrack.label} readiness gap`,
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
        reason: job.deadline ? 'Upcoming job deadline' : 'Active job pipeline item',
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
        reason: 'Unmapped learning evidence',
        roleTrackId: null,
        area: null,
        targetHref: '/learning/inbox',
        priority: 50,
      });
    }
    return recommendations.sort((left, right) => right.priority - left.priority).slice(0, 8);
  }
}
