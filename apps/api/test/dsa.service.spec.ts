import { describe, expect, it, vi } from 'vitest';
import { DsaService } from '../src/dsa/dsa.service';

describe('DsaService.progress', () => {
  it('computes per-pattern totals, attempted, and solved counts', async () => {
    const prisma = {
      question: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'q1', patternTags: ['two_pointers'] },
          { id: 'q2', patternTags: ['two_pointers', 'sliding_window'] },
          { id: 'q3', patternTags: ['sliding_window'] },
        ]),
      },
      answerAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { questionId: 'q1', selfRating: 4, rubricScore: null, aiScore: null, correctness: null },
          { questionId: 'q2', selfRating: 1, rubricScore: null, aiScore: null, correctness: 'incorrect' },
        ]),
      },
    };
    const service = new DsaService(prisma as never);

    const result = await service.progress('user-1');

    expect(result.totalDsaItems).toBe(3);
    expect(result.totalAttempted).toBe(2);
    expect(result.totalSolved).toBe(1);

    const twoPointers = result.patterns.find((p) => p.pattern === 'two_pointers');
    expect(twoPointers).toEqual({ pattern: 'two_pointers', totalItems: 2, attemptedItems: 2, solvedItems: 1 });

    const slidingWindow = result.patterns.find((p) => p.pattern === 'sliding_window');
    expect(slidingWindow).toEqual({ pattern: 'sliding_window', totalItems: 2, attemptedItems: 1, solvedItems: 0 });

    const unattempted = result.patterns.find((p) => p.pattern === 'trie');
    expect(unattempted).toEqual({ pattern: 'trie', totalItems: 0, attemptedItems: 0, solvedItems: 0 });
  });

  it('does not count a partial-correctness attempt as solved', async () => {
    const prisma = {
      question: {
        findMany: vi.fn().mockResolvedValue([{ id: 'q1', patternTags: ['two_pointers'] }]),
      },
      answerAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { questionId: 'q1', selfRating: null, rubricScore: null, aiScore: null, correctness: 'partial' },
        ]),
      },
    };
    const service = new DsaService(prisma as never);

    const result = await service.progress('user-1');

    expect(result.totalAttempted).toBe(1);
    expect(result.totalSolved).toBe(0);
  });

  // Pins the AiService contract (ai.service.ts: `aiScore = overallScore / 100`)
  // against this threshold — AiService writes a 0–1 aiScore, and this check
  // treats 0.6 as the solved cutoff. If AiService's /100 conversion were ever
  // removed, a merely-passing grade like 55/100 would wrongly satisfy `>= 0.6`
  // (55 >= 0.6) and inflate DSA ladder progress; a failing 55/100 must NOT
  // count as solved on the correct 0–1 scale.
  it('does not count an AI-graded 55/100 (aiScore 0.55) as solved', async () => {
    const prisma = {
      question: {
        findMany: vi.fn().mockResolvedValue([{ id: 'q1', patternTags: ['two_pointers'] }]),
      },
      answerAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { questionId: 'q1', selfRating: null, rubricScore: null, aiScore: 0.55, correctness: null },
        ]),
      },
    };
    const service = new DsaService(prisma as never);

    const result = await service.progress('user-1');

    expect(result.totalSolved).toBe(0);
  });

  it('counts an AI-graded 65/100 (aiScore 0.65) as solved', async () => {
    const prisma = {
      question: {
        findMany: vi.fn().mockResolvedValue([{ id: 'q1', patternTags: ['two_pointers'] }]),
      },
      answerAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { questionId: 'q1', selfRating: null, rubricScore: null, aiScore: 0.65, correctness: null },
        ]),
      },
    };
    const service = new DsaService(prisma as never);

    const result = await service.progress('user-1');

    expect(result.totalSolved).toBe(1);
  });
});
