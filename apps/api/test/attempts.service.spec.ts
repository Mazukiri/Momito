import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AttemptsService } from '../src/attempts/attempts.service';

describe('AttemptsService', () => {
  it('scopes filtered attempt history to the authenticated user', async () => {
    const findMany = vi.fn().mockReturnValue({ query: 'many' });
    const count = vi.fn().mockReturnValue({ query: 'count' });
    const prisma = {
      answerAttempt: { findMany, count },
      $transaction: vi.fn().mockResolvedValue([[], 0]),
    };
    const service = new AttemptsService(prisma as never, { record: vi.fn() } as never);

    const result = await service.list(
      { questionId: 'q-1', sessionId: 's-1', page: 2, limit: 10 },
      'user-1',
    );

    expect(findMany.mock.calls[0][0]).toEqual(expect.objectContaining({
      where: { userId: 'user-1', questionId: 'q-1', sessionId: 's-1' },
      skip: 10,
      take: 10,
    }));
    expect(count).toHaveBeenCalledWith({ where: findMany.mock.calls[0][0].where });
    expect(result).toEqual({ data: [], total: 0, page: 2, limit: 10 });
  });

  it('returns not found instead of revealing another users attempt', async () => {
    const service = new AttemptsService({ answerAttempt: { findFirst: vi.fn().mockResolvedValue(null) } } as never, { record: vi.fn() } as never);
    await expect(service.get('attempt-1', 'user-2')).rejects.toEqual(new NotFoundException('Attempt not found'));
  });
});

describe('AttemptsService — learning-loop writes', () => {
  it('creates a standalone attempt and schedules a review when a self-rating is present', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'attempt-1', questionId: 'q-1' });
    const prisma = {
      question: { findUnique: vi.fn().mockResolvedValue({ id: 'q-1' }) },
      answerAttempt: { create },
    };
    const record = vi.fn().mockResolvedValue({});
    const service = new AttemptsService(prisma as never, { record } as never);

    await service.create({ questionId: 'q-1', answerText: 'my recall', selfRating: 3 }, 'user-1');

    expect(create.mock.calls[0][0].data).toMatchObject({ questionId: 'q-1', answerText: 'my recall', selfRating: 3, userId: 'user-1' });
    expect(record).toHaveBeenCalledWith('user-1', 'question', 'q-1', 3);
  });

  it('rejects standalone attempts for questions that do not exist', async () => {
    const service = new AttemptsService(
      { question: { findUnique: vi.fn().mockResolvedValue(null) } } as never,
      { record: vi.fn() } as never,
    );
    await expect(service.create({ questionId: 'q-missing', answerText: 'x' }, 'user-1'))
      .rejects.toEqual(new NotFoundException('Question not found'));
  });

  it('updates an owned attempt post-reveal and (re)schedules its review from the new rating', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'attempt-1' });
    const prisma = {
      answerAttempt: {
        findFirst: vi.fn().mockResolvedValue({ id: 'attempt-1', questionId: 'q-1' }),
        update,
      },
    };
    const record = vi.fn().mockResolvedValue({});
    const service = new AttemptsService(prisma as never, { record } as never);

    await service.update('attempt-1', { selfRating: 1, missTags: ['edge_case'], reflectionNote: 'forgot empty input' }, 'user-1');

    expect(update.mock.calls[0][0].data).toMatchObject({ selfRating: 1, missTags: ['edge_case'] });
    expect(record).toHaveBeenCalledWith('user-1', 'question', 'q-1', 1);
  });

  it('does not let a failed review-schedule break the attempt update', async () => {
    const prisma = {
      answerAttempt: {
        findFirst: vi.fn().mockResolvedValue({ id: 'attempt-1', questionId: 'q-1' }),
        update: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
      },
    };
    const record = vi.fn().mockRejectedValue(new Error('scheduler down'));
    const service = new AttemptsService(prisma as never, { record } as never);

    await expect(service.update('attempt-1', { selfRating: 2 }, 'user-1')).resolves.toEqual({ id: 'attempt-1' });
  });

  it('refuses to update another users attempt', async () => {
    const service = new AttemptsService(
      { answerAttempt: { findFirst: vi.fn().mockResolvedValue(null) } } as never,
      { record: vi.fn() } as never,
    );
    await expect(service.update('attempt-1', { selfRating: 3 }, 'user-2'))
      .rejects.toEqual(new NotFoundException('Attempt not found'));
  });
});
