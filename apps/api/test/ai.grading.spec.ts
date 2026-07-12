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
  criteriaScores: [{ index: 0, criterionId: 'c1', criterionTitle: 'Correctness', score: 4, comment: 'Solid.' }],
  strengths: ['Correct O(n) approach'],
  gaps: ['Did not discuss edge cases'],
  followUpQuestions: ['What if the array has duplicates?'],
  suggestedRating: 'good' as const,
};

// MOM-161: a two-criterion rubric so the completeness contract has something to enforce.
const RUBRIC_INPUT = {
  ...SAMPLE_INPUT,
  rubric: {
    id: 'r1',
    objectId: 'q1',
    maxScore: 10,
    criteria: [
      { id: 'c1', title: 'Correctness', description: 'Solves the problem.', weight: 3 },
      { id: 'c2', title: 'Complexity', description: 'Optimal time/space.', weight: 2 },
    ],
  },
};

const okResponse = (result: unknown, input = 400, output = 200) => ({
  parsed_output: result,
  usage: { input_tokens: input, output_tokens: output },
});

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
    // MOM-161: adaptive thinking bills inside max_tokens, so it must have real headroom.
    expect(call.max_tokens).toBe(16000);
  });

  // MOM-161: a no-rubric grade has nothing to enumerate — exactly one call, no completeness contract.
  it('grades a no-rubric answer in a single call, with no criterion enumeration', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue(okResponse(SAMPLE_RESULT));

    const outcome = await serviceWithFakeClient(parse).grade(SAMPLE_INPUT);

    expect(outcome.ok).toBe(true);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0][0].messages[0].content).not.toContain('return one entry per number');
  });

  // MOM-161: when a rubric is given, its criteria are enumerated and coverage is demanded.
  it('enumerates rubric criteria and requests one entry each', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const full = { ...SAMPLE_RESULT, criteriaScores: [
      { index: 0, criterionId: 'c1', criterionTitle: 'Correctness', score: 4, comment: 'Solid.' },
      { index: 1, criterionId: 'c2', criterionTitle: 'Complexity', score: 5, comment: 'Optimal.' },
    ] };
    const parse = vi.fn().mockResolvedValue(okResponse(full));

    await serviceWithFakeClient(parse).grade(RUBRIC_INPUT);

    const content = parse.mock.calls[0][0].messages[0].content;
    expect(content).toContain('0. Correctness');
    expect(content).toContain('1. Complexity');
    expect(content).toContain('Return exactly 2 criteriaScores entries');
    expect(parse).toHaveBeenCalledTimes(1); // complete → no repair
  });

  // MOM-161: a model that scores only some criteria triggers ONE repair pass, merged + billed.
  it('repairs an incomplete grade instead of accepting it silently', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const partial = { ...SAMPLE_RESULT, criteriaScores: [{ index: 0, criterionId: 'c1', criterionTitle: 'Correctness', score: 4, comment: 'Solid.' }] };
    const repaired = { ...SAMPLE_RESULT, criteriaScores: [{ index: 1, criterionId: 'c2', criterionTitle: 'Complexity', score: 5, comment: 'Optimal.' }] };
    const parse = vi.fn()
      .mockResolvedValueOnce(okResponse(partial, 400, 200))
      .mockResolvedValueOnce(okResponse(repaired, 300, 150));

    const outcome = await serviceWithFakeClient(parse).grade(RUBRIC_INPUT);

    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1][0].messages[0].content).toContain('You previously skipped these criteria');
    expect(parse.mock.calls[1][0].messages[0].content).toContain('1. Complexity');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.criteriaScores.map((c) => c.index)).toEqual([0, 1]); // merged + ordered
      expect(outcome.inputTokens).toBe(700); // both calls billed
      expect(outcome.outputTokens).toBe(350);
    }
  });

  it('keeps the partial grade if the repair pass itself fails', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const partial = { ...SAMPLE_RESULT, criteriaScores: [{ index: 0, criterionId: 'c1', criterionTitle: 'Correctness', score: 4, comment: 'Solid.' }] };
    const parse = vi.fn()
      .mockResolvedValueOnce(okResponse(partial))
      .mockRejectedValueOnce(new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()));

    const outcome = await serviceWithFakeClient(parse).grade(RUBRIC_INPUT);

    // half a grade beats no grade — the criterion that was scored survives.
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.criteriaScores).toHaveLength(1);
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
