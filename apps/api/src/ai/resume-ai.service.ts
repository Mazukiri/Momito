import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Injectable, Logger } from '@nestjs/common';
import { getAnthropicApiKey, getAnthropicModel } from '../common/config';
import {
  BulletRewrite,
  BulletRewriteSchema,
  CoverLetterDraft,
  CoverLetterDraftSchema,
  ResumeAnalysis,
  ResumeAnalysisSchema,
} from './dto/resume-ai.schema';

export type AiOutcome<T> =
  | { ok: true; result: T; inputTokens: number; outputTokens: number; model: string }
  | { ok: false; reason: string };

// MOM-149/150: what the analysis is aimed at, and what evidence it may ground suggestions in.
// Without a target the model can only give generic advice; without the profile it can only
// say "add a metric" instead of naming a metric the candidate has already claimed elsewhere.
export interface AnalyzeContext {
  targetRoleTrackId: string | null;
  job?: { company: string; role: string; jdText: string | null; focusAreas: string[] } | null;
  evidence?: { skills: string[]; projects: string[]; experience: string[] } | null;
}

// Adaptive thinking is billed inside max_tokens, so a full résumé at effort:high needs real
// headroom — 4096 truncated the answer once thinking had taken its share.
const MAX_TOKENS = 16000;

const ANALYZE_SYSTEM = `You are a senior technical recruiter reviewing a candidate's résumé. Critique the actual
bullets — cite what they literally say. Reward measurable impact, ownership, and scope; flag vague verbs, missing
metrics, and unclear seniority. Do not invent achievements the résumé does not claim.

COMPLETENESS IS MANDATORY. The bullets are enumerated for you below. Return exactly one bulletFeedback entry per
numbered bullet, in order, each carrying its \`index\`. Never skip a bullet — not even a strong one: for a strong
bullet, say what makes it strong and what would sharpen it further.

Critique substance only. The résumé may carry spacing or punctuation artifacts from PDF extraction (e.g.
"aPython script"). Ignore all formatting, spacing, and typography issues — never spend feedback on them.`;

const REWRITE_SYSTEM = `You rewrite résumé bullets to be stronger and tailored to a specific job description.
Keep every claim truthful to the original — sharpen the verb, surface measurable impact the original implies, and
match the seniority the role expects. Never fabricate metrics or responsibilities that are not in the original.`;

const COVER_LETTER_SYSTEM = `You draft a concise, specific cover letter from a résumé and a job description.
Ground every claim in the résumé. Keep it under ~300 words, professional and warm, no clichés. Provide a separate,
optional paragraph that frames the candidate's visa/sponsorship situation positively.`;

// MOM-136/137/138: résumé AI, dormant-until-key — mirrors GradingService exactly.
// With no ANTHROPIC_API_KEY every method returns a structured {ok:false} instead
// of throwing, so the feature is dormant (not broken) on a key-less instance.
// VERIFICATION-BLOCKED: the live path is unverified until a real key is present.
@Injectable()
export class ResumeAiService {
  private readonly logger = new Logger(ResumeAiService.name);
  private client: Anthropic | null = null;

  isAvailable(): boolean {
    return Boolean(getAnthropicApiKey());
  }

  // Overridden in tests to inject a fake client without touching Nest DI.
  protected createClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
  }

  private getClient(): Anthropic | null {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) return null;
    if (!this.client) this.client = this.createClient(apiKey);
    return this.client;
  }

  // Bullets are found here, in code — not left to the model to decide what counts as one.
  // Weaker/cheaper models silently critique only a handful of bullets when asked to "review
  // the résumé"; enumerating them and demanding one entry each makes coverage deterministic.
  static extractBullets(contentMd: string): string[] {
    const bullets: string[] = [];
    for (const line of contentMd.split('\n')) {
      const stripped = line.trim().replace(/^[-*•·●]\s+/, '');
      if (stripped === line.trim()) continue; // not a bullet line
      const text = stripped.replace(/\s+/g, ' ').trim();
      if (text.length > 15) bullets.push(text);
    }
    return bullets;
  }

  async analyze(contentMd: string, context: AnalyzeContext): Promise<AiOutcome<ResumeAnalysis>> {
    const bullets = ResumeAiService.extractBullets(contentMd);
    if (bullets.length === 0) {
      return { ok: false, reason: 'This résumé version has no bullet points to analyse yet.' };
    }

    const first = await this.run<ResumeAnalysis>(
      ANALYZE_SYSTEM,
      this.analyzeUser(contentMd, bullets, context, null),
      ResumeAnalysisSchema,
    );
    if (!first.ok) return first;

    // MOM-148 — the completeness contract is only worth something if we CHECK it. A model that
    // returns 10 of 14 entries used to be accepted silently, which is exactly the bug that made
    // a cheap model look like a bargain. Repair the gap once, then merge.
    const missing = this.missingIndexes(first.result, bullets.length);
    if (missing.length === 0) return first;

    this.logger.warn(`Analysis covered ${bullets.length - missing.length}/${bullets.length} bullets — repairing.`);
    const repair = await this.run<ResumeAnalysis>(
      ANALYZE_SYSTEM,
      this.analyzeUser(contentMd, bullets, context, missing),
      ResumeAnalysisSchema,
    );
    if (!repair.ok) return first; // keep the partial rather than lose the whole audit

    const merged = [...first.result.bulletFeedback, ...repair.result.bulletFeedback]
      .filter((b, i, all) => all.findIndex((o) => o.index === b.index) === i)
      .sort((a, b) => a.index - b.index);

    return {
      ok: true,
      result: { ...first.result, bulletFeedback: merged },
      inputTokens: first.inputTokens + repair.inputTokens,
      outputTokens: first.outputTokens + repair.outputTokens,
      model: first.model,
    };
  }

  private missingIndexes(result: ResumeAnalysis, total: number): number[] {
    const seen = new Set(result.bulletFeedback.map((b) => b.index));
    return Array.from({ length: total }, (_, i) => i).filter((i) => !seen.has(i));
  }

  private analyzeUser(contentMd: string, bullets: string[], ctx: AnalyzeContext, repairOnly: number[] | null): string {
    const parts: string[] = [];

    if (ctx.job) {
      // MOM-149: a recruiter's critique is only as good as the target they hold in mind.
      parts.push(`## The job this résumé is aimed at`, `${ctx.job.role} at ${ctx.job.company}`);
      if (ctx.job.focusAreas.length > 0) {
        parts.push(`This company weights these areas most: ${ctx.job.focusAreas.join(', ')}.`);
      }
      if (ctx.job.jdText) parts.push('', '### Job description', ctx.job.jdText);
      parts.push('', 'Judge every bullet against THIS job — relevance to it is part of the score.');
    } else {
      parts.push(
        '## Target role',
        ctx.targetRoleTrackId ?? '(no specific target given — judge for a strong generalist SWE role)',
      );
    }

    if (ctx.evidence && (ctx.evidence.skills.length || ctx.evidence.projects.length || ctx.evidence.experience.length)) {
      // MOM-150: without this the model can only say "add a metric" — it cannot know one. With it,
      // it can point at a number the candidate has already claimed elsewhere in their profile.
      parts.push('', '## What this candidate has actually done (from their profile — NOT on the résumé yet)');
      if (ctx.evidence.skills.length) parts.push(`Skills: ${ctx.evidence.skills.join(', ')}`);
      for (const e of ctx.evidence.experience) parts.push(`- Experience: ${e}`);
      for (const p of ctx.evidence.projects) parts.push(`- Project: ${p}`);
      parts.push(
        '',
        'When a bullet lacks a metric or scope, prefer a suggestion grounded in the evidence above over a',
        'placeholder. Never invent facts that appear in neither the résumé nor the evidence.',
      );
    }

    parts.push('', '## Résumé (Markdown)', contentMd, '');

    if (repairOnly) {
      parts.push(
        `## You previously skipped these bullets. Return ONLY these ${repairOnly.length} entries, with these exact indexes:`,
        ...repairOnly.map((i) => `${i}. ${bullets[i]}`),
      );
    } else {
      parts.push(
        `## The ${bullets.length} bullets to critique, in order — return exactly ${bullets.length} entries`,
        ...bullets.map((b, i) => `${i}. ${b}`),
      );
    }
    return parts.join('\n');
  }

  async rewriteBullets(contentMd: string, jdText: string): Promise<AiOutcome<BulletRewrite>> {
    const user = ['## Job description', jdText, '', '## Résumé (Markdown)', contentMd].join('\n');
    return this.run(REWRITE_SYSTEM, user, BulletRewriteSchema);
  }

  async draftCoverLetter(contentMd: string, jdText: string): Promise<AiOutcome<CoverLetterDraft>> {
    const user = ['## Job description', jdText, '', '## Résumé (Markdown)', contentMd].join('\n');
    return this.run(COVER_LETTER_SYSTEM, user, CoverLetterDraftSchema);
  }

  private async run<T>(system: string, userContent: string, schema: Parameters<typeof zodOutputFormat>[0]): Promise<AiOutcome<T>> {
    const client = this.getClient();
    if (!client) return { ok: false, reason: 'AI résumé tools are not configured (no ANTHROPIC_API_KEY).' };

    const model = getAnthropicModel();
    try {
      const response = await client.messages.parse({
        model,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'adaptive' },
        system,
        messages: [{ role: 'user', content: userContent }],
        output_config: { effort: 'high', format: zodOutputFormat(schema) },
      });
      if (!response.parsed_output) {
        return { ok: false, reason: 'Model response did not match the expected schema.' };
      }
      return {
        ok: true,
        result: response.parsed_output as T,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model,
      };
    } catch (error) {
      return { ok: false, reason: this.describeError(error) };
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Anthropic.AuthenticationError) {
      this.logger.error('Anthropic authentication failed — check ANTHROPIC_API_KEY.');
      return 'AI résumé tools are misconfigured (authentication failed).';
    }
    if (error instanceof Anthropic.RateLimitError) return 'AI résumé tools are rate-limited right now — try again shortly.';
    if (error instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service.';
    if (error instanceof Anthropic.BadRequestError) {
      this.logger.error(`Anthropic bad request: ${error.message}`);
      return 'AI résumé request was malformed.';
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(`Anthropic API error (${error.status}): ${error.message}`);
      return 'AI service returned an error.';
    }
    this.logger.error(`Unexpected AI résumé error: ${String(error)}`);
    return 'AI résumé tools failed unexpectedly.';
  }
}
