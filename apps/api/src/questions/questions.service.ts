import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rethrowDeleteConstraint } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

const listInclude = {
  topic: { select: { id: true, name: true } },
  companies: { include: { company: { select: { id: true, name: true } } } },
} satisfies Prisma.QuestionInclude;

type QuestionWithRelations = Prisma.QuestionGetPayload<{ include: typeof listInclude }>;

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuestionsDto) {
    const companyIsId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(query.company ?? '');
    const where: Prisma.QuestionWhereInput = {
      ...(query.topic && { topicId: query.topic }),
      ...(query.difficulty && { difficulty: query.difficulty }),
      ...(query.type && { type: query.type }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { prompt: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.company && {
        companies: {
          some: companyIsId
            ? { companyId: query.company }
            : { company: { name: { equals: query.company, mode: 'insensitive' } } },
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.question.count({ where }),
    ]);
    return { data: data.map(this.serialize), total, page: query.page, limit: query.limit };
  }

  async get(id: string, userId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        ...listInclude,
        answerAttempts: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!question) throw new NotFoundException('Question not found');
    const { answerAttempts, ...rest } = question;
    return { ...this.serialize(rest), recentAttempts: answerAttempts };
  }

  async create(dto: CreateQuestionDto, userId: string) {
    const { companyIds = [], ...data } = dto;
    const question = await this.prisma.question.create({
      data: {
        ...data,
        createdByUserId: userId,
        companies: { create: [...new Set(companyIds)].map((companyId) => ({ companyId })) },
      },
      include: listInclude,
    });
    return this.serialize(question);
  }

  async update(id: string, dto: UpdateQuestionDto) {
    await this.ensureExists(id);
    const { companyIds, ...data } = dto;
    const question = await this.prisma.question.update({
      where: { id },
      data: {
        ...data,
        ...(companyIds && {
          companies: {
            deleteMany: {},
            create: [...new Set(companyIds)].map((companyId) => ({ companyId })),
          },
        }),
      },
      include: listInclude,
    });
    return this.serialize(question);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    try {
      await this.prisma.question.delete({ where: { id } });
    } catch (error) {
      rethrowDeleteConstraint(error, 'Question has session history and cannot be deleted.');
    }
  }

  private async ensureExists(id: string) {
    if (!(await this.prisma.question.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Question not found');
    }
  }

  private serialize(question: QuestionWithRelations) {
    return {
      ...question,
      companies: question.companies.map(({ company }) => company),
    };
  }
}
