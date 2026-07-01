import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsDto } from './dto/list-sessions.dto';

const questionInclude = {
  question: {
    include: {
      topic: { select: { id: true, name: true } },
      companies: { include: { company: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.SessionQuestionInclude;

type SessionQuestionWithQuestion = Prisma.SessionQuestionGetPayload<{ include: typeof questionInclude }>;

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSessionDto, userId: string) {
    const { topicId, companyId, difficulty, questionCount, questionIds, ...sessionData } = dto;
    const selected = questionIds
      ? await this.selectExactQuestions(questionIds)
      : await this.selectFilteredQuestions({ topicId, companyId, difficulty, questionCount });

    if (selected.length === 0) throw new BadRequestException('No questions match the selected filters');

    const session = await this.prisma.interviewSession.create({
      data: {
        ...sessionData,
        userId,
        sessionQuestions: {
          create: selected.map(({ id: questionId }, index) => ({ questionId, order: index + 1 })),
        },
      },
      include: { sessionQuestions: { include: questionInclude, orderBy: { order: 'asc' } } },
    });
    const { sessionQuestions, ...rest } = session;
    return { session: rest, questions: sessionQuestions.map(this.serializeSessionQuestion) };
  }

  private async selectExactQuestions(questionIds: string[]) {
    const uniqueQuestionIds = [...new Set(questionIds)];
    const candidates = await this.prisma.question.findMany({
      where: { id: { in: uniqueQuestionIds } },
      select: { id: true },
    });
    const existingIds = new Set(candidates.map(({ id }) => id));
    if (questionIds.length === 0 || uniqueQuestionIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('One or more selected questions do not exist');
    }
    return uniqueQuestionIds.map((id) => ({ id }));
  }

  private async selectFilteredQuestions(filters: {
    topicId?: string;
    companyId?: string;
    difficulty?: string;
    questionCount: number;
  }) {
    const candidates = await this.prisma.question.findMany({
      where: {
        ...(filters.topicId && { topicId: filters.topicId }),
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.companyId && { companies: { some: { companyId: filters.companyId } } }),
      },
      select: { id: true },
    });
    return this.shuffle(candidates).slice(0, filters.questionCount);
  }

  async list(query: ListSessionsDto, userId: string) {
    const where: Prisma.InterviewSessionWhereInput = { userId, ...(query.status && { status: query.status }) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.interviewSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { sessionQuestions: true, answerAttempts: true } } },
      }),
      this.prisma.interviewSession.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async get(id: string, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id, userId },
      include: {
        sessionQuestions: { include: questionInclude, orderBy: { order: 'asc' } },
        answerAttempts: { where: { userId }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return {
      ...session,
      sessionQuestions: session.sessionQuestions.map(this.serializeSessionQuestion),
    };
  }

  async answer(id: string, dto: CreateAnswerDto, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id, userId },
      select: { status: true, sessionQuestions: { where: { questionId: dto.questionId }, select: { id: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'active') throw new ConflictException('Session is not active');
    if (session.sessionQuestions.length === 0) {
      throw new BadRequestException('Question is not part of this session');
    }
    return this.prisma.answerAttempt.create({
      data: { ...dto, sessionId: id, userId },
      include: { question: { select: { id: true, title: true } } },
    });
  }

  complete(id: string, userId: string) {
    return this.finish(id, userId, 'completed');
  }

  abandon(id: string, userId: string) {
    return this.finish(id, userId, 'abandoned');
  }

  private async finish(id: string, userId: string, status: 'completed' | 'abandoned') {
    const result = await this.prisma.interviewSession.updateMany({
      where: { id, userId, status: 'active' },
      data: { status, endedAt: new Date() },
    });
    if (result.count === 1) {
      return this.prisma.interviewSession.findUniqueOrThrow({ where: { id } });
    }
    const existing = await this.prisma.interviewSession.findFirst({ where: { id, userId }, select: { status: true } });
    if (!existing) throw new NotFoundException('Session not found');
    throw new ConflictException(`Session is already ${existing.status}`);
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapWith]] = [result[swapWith], result[index]];
    }
    return result;
  }

  private serializeSessionQuestion(item: SessionQuestionWithQuestion) {
    return {
      ...item,
      question: {
        ...item.question,
        companies: item.question.companies.map(({ company }) => company),
      },
    };
  }
}
