import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
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
  private readonly logger = new Logger('SessionsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async create(dto: CreateSessionDto, userId: string) {
    const { topicId, companyId, difficulty, questionCount, questionIds, roleTrackId, area, pattern, jobApplicationId, missionId, ...sessionData } = dto;
    if (jobApplicationId) await this.ensureJobBelongsToUser(jobApplicationId, userId);
    if (missionId) await this.ensureMissionBelongsToUser(missionId, userId);
    const selected = questionIds
      ? await this.selectExactQuestions(questionIds)
      : await this.selectFilteredQuestions({ topicId, companyId, difficulty, questionCount, roleTrackId, area, pattern });

    if (selected.length === 0) throw new BadRequestException('No questions match the selected filters');

    const session = await this.prisma.interviewSession.create({
      data: {
        ...sessionData,
        roleTrackId,
        area,
        practiceMode: sessionData.sessionType,
        jobApplicationId,
        missionId,
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
    roleTrackId?: string;
    area?: string;
    pattern?: string;
    questionCount: number;
  }) {
    const candidates = await this.prisma.question.findMany({
      where: {
        ...(filters.topicId && { topicId: filters.topicId }),
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.companyId && { companies: { some: { companyId: filters.companyId } } }),
      },
      select: { id: true, roleTags: true, areaTags: true, patternTags: true, importance: true },
    });
    const filtered = candidates.filter((question) => {
      const roleTags = this.asStringArray(question.roleTags);
      const areaTags = this.asStringArray(question.areaTags);
      const patternTags = this.asStringArray(question.patternTags);
      return (!filters.roleTrackId || roleTags.length === 0 || roleTags.includes(filters.roleTrackId)) &&
        (!filters.area || areaTags.length === 0 || areaTags.includes(filters.area)) &&
        (!filters.pattern || patternTags.map((tag) => tag.toLowerCase()).includes(filters.pattern.toLowerCase()));
    });
    return this.shuffle(filtered)
      .sort((left, right) => right.importance - left.importance)
      .slice(0, filters.questionCount)
      .map(({ id }) => ({ id }));
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
    const attempt = await this.prisma.answerAttempt.create({
      data: { ...dto, sessionId: id, userId },
      include: { question: { select: { id: true, title: true } } },
    });

    // MOM-031: every self-rated answer updates its FSRS review schedule so the
    // Today queue (MOM-032) can eventually surface it when it comes due. Only
    // fires when selfRating is present (it's optional on CreateAnswerDto) since
    // FSRS needs a grade to schedule from. A scheduling failure must never
    // break answer submission — the attempt itself already succeeded.
    if (dto.selfRating !== undefined) {
      try {
        await this.reviews.record(userId, 'question', dto.questionId, dto.selfRating);
      } catch (error) {
        this.logger.warn(`Failed to update review schedule for question ${dto.questionId}: ${error}`);
      }
    }

    return attempt;
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

  private async ensureJobBelongsToUser(jobApplicationId: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobApplicationId, userId }, select: { id: true } });
    if (!job) throw new BadRequestException('Job application not found');
  }

  private async ensureMissionBelongsToUser(missionId: string, userId: string) {
    const mission = await this.prisma.mission.findFirst({ where: { id: missionId, userId }, select: { id: true } });
    if (!mission) throw new BadRequestException('Mission not found');
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
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
