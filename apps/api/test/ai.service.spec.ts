import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/ai/ai.service';

const QUESTION = {
  title: 'Two Sum',
  prompt: 'Given an array...',
  type: 'dsa',
  rubric: { id: 'r1', objectId: 'q-1', maxScore: 5, criteria: [{ id: 'c1', title: 'Correctness', description: '...', weight: 5 }] },
  referenceAnswer: 'Use a hash map.',
};

function buildService(overrides: { grading?: unknown; budget?: unknown; prisma?: unknown } = {}) {
  const grading = overrides.grading ?? { isAvailable: () => true, grade: vi.fn() };
  const budget = overrides.budget ?? { getUsage: vi.fn(), checkAndReserve: vi.fn().mockResolvedValue({ allowed: true, remainingUsd: 1 }), record: vi.fn() };
  const prisma = overrides.prisma ?? {
    answerAttempt: {
      findFirst: vi.fn().mockResolvedValue({ id: 'attempt-1', answerText: 'Hash map, O(n).', aiFeedback: null, question: QUESTION }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { service: new AiService(prisma as never, budget as never, grading as never), grading, budget, prisma };
}

describe('AiService', () => {
  it('refuses to grade when AI is not configured', async () => {
    const { service } = buildService({ grading: { isAvailable: () => false, grade: vi.fn() } });
    await expect(service.gradeAttempt('attempt-1', 'user-1', false)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws NotFoundException for an attempt that does not belong to the user', async () => {
    const { service } = buildService({ prisma: { answerAttempt: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() } } });
    await expect(service.gradeAttempt('attempt-1', 'user-1', false)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the cached grade without calling the model again', async () => {
    const prisma = {
      answerAttempt: {
        findFirst: vi.fn().mockResolvedValue({ id: 'attempt-1', answerText: 'x', aiScore: 0.8, aiFeedback: 'cached feedback', question: QUESTION }),
        update: vi.fn(),
      },
    };
    const grading = { isAvailable: () => true, grade: vi.fn() };
    const { service } = buildService({ prisma, grading });

    const result = await service.gradeAttempt('attempt-1', 'user-1', false);

    expect(result).toEqual({ attemptId: 'attempt-1', aiScore: 0.8, aiFeedback: 'cached feedback', cached: true });
    expect(grading.grade).not.toHaveBeenCalled();
  });

  it('refuses to grade once the daily budget is exhausted', async () => {
    const budget = { getUsage: vi.fn(), checkAndReserve: vi.fn().mockResolvedValue({ allowed: false, remainingUsd: 0 }), record: vi.fn() };
    const { service } = buildService({ budget });
    await expect(service.gradeAttempt('attempt-1', 'user-1', false)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grades, persists the score/feedback, and records budget usage on success', async () => {
    const grade = vi.fn().mockResolvedValue({
      ok: true,
      model: 'claude-opus-4-8',
      inputTokens: 400,
      outputTokens: 200,
      result: {
        overallScore: 90,
        criteriaScores: [{ criterionId: 'c1', criterionTitle: 'Correctness', score: 5, comment: 'Great.' }],
        strengths: ['Correct'],
        gaps: [],
        followUpQuestions: ['What about duplicates?'],
        suggestedRating: 'easy',
      },
    });
    const record = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue({});
    const { service } = buildService({
      grading: { isAvailable: () => true, grade },
      budget: { getUsage: vi.fn(), checkAndReserve: vi.fn().mockResolvedValue({ allowed: true, remainingUsd: 1 }), record },
      prisma: { answerAttempt: { findFirst: vi.fn().mockResolvedValue({ id: 'attempt-1', answerText: 'x', aiFeedback: null, question: QUESTION }), update } },
    });

    const result = await service.gradeAttempt('attempt-1', 'user-1', false);

    expect(result.aiScore).toBeCloseTo(0.9);
    expect(result.cached).toBe(false);
    expect(result.aiFeedback).toContain('Correctness');
    expect(record).toHaveBeenCalledWith('user-1', 'claude-opus-4-8', 400, 200);
    expect(update).toHaveBeenCalledWith({ where: { id: 'attempt-1' }, data: { aiScore: result.aiScore, aiFeedback: result.aiFeedback } });
  });

  it('surfaces a grading failure as a BadRequestException without persisting anything', async () => {
    const update = vi.fn();
    const { service } = buildService({
      grading: { isAvailable: () => true, grade: vi.fn().mockResolvedValue({ ok: false, reason: 'model refused' }) },
      prisma: { answerAttempt: { findFirst: vi.fn().mockResolvedValue({ id: 'attempt-1', answerText: 'x', aiFeedback: null, question: QUESTION }), update } },
    });

    await expect(service.gradeAttempt('attempt-1', 'user-1', false)).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
