import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { CreateSessionDto } from '../src/sessions/dto/create-session.dto';
import { SessionsService } from '../src/sessions/sessions.service';

describe('SessionsService', () => {
  it('creates no more questions than are available and preserves order', async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({
      id: 'session-1',
      status: 'active',
      sessionQuestions: data.sessionQuestions.create.map((item: object, index: number) => ({
        id: `sq-${index}`,
        sessionId: 'session-1',
        createdAt: new Date(),
        ...item,
        question: { id: `q-${index}`, companies: [] },
      })),
    }));
    const prisma = {
      question: { findMany: vi.fn().mockResolvedValue([{ id: 'q-1' }, { id: 'q-2' }]) },
      interviewSession: { create },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never);

    const result = await service.create(
      { sessionType: 'mixed_mock', difficulty: 'hard', questionCount: 5 },
      'user-1',
    );

    expect(create.mock.calls[0][0].data.sessionQuestions.create).toHaveLength(2);
    expect(create.mock.calls[0][0].data.sessionQuestions.create.map((item: { order: number }) => item.order)).toEqual([1, 2]);
    expect(result.questions).toHaveLength(2);
  });

  it('rejects session creation when no question matches', async () => {
    const service = new SessionsService({ question: { findMany: vi.fn().mockResolvedValue([]) } } as never, { record: vi.fn() } as never);
    await expect(service.create({ sessionType: 'quick_practice', questionCount: 1 }, 'user-1'))
      .rejects.toEqual(new BadRequestException('No questions match the selected filters'));
  });

  it('creates a session with the exact requested questions in order', async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({
      id: 'session-1',
      status: 'active',
      sessionQuestions: data.sessionQuestions.create.map((item: object, index: number) => ({
        id: `sq-${index}`,
        sessionId: 'session-1',
        createdAt: new Date(),
        ...item,
        question: { id: `q-${index}`, companies: [] },
      })),
    }));
    const findMany = vi.fn().mockResolvedValue([{ id: 'q-2' }, { id: 'q-1' }]);
    const service = new SessionsService({ question: { findMany }, interviewSession: { create } } as never, { record: vi.fn() } as never);

    await service.create(
      { sessionType: 'quick_practice', questionCount: 99, questionIds: ['q-1', 'q-2'] },
      'user-1',
    );

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['q-1', 'q-2'] } },
      select: { id: true },
    });
    expect(create.mock.calls[0][0].data.sessionQuestions.create).toEqual([
      { questionId: 'q-1', order: 1 },
      { questionId: 'q-2', order: 2 },
    ]);
  });

  it('deduplicates exact question IDs while preserving first-seen order', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'session-1', status: 'active', sessionQuestions: [] });
    const findMany = vi.fn().mockResolvedValue([{ id: 'q-2' }, { id: 'q-1' }]);
    const service = new SessionsService({ question: { findMany }, interviewSession: { create } } as never, { record: vi.fn() } as never);

    await service.create(
      { sessionType: 'quick_practice', questionCount: 3, questionIds: ['q-1', 'q-2', 'q-1'] },
      'user-1',
    );

    expect(create.mock.calls[0][0].data.sessionQuestions.create).toEqual([
      { questionId: 'q-1', order: 1 },
      { questionId: 'q-2', order: 2 },
    ]);
  });

  it('rejects an empty exact question ID list during DTO validation', async () => {
    const dto = plainToInstance(CreateSessionDto, {
      sessionType: 'quick_practice',
      questionCount: 1,
      questionIds: [],
    });

    const errors = await validate(dto);

    expect(errors.find(({ property }) => property === 'questionIds')?.constraints).toHaveProperty('arrayMinSize');
  });

  it('rejects exact-question sessions when a requested question does not exist', async () => {
    const create = vi.fn();
    const service = new SessionsService({
      question: { findMany: vi.fn().mockResolvedValue([{ id: 'q-1' }]) },
      interviewSession: { create },
    } as never, { record: vi.fn() } as never);

    await expect(service.create(
      { sessionType: 'quick_practice', questionCount: 2, questionIds: ['q-1', 'missing'] },
      'user-1',
    )).rejects.toEqual(new BadRequestException('One or more selected questions do not exist'));
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects answers for questions outside the active session', async () => {
    const prisma = {
      interviewSession: { findFirst: vi.fn().mockResolvedValue({ status: 'active', sessionQuestions: [] }) },
      answerAttempt: { create: vi.fn() },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never);

    await expect(service.answer('session-1', { questionId: 'q-1', answerText: 'answer' }, 'user-1'))
      .rejects.toEqual(new BadRequestException('Question is not part of this session'));
    expect(prisma.answerAttempt.create).not.toHaveBeenCalled();
  });

  it('updates the review schedule when an answer includes a selfRating', async () => {
    const prisma = {
      interviewSession: {
        findFirst: vi.fn().mockResolvedValue({ status: 'active', sessionQuestions: [{ id: 'sq-1' }] }),
      },
      answerAttempt: {
        create: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
      },
    };
    const record = vi.fn().mockResolvedValue({});
    const service = new SessionsService(prisma as never, { record } as never);

    await service.answer('session-1', { questionId: 'q-1', answerText: 'answer', selfRating: 4 }, 'user-1');

    expect(record).toHaveBeenCalledWith('user-1', 'question', 'q-1', 4);
  });

  it('does not touch the review schedule when selfRating is omitted', async () => {
    const prisma = {
      interviewSession: {
        findFirst: vi.fn().mockResolvedValue({ status: 'active', sessionQuestions: [{ id: 'sq-1' }] }),
      },
      answerAttempt: {
        create: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
      },
    };
    const record = vi.fn();
    const service = new SessionsService(prisma as never, { record } as never);

    await service.answer('session-1', { questionId: 'q-1', answerText: 'answer' }, 'user-1');

    expect(record).not.toHaveBeenCalled();
  });

  it('still returns the created attempt even if updating the review schedule fails', async () => {
    const prisma = {
      interviewSession: {
        findFirst: vi.fn().mockResolvedValue({ status: 'active', sessionQuestions: [{ id: 'sq-1' }] }),
      },
      answerAttempt: {
        create: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
      },
    };
    const record = vi.fn().mockRejectedValue(new Error('scheduling exploded'));
    const service = new SessionsService(prisma as never, { record } as never);

    const result = await service.answer('session-1', { questionId: 'q-1', answerText: 'answer', selfRating: 2 }, 'user-1');

    expect(result).toEqual({ id: 'attempt-1' });
  });

  it('does not expose another users session', async () => {
    const service = new SessionsService({ interviewSession: { findFirst: vi.fn().mockResolvedValue(null) } } as never, { record: vi.fn() } as never);
    await expect(service.get('session-1', 'user-2')).rejects.toEqual(new NotFoundException('Session not found'));
  });

  it('allows only one terminal state transition', async () => {
    const prisma = {
      interviewSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ status: 'completed' }),
      },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never);
    await expect(service.abandon('session-1', 'user-1'))
      .rejects.toEqual(new ConflictException('Session is already completed'));
  });
});
