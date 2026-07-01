import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAttemptsDto } from './dto/list-attempts.dto';

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
