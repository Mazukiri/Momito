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

const MAX_TOKENS = 4096;

const ANALYZE_SYSTEM = `You are a senior technical recruiter reviewing a candidate's résumé. Critique the actual
bullets — cite what they literally say. Reward measurable impact, ownership, and scope; flag vague verbs, missing
metrics, and unclear seniority. Do not invent achievements the résumé does not claim.`;

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

  async analyze(contentMd: string, targetLabel: string | null): Promise<AiOutcome<ResumeAnalysis>> {
    const user = [
      `## Target role`,
      targetLabel ?? '(no specific target given — judge for a strong generalist SWE role)',
      '',
      '## Résumé (Markdown)',
      contentMd,
    ].join('\n');
    return this.run(ANALYZE_SYSTEM, user, ResumeAnalysisSchema);
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
