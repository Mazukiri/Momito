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

const MAX_TOKENS = 4096;

const GRADER_SYSTEM = `You are an experienced technical interviewer grading a candidate's practice answer.
Grade strictly but fairly against the given rubric. Be specific and concrete — cite what the
answer actually said, not what a perfect answer would say. Never invent rubric criteria that
were not given to you. If no rubric was given, grade on general correctness, depth, and
communication for this question type.`;

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

  private buildPrompt(input: GradeInput): string {
    const rubricText = input.rubric
      ? input.rubric.criteria
          .map((c) => `- ${c.title} (weight ${c.weight}/${input.rubric?.maxScore}): ${c.description}`)
          .join('\n')
      : '(no rubric provided — grade on general correctness and communication)';

    return [
      `## Question (${input.questionType})`,
      input.questionTitle,
      '',
      input.questionPrompt,
      '',
      '## Rubric',
      rubricText,
      '',
      ...(input.referenceAnswer ? ['## Reference answer', input.referenceAnswer, ''] : []),
      '## Candidate answer',
      input.answerText,
    ].join('\n');
  }

  async grade(input: GradeInput): Promise<GradeOutcome> {
    const client = this.getClient();
    if (!client) return { ok: false, reason: 'AI grading is not configured (no ANTHROPIC_API_KEY).' };

    const model = getAnthropicModel();
    try {
      const response = await client.messages.parse({
        model,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'adaptive' },
        system: GRADER_SYSTEM,
        messages: [{ role: 'user', content: this.buildPrompt(input) }],
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
