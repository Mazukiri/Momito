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
    const service = new AttemptsService(prisma as never);

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
    const service = new AttemptsService({ answerAttempt: { findFirst: vi.fn().mockResolvedValue(null) } } as never);
    await expect(service.get('attempt-1', 'user-2')).rejects.toEqual(new NotFoundException('Attempt not found'));
  });
});
