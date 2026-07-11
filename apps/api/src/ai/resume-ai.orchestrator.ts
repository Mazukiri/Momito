import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CoverLetterDraftResult,
  ResumeAiEnvelope,
  ResumeAnalysisResult,
  ResumeRewriteResult,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetService } from './budget.service';
import { AiOutcome, ResumeAiService } from './resume-ai.service';

// MOM-136/137/138: orchestration for résumé AI — mirrors AiService.gradeAttempt.
// Availability first (dormant-until-key → {ok:false}, never a throw), then the
// version lookup (404), then the shared daily budget pool, then the model call,
// then record the real usage. VERIFICATION-BLOCKED on a live ANTHROPIC_API_KEY.
@Injectable()
export class ResumeAiOrchestrator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: BudgetService,
    private readonly resumeAi: ResumeAiService,
  ) {}

  isAvailable(): boolean {
    return this.resumeAi.isAvailable();
  }

  async analyze(versionId: string, userId: string): Promise<ResumeAiEnvelope<ResumeAnalysisResult>> {
    return this.withVersion(versionId, userId, (version) =>
      this.resumeAi.analyze(version.contentMd, version.targetRoleTrackId),
    );
  }

  async rewrite(versionId: string, userId: string, jdText: string): Promise<ResumeAiEnvelope<ResumeRewriteResult>> {
    const outcome = await this.withVersion(versionId, userId, (version) =>
      this.resumeAi.rewriteBullets(version.contentMd, jdText),
    );
    // MOM-137: suggestions live on the version so the UI can accept/reject them
    // across sessions ("accept" = the client replaces original→rewritten in contentMd).
    if (outcome.ok) {
      await this.prisma.resumeVersion.updateMany({
        where: { id: versionId, userId },
        data: { aiSuggestions: outcome.result.rewrites as unknown as Prisma.InputJsonValue },
      });
    }
    return outcome;
  }

  async coverLetter(versionId: string, userId: string, jdText: string): Promise<ResumeAiEnvelope<CoverLetterDraftResult>> {
    return this.withVersion(versionId, userId, (version) => this.resumeAi.draftCoverLetter(version.contentMd, jdText));
  }

  // Availability → version → budget → call → record. The AI-unavailable path never
  // touches the DB or the network.
  private async withVersion<T>(
    versionId: string,
    userId: string,
    call: (version: { contentMd: string; targetRoleTrackId: string | null }) => Promise<AiOutcome<T>>,
  ): Promise<ResumeAiEnvelope<T>> {
    if (!this.isAvailable()) {
      return { ok: false, reason: 'AI résumé tools are not configured on this instance (no ANTHROPIC_API_KEY).' };
    }

    const version = await this.prisma.resumeVersion.findFirst({
      where: { id: versionId, userId },
      select: { contentMd: true, targetRoleTrackId: true },
    });
    if (!version) throw new NotFoundException('Résumé version not found');

    const { allowed, remainingUsd } = await this.budget.checkAndReserve(userId);
    if (!allowed) {
      throw new BadRequestException(`Daily AI budget exhausted (remaining $${remainingUsd.toFixed(2)}).`);
    }

    const outcome = await call(version);
    if (!outcome.ok) return { ok: false, reason: outcome.reason };

    await this.budget.record(userId, outcome.model, outcome.inputTokens, outcome.outputTokens);
    return { ok: true, result: outcome.result };
  }
}
