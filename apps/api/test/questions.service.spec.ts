import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { QuestionsService } from '../src/questions/questions.service';

describe('QuestionsService', () => {
  it('creates a question and deduplicates company links', async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({
      id: 'question-1',
      ...data,
      topic: { id: 'topic-1', name: 'Backend' },
      companies: [{ company: { id: 'company-1', name: 'Example Co' } }],
    }));
    const service = new QuestionsService({ question: { create } } as never);

    const result = await service.create({
      title: 'Explain idempotency',
      prompt: 'What makes an API operation idempotent?',
      type: 'backend',
      difficulty: 'medium',
      topicId: 'topic-1',
      companyIds: ['company-1', 'company-1'],
    }, 'user-1');

    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      createdByUserId: 'user-1',
      companies: { create: [{ companyId: 'company-1' }] },
    }));
    expect(result.companies).toEqual([{ id: 'company-1', name: 'Example Co' }]);
  });

  it('returns 409 when deleting a question with history', async () => {
    const prisma = {
      question: {
        findUnique: vi.fn().mockResolvedValue({ id: 'question-1' }),
        delete: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
            code: 'P2003',
            clientVersion: '6.19.0',
          }),
        ),
      },
    };
    const service = new QuestionsService(prisma as never);

    await expect(service.remove('question-1')).rejects.toEqual(
      new ConflictException('Question has session history and cannot be deleted.'),
    );
  });

  it('applies filters and pagination to list and count consistently', async () => {
    const findMany = vi.fn().mockReturnValue({ query: 'many' });
    const count = vi.fn().mockReturnValue({ query: 'count' });
    const prisma = {
      question: { findMany, count },
      $transaction: vi.fn().mockResolvedValue([[], 0]),
    };
    const service = new QuestionsService(prisma as never);

    const result = await service.list({
      topic: 'ebd4f4a1-4305-4f9c-bbb4-7b675688cd92',
      difficulty: 'hard',
      type: 'backend',
      search: 'cache',
      company: 'Google',
      page: 2,
      limit: 10,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10, where: expect.any(Object) }),
    );
    expect(count).toHaveBeenCalledWith({ where: findMany.mock.calls[0][0].where });
    expect(result).toEqual({ data: [], total: 0, page: 2, limit: 10 });
  });
});
