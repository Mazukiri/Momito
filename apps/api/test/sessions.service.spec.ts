import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { CreateSessionDto } from '../src/sessions/dto/create-session.dto';
import { SessionsService } from '../src/sessions/sessions.service';

// New third constructor dependency (weakness-driven weak_area_review selection).
// Tests that don't exercise that session type get an inert stub.
const weaknessesStub = () =>
  ({
    struggledQuestionIds: vi.fn().mockResolvedValue([]),
    summary: vi.fn().mockResolvedValue({ windowDays: 30, totalAttempts: 0, totalStruggles: 0, reasons: [], patterns: [], topics: [] }),
  }) as never;

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
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());

    const result = await service.create(
      { sessionType: 'mixed_mock', difficulty: 'hard', questionCount: 5 },
      'user-1',
    );

    expect(create.mock.calls[0][0].data.sessionQuestions.create).toHaveLength(2);
    expect(create.mock.calls[0][0].data.sessionQuestions.create.map((item: { order: number }) => item.order)).toEqual([1, 2]);
    expect(result.questions).toHaveLength(2);
  });

  it('rejects session creation when no question matches', async () => {
    const service = new SessionsService({ question: { findMany: vi.fn().mockResolvedValue([]) } } as never, { record: vi.fn() } as never, weaknessesStub());
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
    const service = new SessionsService({ question: { findMany }, interviewSession: { create } } as never, { record: vi.fn() } as never, weaknessesStub());

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

  it('creates spaced-review sessions from due review states in due order', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'session-1', status: 'active', sessionQuestions: [] });
    const prisma = {
      reviewState: {
        findMany: vi.fn().mockResolvedValue([
          { objectId: 'q-due-1' },
          { objectId: 'q-due-2' },
        ]),
      },
      question: {
        findMany: vi.fn().mockResolvedValue([{ id: 'q-due-1' }, { id: 'q-due-2' }]),
      },
      interviewSession: { create },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());

    await service.create({ sessionType: 'spaced_review', questionCount: 2 }, 'user-1');

    expect(prisma.reviewState.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', objectType: 'question', suspended: false, due: { lte: expect.any(Date) } },
      orderBy: { due: 'asc' },
      take: 2,
      select: { objectId: true },
    });
    expect(create.mock.calls[0][0].data.sessionQuestions.create).toEqual([
      { questionId: 'q-due-1', order: 1 },
      { questionId: 'q-due-2', order: 2 },
    ]);
  });

  it('skips due review states whose question no longer exists', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'session-1', status: 'active', sessionQuestions: [] });
    const prisma = {
      reviewState: { findMany: vi.fn().mockResolvedValue([{ objectId: 'q-existing' }, { objectId: 'q-orphan' }]) },
      question: { findMany: vi.fn().mockResolvedValue([{ id: 'q-existing' }]) },
      interviewSession: { create },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());

    await service.create({ sessionType: 'spaced_review', questionCount: 5 }, 'user-1');

    expect(create.mock.calls[0][0].data.sessionQuestions.create).toEqual([
      { questionId: 'q-existing', order: 1 },
    ]);
  });

  it('lets explicit question IDs override spaced-review due selection', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'session-1', status: 'active', sessionQuestions: [] });
    const prisma = {
      reviewState: { findMany: vi.fn() },
      question: { findMany: vi.fn().mockResolvedValue([{ id: 'q-picked' }]) },
      interviewSession: { create },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());

    await service.create(
      { sessionType: 'spaced_review', questionCount: 5, questionIds: ['q-picked'] },
      'user-1',
    );

    expect(prisma.reviewState.findMany).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.sessionQuestions.create).toEqual([
      { questionId: 'q-picked', order: 1 },
    ]);
  });

  it('deduplicates exact question IDs while preserving first-seen order', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'session-1', status: 'active', sessionQuestions: [] });
    const findMany = vi.fn().mockResolvedValue([{ id: 'q-2' }, { id: 'q-1' }]);
    const service = new SessionsService({ question: { findMany }, interviewSession: { create } } as never, { record: vi.fn() } as never, weaknessesStub());

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
    } as never, { record: vi.fn() } as never, weaknessesStub());

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
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());

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
    const service = new SessionsService(prisma as never, { record } as never, weaknessesStub());

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
    const service = new SessionsService(prisma as never, { record } as never, weaknessesStub());

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
    const service = new SessionsService(prisma as never, { record } as never, weaknessesStub());

    const result = await service.answer('session-1', { questionId: 'q-1', answerText: 'answer', selfRating: 2 }, 'user-1');

    expect(result).toEqual({ id: 'attempt-1' });
  });

  it('does not expose another users session', async () => {
    const service = new SessionsService({ interviewSession: { findFirst: vi.fn().mockResolvedValue(null) } } as never, { record: vi.fn() } as never, weaknessesStub());
    await expect(service.get('session-1', 'user-2')).rejects.toEqual(new NotFoundException('Session not found'));
  });

  it('allows only one terminal state transition', async () => {
    const prisma = {
      interviewSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ status: 'completed' }),
      },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());
    await expect(service.abandon('session-1', 'user-1'))
      .rejects.toEqual(new ConflictException('Session is already completed'));
  });
});

describe('SessionsService — weak_area_review selection', () => {
  it('leads with struggled questions and fills with weak-pattern siblings', async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({
      id: 'session-1',
      status: 'active',
      sessionQuestions: data.sessionQuestions.create.map((item: { questionId: string; order: number }) => ({
        id: `sq-${item.order}`,
        sessionId: 'session-1',
        questionId: item.questionId,
        order: item.order,
        question: { id: item.questionId, topic: { id: 't', name: 'T' }, companies: [] },
      })),
    }));
    const prisma = {
      interviewSession: { create },
      question: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'sibling-1', patternTags: ['sliding-window'], topicId: 'topic-dsa', importance: 2 },
          { id: 'sibling-2', patternTags: ['two-pointers'], topicId: 'topic-other', importance: 1 },
        ]),
      },
    };
    const weaknesses = {
      struggledQuestionIds: vi.fn().mockResolvedValue(['struggle-1', 'struggle-2']),
      summary: vi.fn().mockResolvedValue({
        windowDays: 30,
        totalAttempts: 5,
        totalStruggles: 3,
        reasons: [],
        patterns: [{ key: 'sliding-window', label: 'sliding-window', struggles: 2, attempts: 3, lastAt: '', questionIds: [] }],
        topics: [{ key: 'topic-dsa', label: 'DSA', struggles: 2, attempts: 4, lastAt: '', questionIds: [] }],
      }),
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknesses as never);

    const result = await service.create({ sessionType: 'weak_area_review', questionCount: 3 }, 'user-1');

    const chosen = result.questions.map((question) => question.questionId);
    // Redo items lead (capped at 2/3 of 3 = 2), then a sibling fills the rest.
    expect(chosen.slice(0, 2)).toEqual(['struggle-1', 'struggle-2']);
    expect(chosen).toHaveLength(3);
    expect(['sibling-1', 'sibling-2']).toContain(chosen[2]);
    // Sibling lookup must exclude questions already being redone.
    expect(prisma.question.findMany.mock.calls[0][0].where.id).toEqual({ notIn: ['struggle-1', 'struggle-2'] });
  });

  it('falls back to the plain filtered draw when there is no struggle history yet', async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({
      id: 'session-1',
      status: 'active',
      sessionQuestions: data.sessionQuestions.create.map((item: { questionId: string; order: number }) => ({
        id: `sq-${item.order}`,
        sessionId: 'session-1',
        questionId: item.questionId,
        order: item.order,
        question: { id: item.questionId, topic: { id: 't', name: 'T' }, companies: [] },
      })),
    }));
    const prisma = {
      interviewSession: { create },
      question: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'q-1', roleTags: [], areaTags: [], patternTags: [], importance: 1 },
        ]),
      },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());

    const result = await service.create({ sessionType: 'weak_area_review', questionCount: 2 }, 'user-1');

    expect(result.questions.map((question) => question.questionId)).toEqual(['q-1']);
  });
});

describe('SessionsService — mixed_interview selection (MOM-127)', () => {
  const captureCreate = () =>
    vi.fn().mockImplementation(({ data }) => ({
      id: 'session-1',
      status: 'active',
      sessionQuestions: data.sessionQuestions.create.map((item: { questionId: string; order: number }) => ({
        id: `sq-${item.order}`,
        sessionId: 'session-1',
        questionId: item.questionId,
        order: item.order,
        question: { id: item.questionId, topic: { id: 't', name: 'T' }, companies: [] },
      })),
    }));

  it('interleaves recently-struggled questions with a fresh cross-area draw', async () => {
    const create = captureCreate();
    const prisma = {
      interviewSession: { create },
      question: {
        // Distinct importances make the filtered sort deterministic despite the shuffle.
        findMany: vi.fn().mockResolvedValue([
          { id: 'fresh-1', roleTags: [], areaTags: [], patternTags: [], importance: 3 },
          { id: 'fresh-2', roleTags: [], areaTags: [], patternTags: [], importance: 2 },
          { id: 'fresh-3', roleTags: [], areaTags: [], patternTags: [], importance: 1 },
        ]),
      },
    };
    const weaknesses = {
      struggledQuestionIds: vi.fn().mockResolvedValue(['struggle-1', 'struggle-2']),
      summary: vi.fn(),
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknesses as never);

    const result = await service.create({ sessionType: 'mixed_interview', questionCount: 4 }, 'user-1');

    // weakSlots = floor(4/2) = 2 → [struggle-1, struggle-2] interleaved with fresh.
    expect(result.questions.map((question) => question.questionId)).toEqual([
      'struggle-1',
      'fresh-1',
      'struggle-2',
      'fresh-2',
    ]);
  });

  it('falls back to a plain filtered draw when there is no struggle history', async () => {
    const create = captureCreate();
    const prisma = {
      interviewSession: { create },
      question: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'only-1', roleTags: [], areaTags: [], patternTags: [], importance: 1 },
        ]),
      },
    };
    const service = new SessionsService(prisma as never, { record: vi.fn() } as never, weaknessesStub());

    const result = await service.create({ sessionType: 'mixed_interview', questionCount: 3 }, 'user-1');

    expect(result.questions.map((question) => question.questionId)).toEqual(['only-1']);
  });
});
