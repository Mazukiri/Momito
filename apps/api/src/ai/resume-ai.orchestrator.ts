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
import { AiOutcome, ResumeAiService, TailorContext } from './resume-ai.service';

// MOM-153: what the rewrite/cover-letter routes accept — a pasted JD, a tracked application, or
// neither (fall back to the job this version is linked to).
export interface TailorRequest {
  jdText?: string;
  jobApplicationId?: string;
}

const NO_JD = {
  ok: false as const,
  reason: 'No job description to tailor against — paste one, or pick an application that already has a JD saved.',
};

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

  // MOM-149/150. jobApplicationId is optional; when omitted we fall back to the job this
  // version was already linked to (ResumeVersion.jobApplicationId — "this is the résumé I
  // sent them"), so a targeted analysis is the default rather than something to opt into.
  async analyze(versionId: string, userId: string, jobApplicationId?: string): Promise<ResumeAiEnvelope<ResumeAnalysisResult>> {
    return this.withVersion(versionId, userId, async (version) => {
      const context = await this.loadContext(userId, jobApplicationId ?? version.jobApplicationId, version);
      return this.resumeAi.analyze(version.contentMd, context);
    });
  }

  // MOM-153: one context loader for all three tools. A rewrite and a cover letter need the
  // target and the evidence exactly as much as a critique does; before this, only analyze got them.
  private async loadContext(
    userId: string,
    jobId: string | null | undefined,
    version: { targetRoleTrackId: string | null },
  ): Promise<TailorContext> {
    const [job, evidence] = await Promise.all([
      jobId ? this.loadJob(jobId, userId) : Promise.resolve(null),
      this.loadEvidence(userId),
    ]);
    return { targetRoleTrackId: version.targetRoleTrackId, job, evidence };
  }

  private async loadJob(jobApplicationId: string, userId: string): Promise<TailorContext['job']> {
    const job = await this.prisma.jobApplication.findFirst({
      where: { id: jobApplicationId, userId },
      select: {
        company: true,
        roleTitle: true,
        jdText: true,
        visaTag: true,
        companyRef: { select: { name: true, focusAreas: true, sponsorshipStatus: true } },
      },
    });
    if (!job) throw new NotFoundException('Job application not found');
    return {
      company: job.companyRef?.name ?? job.company,
      role: job.roleTitle,
      jdText: job.jdText,
      // company focus weights (MOM-121) tell the model what this employer actually cares about
      focusAreas: Object.keys((job.companyRef?.focusAreas ?? {}) as Record<string, number>),
      // MOM-153: the catalog's researched posture wins; the application's own tag is the fallback.
      sponsorship: job.companyRef?.sponsorshipStatus ?? job.visaTag ?? null,
    };
  }

  // The profile is the master record (D-014); the résumé is a derived artifact. Feeding the
  // profile back in is what lets a suggestion name a real number instead of a placeholder.
  private async loadEvidence(userId: string): Promise<TailorContext['evidence']> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { skills: true, projects: true, experience: true },
    });
    if (!profile) return null;
    const summarise = (rows: unknown, take: number): string[] =>
      (Array.isArray(rows) ? rows : [])
        .slice(0, take)
        .map((r) => (typeof r === 'string' ? r : JSON.stringify(r)))
        .map((s) => s.slice(0, 400));
    return {
      skills: summarise(profile.skills, 40),
      projects: summarise(profile.projects, 8),
      experience: summarise(profile.experience, 8),
    };
  }

  // MOM-151 — the analysis used to be a dead end: you read it and hand-edited. This is the
  // gap→task bridge (same shape as profile-scores.atsGenerateTasks): the themes the résumé is
  // missing become study tasks, deduped by title so re-running an analysis can't spam the plan.
  // No model call and no spend — the findings already exist.
  async themesToTasks(versionId: string, userId: string, themes: string[]): Promise<{ created: number }> {
    const version = await this.prisma.resumeVersion.findFirst({
      where: { id: versionId, userId },
      select: { label: true },
    });
    if (!version) throw new NotFoundException('Résumé version not found');

    const titles = themes.slice(0, 8).map((theme) => `Résumé gap: ${theme}`.slice(0, 190));
    if (titles.length === 0) return { created: 0 };

    const existing = await this.prisma.task.findMany({
      where: { userId, title: { in: titles } },
      select: { title: true },
    });
    const seen = new Set(existing.map((task) => task.title));
    const toCreate = titles.filter((title) => !seen.has(title));
    if (toCreate.length === 0) return { created: 0 };

    const result = await this.prisma.task.createMany({
      data: toCreate.map((title) => ({
        userId,
        type: 'study',
        status: 'todo',
        priority: 'high',
        title,
        notes: `Theme the AI found missing from "${version.label}".`,
      })),
    });
    return { created: result.count };
  }

  async rewrite(versionId: string, userId: string, dto: TailorRequest): Promise<ResumeAiEnvelope<ResumeRewriteResult>> {
    const outcome = await this.withVersion(versionId, userId, async (version) => {
      const { context, jdText } = await this.resolveTarget(userId, dto, version);
      if (!jdText) return NO_JD;
      return this.resumeAi.rewriteBullets(version.contentMd, jdText, context);
    });
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

  async coverLetter(versionId: string, userId: string, dto: TailorRequest): Promise<ResumeAiEnvelope<CoverLetterDraftResult>> {
    return this.withVersion(versionId, userId, async (version) => {
      const { context, jdText } = await this.resolveTarget(userId, dto, version);
      if (!jdText) return NO_JD;
      return this.resumeAi.draftCoverLetter(version.contentMd, jdText, context);
    });
  }

  // MOM-153. A pasted JD wins (it is what the user is looking at right now); otherwise reuse the
  // JD already stored on the targeted — or linked — application, so a JD captured once in the
  // pipeline never has to be pasted again.
  private async resolveTarget(
    userId: string,
    dto: TailorRequest,
    version: { targetRoleTrackId: string | null; jobApplicationId: string | null },
  ): Promise<{ context: TailorContext; jdText: string | null }> {
    const context = await this.loadContext(userId, dto.jobApplicationId ?? version.jobApplicationId, version);
    return { context, jdText: dto.jdText?.trim() || context.job?.jdText || null };
  }

  // Availability → version → budget → call → record. The AI-unavailable path never
  // touches the DB or the network.
  private async withVersion<T>(
    versionId: string,
    userId: string,
    call: (version: {
      contentMd: string;
      targetRoleTrackId: string | null;
      jobApplicationId: string | null;
    }) => Promise<AiOutcome<T>>,
  ): Promise<ResumeAiEnvelope<T>> {
    if (!this.isAvailable()) {
      return { ok: false, reason: 'AI résumé tools are not configured on this instance (no ANTHROPIC_API_KEY).' };
    }

    const version = await this.prisma.resumeVersion.findFirst({
      where: { id: versionId, userId },
      select: { contentMd: true, targetRoleTrackId: true, jobApplicationId: true },
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
