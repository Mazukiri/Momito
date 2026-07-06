import Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GradingService } from '../src/ai/grading.service';

const SAMPLE_INPUT = {
  questionTitle: 'Two Sum',
  questionPrompt: 'Given an array of integers, return indices of the two numbers that add up to a target.',
  questionType: 'dsa',
  rubric: null,
  referenceAnswer: null,
  answerText: 'Use a hash map of value -> index, one pass, O(n).',
};

const SAMPLE_RESULT = {
  overallScore: 82,
  criteriaScores: [{ criterionId: 'c1', criterionTitle: 'Correctness', score: 4, comment: 'Solid.' }],
  strengths: ['Correct O(n) approach'],
  gaps: ['Did not discuss edge cases'],
  followUpQuestions: ['What if the array has duplicates?'],
  suggestedRating: 'good' as const,
};

function serviceWithFakeClient(parse: ReturnType<typeof vi.fn>) {
  class FakeGradingService extends GradingService {
    protected createClient() {
      return { messages: { parse } } as unknown as Anthropic;
    }
  }
  return new FakeGradingService();
}

describe('GradingService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports unavailable and never calls the network when no key is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const service = new GradingService();

    expect(service.isAvailable()).toBe(false);
    const outcome = await service.grade(SAMPLE_INPUT);
    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('not configured') });
  });

  it('parses a successful grade response', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue({
      parsed_output: SAMPLE_RESULT,
      usage: { input_tokens: 500, output_tokens: 300 },
    });
    const service = serviceWithFakeClient(parse);

    const outcome = await service.grade(SAMPLE_INPUT);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result).toEqual(SAMPLE_RESULT);
      expect(outcome.inputTokens).toBe(500);
      expect(outcome.outputTokens).toBe(300);
      expect(outcome.model).toBe('claude-opus-4-8');
    }
    expect(parse).toHaveBeenCalledTimes(1);
    const call = parse.mock.calls[0][0];
    expect(call.thinking).toEqual({ type: 'adaptive' });
    expect(call.model).toBe('claude-opus-4-8');
  });

  it('reports a structured failure (never throws) when the model reply does not parse', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue({ parsed_output: null, usage: { input_tokens: 10, output_tokens: 5 } });
    const outcome = await serviceWithFakeClient(parse).grade(SAMPLE_INPUT);

    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('did not match') });
  });

  it('translates a rate-limit error into a structured failure, not a throw', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockRejectedValue(new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()));
    const outcome = await serviceWithFakeClient(parse).grade(SAMPLE_INPUT);

    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('rate-limited') });
  });

  it('translates an authentication error into a structured failure', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockRejectedValue(new Anthropic.AuthenticationError(401, {}, 'bad key', new Headers()));
    const outcome = await serviceWithFakeClient(parse).grade(SAMPLE_INPUT);

    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('misconfigured') });
  });
});
