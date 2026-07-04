import { Injectable } from '@nestjs/common';
import {
  CONTENT_COVERAGE_TARGETS,
  CS_FUNDAMENTALS_TARGET,
  CS_FUNDAMENTALS_TYPES,
  CAREER_ROLE_TRACK_IDS,
  type ContentCoverageDomain,
  type ContentCoverageResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';

// MOM-062: content coverage dashboard. Reads the live `questions` table (not the
// seed script's static array — that's what `content:validate/stats` check
// pre-seed; this reflects what's actually published in this deployment,
// including any user-created questions).
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async coverage(): Promise<ContentCoverageResponse> {
    const [byType, byDifficulty, totalQuestions, companyCount] = await Promise.all([
      this.prisma.question.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.question.groupBy({ by: ['difficulty'], _count: { _all: true } }),
      this.prisma.question.count(),
      this.prisma.company.count(),
    ]);

    const typeCounts = Object.fromEntries(byType.map((row) => [row.type, row._count._all]));

    const domains: ContentCoverageDomain[] = Object.entries(CONTENT_COVERAGE_TARGETS).map(
      ([type, target]) => {
        const count = typeCounts[type] ?? 0;
        return {
          label: type.replace(/_/g, ' '),
          count,
          target,
          percentage: Math.min(100, Math.round((count / target) * 100)),
        };
      },
    );

    const csFundamentalsCount = CS_FUNDAMENTALS_TYPES.reduce(
      (sum, type) => sum + (typeCounts[type] ?? 0),
      0,
    );
    domains.push({
      label: 'cs fundamentals',
      count: csFundamentalsCount,
      target: CS_FUNDAMENTALS_TARGET,
      percentage: Math.min(100, Math.round((csFundamentalsCount / CS_FUNDAMENTALS_TARGET) * 100)),
    });

    return {
      totalQuestions,
      byType: typeCounts,
      byDifficulty: Object.fromEntries(byDifficulty.map((row) => [row.difficulty, row._count._all])),
      domains,
      companyCount,
      roleTrackCount: CAREER_ROLE_TRACK_IDS.length,
    };
  }
}
