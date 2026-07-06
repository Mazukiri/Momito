import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

const storyInclude = {
  companies: { include: { company: { select: { id: true, name: true } } } },
  prompts: { include: { question: { select: { id: true, title: true } } } },
} satisfies Prisma.StoryInclude;

type StoryWithRelations = Prisma.StoryGetPayload<{ include: typeof storyInclude }>;

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const stories = await this.prisma.story.findMany({
      where: { userId },
      include: storyInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return stories.map((story) => this.serialize(story));
  }

  async get(id: string, userId: string) {
    const story = await this.prisma.story.findFirst({ where: { id, userId }, include: storyInclude });
    if (!story) throw new NotFoundException('Story not found');
    return this.serialize(story);
  }

  async create(dto: CreateStoryDto, userId: string) {
    const { companyIds = [], ...data } = dto;
    const story = await this.prisma.story.create({
      data: {
        ...data,
        competencyTags: dto.competencyTags ?? [],
        followUpQuestions: dto.followUpQuestions ?? [],
        user: { connect: { id: userId } },
        companies: { create: [...new Set(companyIds)].map((companyId) => ({ companyId })) },
      },
      include: storyInclude,
    });
    return this.serialize(story);
  }

  async update(id: string, dto: UpdateStoryDto, userId: string) {
    await this.ensureOwned(id, userId);
    const { companyIds, ...data } = dto;
    const story = await this.prisma.story.update({
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
      include: storyInclude,
    });
    return this.serialize(story);
  }

  async remove(id: string, userId: string) {
    await this.ensureOwned(id, userId);
    // ADR-0003/ADR-0002: ReviewState.objectId has no DB-level foreign key (it's
    // polymorphic), so deleting a Story would otherwise silently orphan any
    // ReviewState row pointing at it. Clean it up in the same transaction as
    // the delete itself, matching questions.service.ts's remove().
    await this.prisma.$transaction([
      this.prisma.reviewState.deleteMany({ where: { objectType: 'story', objectId: id } }),
      this.prisma.story.delete({ where: { id } }),
    ]);
  }

  // MOM-066: link a story to a behavioral prompt (Question) it can answer.
  // Idempotent — linking an already-linked pair just returns the current state,
  // matching how re-submitting a form shouldn't produce a duplicate-key error.
  async linkPrompt(storyId: string, questionId: string, userId: string) {
    await this.ensureOwned(storyId, userId);
    const question = await this.prisma.question.findUnique({ where: { id: questionId }, select: { id: true, type: true } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.type !== 'behavioral') {
      throw new BadRequestException('Stories can only be linked to behavioral prompts');
    }
    const existing = await this.prisma.storyPrompt.findUnique({
      where: { storyId_questionId: { storyId, questionId } },
    });
    if (!existing) {
      await this.prisma.storyPrompt.create({ data: { storyId, questionId } });
    }
    const story = await this.prisma.story.findUniqueOrThrow({ where: { id: storyId }, include: storyInclude });
    return this.serialize(story);
  }

  async unlinkPrompt(storyId: string, questionId: string, userId: string) {
    await this.ensureOwned(storyId, userId);
    await this.prisma.storyPrompt.deleteMany({ where: { storyId, questionId } });
    const story = await this.prisma.story.findUniqueOrThrow({ where: { id: storyId }, include: storyInclude });
    return this.serialize(story);
  }

  private async ensureOwned(id: string, userId: string) {
    const story = await this.prisma.story.findFirst({ where: { id, userId }, select: { id: true } });
    if (!story) throw new NotFoundException('Story not found');
  }

  private serialize(story: StoryWithRelations) {
    return {
      ...story,
      companies: story.companies.map(({ company }) => company),
      prompts: story.prompts.map(({ question }) => ({ questionId: question.id, questionTitle: question.title })),
    };
  }
}
