import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { CreateAttemptDto } from './dto/create-attempt.dto';
import { ListAttemptsDto } from './dto/list-attempts.dto';
import { UpdateAttemptDto } from './dto/update-attempt.dto';

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger('AttemptsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async list(query: ListAttemptsDto, userId: string, forcedQuestionId?: string) {
    const where: Prisma.AnswerAttemptWhereInput = {
      userId,
      ...(query.questionId && { questionId: query.questionId }),
      ...(query.sessionId && { sessionId: query.sessionId }),
      ...(forcedQuestionId && { questionId: forcedQuestionId }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.answerAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          question: { select: { id: true, title: true, difficulty: true, type: true } },
          session: { select: { id: true, title: true, sessionType: true, status: true } },
        },
      }),
      this.prisma.answerAttempt.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async get(id: string, userId: string) {
    const attempt = await this.prisma.answerAttempt.findFirst({
      where: { id, userId },
      include: {
        question: true,
        session: { select: { id: true, title: true, sessionType: true, status: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  // Standalone attempt — no session required. The Today queue's inline review
  // flow uses this so a typed recall is a real attempt (history, streak,
  // weakness signals) rather than a bare FSRS rating with no evidence behind
  // it. Same review-scheduling side effect as sessions.answer (MOM-031).
  async create(dto: CreateAttemptDto, userId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      select: { id: true },
    });
    if (!question) throw new NotFoundException('Question not found');

    const attempt = await this.prisma.answerAttempt.create({
      data: { ...dto, userId },
      include: { question: { select: { id: true, title: true } } },
    });
    await this.scheduleReviewIfRated(userId, dto.questionId, dto.selfRating);
    return attempt;
  }

  // Post-reveal update (plan §7.2: Submit → Reveal → Reflect → Self-rate).
  // Rating here (re)schedules the FSRS review just like rating at submit time
  // did — the learning loop must close no matter which step carried the grade.
  async update(id: string, dto: UpdateAttemptDto, userId: string) {
    const existing = await this.prisma.answerAttempt.findFirst({
      where: { id, userId },
      select: { id: true, questionId: true },
    });
    if (!existing) throw new NotFoundException('Attempt not found');

    const attempt = await this.prisma.answerAttempt.update({
      where: { id: existing.id },
      data: dto,
      include: { question: { select: { id: true, title: true } } },
    });
    await this.scheduleReviewIfRated(userId, existing.questionId, dto.selfRating);
    return attempt;
  }

  // A scheduling failure must never break the attempt write — the attempt
  // itself already succeeded (same contract as sessions.service.ts).
  private async scheduleReviewIfRated(userId: string, questionId: string, selfRating?: number) {
    if (selfRating === undefined) return;
    try {
      await this.reviews.record(userId, 'question', questionId, selfRating);
    } catch (error) {
      this.logger.warn(`Failed to update review schedule for question ${questionId}: ${error}`);
    }
  }
}
