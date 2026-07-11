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

// MOM-149/150/153: what the work is aimed at, and what evidence it may ground suggestions in.
// Without a target the model can only give generic advice; without the profile it can only
// say "add a metric" instead of naming a metric the candidate has already claimed elsewhere.
// MOM-153 shares this across all three tools — a rewrite and a cover letter need the target
// at least as badly as a critique does.
export interface TailorContext {
  targetRoleTrackId: string | null;
  job?: {
    company: string;
    role: string;
    jdText: string | null;
    focusAreas: string[];
    // VISA_TAGS value from the linked company (or the application's own tag); null = unknown.
    sponsorship: string | null;
  } | null;
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
match the seniority the role expects. Never fabricate metrics or responsibilities that are not in the original.

The bullets are enumerated for you. Copy \`original\` VERBATIM from that list, character for character — the client
matches it against the résumé text to apply your rewrite, so a paraphrased \`original\` is a rewrite that silently
does nothing. Rewrite only the bullets that are genuinely worth improving; skip the ones that are already strong.`;

const COVER_LETTER_SYSTEM = `You draft a concise, specific cover letter from a résumé and a job description.
Ground every claim in the résumé, or in the candidate's profile evidence when it is supplied — a cover letter may
draw on real experience the résumé had no room for, but it may never claim anything absent from both. Keep it under
~300 words, professional and warm, no clichés. Provide a separate paragraph framing the candidate's visa situation,
calibrated to the employer's sponsorship posture below.`;

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
  //
  // `raw` is the bullet exactly as it appears in contentMd (marker stripped, inner spacing
  // untouched) — that is what a client can match+replace against. `norm` collapses whitespace,
  // which is what we show the model and compare against: a PDF-extracted résumé is full of
  // double spaces the model will not reproduce, and prompts are lossy anyway.
  private static bulletEntries(contentMd: string): { raw: string; norm: string }[] {
    const entries: { raw: string; norm: string }[] = [];
    for (const line of contentMd.split('\n')) {
      const trimmed = line.trim();
      const raw = trimmed.replace(/^[-*•·●]\s+/, '');
      if (raw === trimmed) continue; // not a bullet line
      const norm = ResumeAiService.normalize(raw);
      if (norm.length > 15) entries.push({ raw, norm });
    }
    return entries;
  }

  private static normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  static extractBullets(contentMd: string): string[] {
    return ResumeAiService.bulletEntries(contentMd).map((entry) => entry.norm);
  }

  async analyze(contentMd: string, context: TailorContext): Promise<AiOutcome<ResumeAnalysis>> {
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

  // MOM-149 → MOM-153: the target block. A critique, a rewrite and a cover letter are all only
  // as good as the target the writer holds in mind, so all three get this — not just analyze.
  private targetBlock(ctx: TailorContext, jdText: string | null): string[] {
    const parts: string[] = [];
    if (ctx.job) {
      parts.push('## The job this résumé is aimed at', `${ctx.job.role} at ${ctx.job.company}`);
      if (ctx.job.focusAreas.length > 0) {
        parts.push(`This company weights these areas most: ${ctx.job.focusAreas.join(', ')}.`);
      }
    } else {
      parts.push(
        '## Target role',
        ctx.targetRoleTrackId ?? '(no specific target given — judge for a strong generalist SWE role)',
      );
    }
    if (jdText) parts.push('', '### Job description', jdText);
    return parts;
  }

  // MOM-150 → MOM-153: without this the model can only say "add a metric" — it cannot know one.
  // With it, it can point at a number the candidate has already claimed elsewhere in their profile.
  private evidenceBlock(ctx: TailorContext): string[] {
    const evidence = ctx.evidence;
    if (!evidence || !(evidence.skills.length || evidence.projects.length || evidence.experience.length)) return [];
    const parts = ['', '## What this candidate has actually done (from their profile — NOT on the résumé yet)'];
    if (evidence.skills.length) parts.push(`Skills: ${evidence.skills.join(', ')}`);
    for (const e of evidence.experience) parts.push(`- Experience: ${e}`);
    for (const p of evidence.projects) parts.push(`- Project: ${p}`);
    return parts;
  }

  private analyzeUser(contentMd: string, bullets: string[], ctx: TailorContext, repairOnly: number[] | null): string {
    const parts = this.targetBlock(ctx, ctx.job?.jdText ?? null);
    if (ctx.job) parts.push('', 'Judge every bullet against THIS job — relevance to it is part of the score.');

    parts.push(...this.evidenceBlock(ctx));
    if (ctx.evidence) {
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

  async rewriteBullets(contentMd: string, jdText: string, ctx: TailorContext): Promise<AiOutcome<BulletRewrite>> {
    const entries = ResumeAiService.bulletEntries(contentMd);
    if (entries.length === 0) {
      return { ok: false, reason: 'This résumé version has no bullet points to rewrite yet.' };
    }

    const parts = this.targetBlock(ctx, jdText);
    parts.push(...this.evidenceBlock(ctx));
    if (ctx.evidence) {
      parts.push(
        '',
        'A rewrite may surface a metric or scope from the evidence above if it plainly describes the same work.',
        'It may never introduce a number that appears in neither the bullet nor the evidence.',
      );
    }
    parts.push(
      '',
      '## Résumé (Markdown)',
      contentMd,
      '',
      '## The bullets you may rewrite — copy `original` verbatim from this list',
      ...entries.map((e, i) => `${i}. ${e.norm}`),
    );

    const outcome = await this.run<BulletRewrite>(REWRITE_SYSTEM, parts.join('\n'), BulletRewriteSchema);
    if (!outcome.ok) return outcome;
    return { ...outcome, result: { rewrites: this.snapToSource(outcome.result.rewrites, entries) } };
  }

  // MOM-153. The client applies a rewrite with `contentMd.replace(original, rewritten)`, so an
  // `original` that is not a verbatim substring is an "Accept" button that silently does nothing.
  // Models reliably return the *normalized* bullet (the form we showed them), which does not match
  // a PDF-extracted résumé's double spaces. So match on the normalized form and hand the client
  // back the raw source line. A rewrite matching no bullet at all is dropped — it is unusable.
  private snapToSource(
    rewrites: BulletRewrite['rewrites'],
    entries: { raw: string; norm: string }[],
  ): BulletRewrite['rewrites'] {
    const snapped = rewrites.flatMap((rewrite) => {
      const target = ResumeAiService.normalize(rewrite.original);
      const hit =
        entries.find((e) => e.norm === target) ??
        entries.find((e) => target.length >= 20 && (e.norm.includes(target) || target.includes(e.norm)));
      return hit ? [{ ...rewrite, original: hit.raw }] : [];
    });
    const dropped = rewrites.length - snapped.length;
    if (dropped > 0) this.logger.warn(`Dropped ${dropped} rewrite(s) whose original matched no résumé bullet.`);
    return snapped;
  }

  async draftCoverLetter(contentMd: string, jdText: string, ctx: TailorContext): Promise<AiOutcome<CoverLetterDraft>> {
    const parts = this.targetBlock(ctx, jdText);
    parts.push(...this.evidenceBlock(ctx));

    // MOM-153: the visa paragraph was being written blind. The pipeline already knows this
    // employer's sponsorship posture (Company.sponsorshipStatus / the application's visaTag),
    // and the honest framing differs sharply by case — so say which case this is.
    parts.push('', '## This employer’s sponsorship posture', this.sponsorshipGuidance(ctx.job?.sponsorship ?? null));
    parts.push('', '## Résumé (Markdown)', contentMd);
    return this.run(COVER_LETTER_SYSTEM, parts.join('\n'), CoverLetterDraftSchema);
  }

  private sponsorshipGuidance(sponsorship: string | null): string {
    if (sponsorship === 'sponsored') {
      return 'This employer is known to sponsor visas. The visa paragraph should be brief and matter-of-fact — state the need plainly and move on; do not over-explain or apologise for it.';
    }
    if (sponsorship === 'not_sponsoring') {
      return 'This employer is believed NOT to sponsor visas. Do not paper over it. Write the visa paragraph honestly: state the candidate’s status, and any work authorisation that would not require sponsorship, if the résumé supports it. Never claim authorisation the résumé does not evidence.';
    }
    return 'This employer’s sponsorship policy is unknown. Keep the visa paragraph short and neutral — state the situation without assuming a policy either way.';
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
