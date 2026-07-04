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
    const needsTagFilter = Boolean(query.role || query.area || query.pattern);

    if (needsTagFilter) {
      const candidates = await this.prisma.question.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
      });
      const filtered = candidates.filter((question) => this.matchesTags(question, query));
      const data = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);
      return { data: data.map((question) => this.serialize(question)), total: filtered.length, page: query.page, limit: query.limit };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({ where, include: listInclude, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.question.count({ where }),
    ]);
    return { data: data.map((question) => this.serialize(question)), total, page: query.page, limit: query.limit };
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
    const { companyIds = [], topicId, roleTags, areaTags, patternTags, rubric, ...data } = dto;
    const question = await this.prisma.question.create({
      data: {
        ...data,
        roleTags: roleTags ?? [],
        areaTags: areaTags ?? [],
        patternTags: patternTags ?? [],
        rubric: (rubric ?? {}) as Prisma.InputJsonValue,
        topic: { connect: { id: topicId } },
        createdBy: { connect: { id: userId } },
        companies: { create: [...new Set(companyIds)].map((companyId) => ({ companyId })) },
      },
      include: listInclude,
    });
    return this.serialize(question);
  }

  async update(id: string, dto: UpdateQuestionDto) {
    await this.ensureExists(id);
    const { companyIds, topicId, roleTags, areaTags, patternTags, rubric, ...data } = dto;
    const updateData: Prisma.QuestionUpdateInput = {
      ...data,
      ...(topicId && { topic: { connect: { id: topicId } } }),
      ...(roleTags && { roleTags }),
      ...(areaTags && { areaTags }),
      ...(patternTags && { patternTags }),
      ...(rubric && { rubric: rubric as Prisma.InputJsonValue }),
      ...(companyIds && {
        companies: {
          deleteMany: {},
          create: [...new Set(companyIds)].map((companyId) => ({ companyId })),
        },
      }),
    };
    const question = await this.prisma.question.update({
      where: { id },
      data: updateData,
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
      roleTags: this.asStringArray(question.roleTags),
      areaTags: this.asStringArray(question.areaTags),
      patternTags: this.asStringArray(question.patternTags),
      rubric: this.asRecord(question.rubric),
      companies: question.companies.map(({ company }) => company),
    };
  }

  private matchesTags(question: QuestionWithRelations, query: ListQuestionsDto): boolean {
    const roleTags = this.asStringArray(question.roleTags);
    const areaTags = this.asStringArray(question.areaTags);
    const patternTags = this.asStringArray(question.patternTags);
    return (!query.role || roleTags.length === 0 || roleTags.includes(query.role)) &&
      (!query.area || areaTags.length === 0 || areaTags.includes(query.area)) &&
      (!query.pattern || patternTags.map((tag) => tag.toLowerCase()).includes(query.pattern.toLowerCase()));
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
