import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Injectable, Logger } from '@nestjs/common';
import type { Rubric } from '@momito/shared';
import { getAnthropicApiKey, getAnthropicModel } from '../common/config';
import { GradeResult, GradeResultSchema } from './dto/grade-result.schema';

export interface GradeInput {
  questionTitle: string;
  questionPrompt: string;
  questionType: string;
  rubric: Rubric | null;
  referenceAnswer: string | null;
  answerText: string;
}

export type GradeOutcome =
  | { ok: true; result: GradeResult; inputTokens: number; outputTokens: number; model: string }
  | { ok: false; reason: string };

// MOM-161: adaptive thinking is billed INSIDE max_tokens, so 4096 truncated the graded
// output once thinking took its share — the same bug fixed for résumé AI (MOM-147). A full
// multi-criterion grade at effort:high needs real headroom.
const MAX_TOKENS = 16000;

const GRADER_SYSTEM = `You are an experienced technical interviewer grading a candidate's practice answer.
Grade strictly but fairly against the given rubric. Be specific and concrete — cite what the
answer actually said, not what a perfect answer would say. Never invent rubric criteria that
were not given to you. If no rubric was given, grade on general correctness, depth, and
communication for this question type.

When a rubric is given, its criteria are numbered for you below. Return exactly one criteriaScores
entry per numbered criterion, in order, each carrying its \`index\`. Never skip a criterion — not
even one the answer clearly nailed: for a strong criterion, say what earned the score.`;

// Workstream C: absence of ANTHROPIC_API_KEY means every call here reports a
// structured failure instead of throwing — the feature is fully dormant, not
// broken, on an instance without a key.
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);
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

  // MOM-161: criteria are enumerated 0..n-1 so coverage is checkable (the same contract as
  // résumé analysis, MOM-147). `repairOnly` re-requests just the criteria a first pass skipped.
  private buildPrompt(input: GradeInput, repairOnly: number[] | null): string {
    const criteria = input.rubric?.criteria ?? [];
    const parts: string[] = [`## Question (${input.questionType})`, input.questionTitle, '', input.questionPrompt, ''];

    if (criteria.length > 0) {
      parts.push('## Rubric criteria (numbered — return one entry per number, each with its `index`)');
      parts.push(...criteria.map((c, i) => `${i}. ${c.title} (weight ${c.weight}/${input.rubric?.maxScore}): ${c.description}`));
    } else {
      parts.push('## Rubric', '(no rubric provided — grade on general correctness and communication)');
    }
    parts.push('');
    if (input.referenceAnswer) parts.push('## Reference answer', input.referenceAnswer, '');
    parts.push('## Candidate answer', input.answerText);

    if (repairOnly) {
      parts.push(
        '',
        `## You previously skipped these criteria. Return ONLY these ${repairOnly.length} criteriaScores entries, with these exact indexes:`,
        ...repairOnly.map((i) => `${i}. ${criteria[i].title}`),
      );
    } else if (criteria.length > 0) {
      parts.push('', `Return exactly ${criteria.length} criteriaScores entries — one per numbered criterion above.`);
    }
    return parts.join('\n');
  }

  async grade(input: GradeInput): Promise<GradeOutcome> {
    const first = await this.run(this.buildPrompt(input, null));
    if (!first.ok) return first;

    // MOM-161: the completeness contract only applies when a rubric enumerates criteria —
    // a no-rubric grade has nothing to enumerate, so accept it as-is (one call). Otherwise
    // verify every criterion was scored and repair the gap once (mirrors résumé AI MOM-148):
    // a cheap model silently scoring 3 of 5 criteria is exactly what this catches.
    const criteriaCount = input.rubric?.criteria.length ?? 0;
    if (criteriaCount === 0) return first;
    const missing = this.missingIndexes(first.result, criteriaCount);
    if (missing.length === 0) return first;

    this.logger.warn(`Grade covered ${criteriaCount - missing.length}/${criteriaCount} criteria — repairing.`);
    const repair = await this.run(this.buildPrompt(input, missing));
    if (!repair.ok) return first; // keep the partial rather than lose the whole grade

    const merged = [...first.result.criteriaScores, ...repair.result.criteriaScores]
      .filter((c, i, all) => all.findIndex((o) => o.index === c.index) === i)
      .sort((a, b) => a.index - b.index);

    return {
      ok: true,
      result: { ...first.result, criteriaScores: merged },
      inputTokens: first.inputTokens + repair.inputTokens,
      outputTokens: first.outputTokens + repair.outputTokens,
      model: first.model,
    };
  }

  private missingIndexes(result: GradeResult, total: number): number[] {
    const seen = new Set(result.criteriaScores.map((c) => c.index));
    return Array.from({ length: total }, (_, i) => i).filter((i) => !seen.has(i));
  }

  private async run(userContent: string): Promise<GradeOutcome> {
    const client = this.getClient();
    if (!client) return { ok: false, reason: 'AI grading is not configured (no ANTHROPIC_API_KEY).' };

    const model = getAnthropicModel();
    try {
      const response = await client.messages.parse({
        model,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'adaptive' },
        system: GRADER_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
        output_config: {
          effort: 'high',
          format: zodOutputFormat(GradeResultSchema),
        },
      });

      if (!response.parsed_output) {
        return { ok: false, reason: 'Model response did not match the expected grading schema.' };
      }

      return {
        ok: true,
        result: response.parsed_output,
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
      return 'AI grading is misconfigured (authentication failed).';
    }
    if (error instanceof Anthropic.RateLimitError) {
      return 'AI grading is rate-limited right now — try again shortly.';
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return 'Could not reach the AI grading service.';
    }
    if (error instanceof Anthropic.BadRequestError) {
      this.logger.error(`Anthropic bad request: ${error.message}`);
      return 'AI grading request was malformed.';
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(`Anthropic API error (${error.status}): ${error.message}`);
      return 'AI grading service returned an error.';
    }
    this.logger.error(`Unexpected AI grading error: ${String(error)}`);
    return 'AI grading failed unexpectedly.';
  }
}
