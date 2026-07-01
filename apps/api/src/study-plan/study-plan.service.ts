import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudyPlanItemDto } from './dto/create-study-plan-item.dto';
import { ListStudyPlanDto } from './dto/list-study-plan.dto';
import { UpdateStudyPlanItemDto } from './dto/update-study-plan-item.dto';

const includeTopic = { topic: { select: { id: true, name: true } } } satisfies Prisma.StudyPlanItemInclude;

@Injectable()
export class StudyPlanService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListStudyPlanDto, userId: string) {
    return this.prisma.studyPlanItem.findMany({
      where: { userId, ...(query.status && { status: query.status }) },
      include: includeTopic,
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: CreateStudyPlanItemDto, userId: string) {
    return this.prisma.studyPlanItem.create({
      data: {
        userId,
        title: dto.title.trim(),
        topicId: dto.topicId,
        notes: dto.notes,
        targetDate: this.parseDate(dto.targetDate),
      },
      include: includeTopic,
    });
  }

  async update(id: string, dto: UpdateStudyPlanItemDto, userId: string) {
    const { title, targetDate, ...data } = dto;
    const result = await this.prisma.studyPlanItem.updateMany({
      where: { id, userId },
      data: {
        ...data,
        ...(title !== undefined && { title: title.trim() }),
        ...(targetDate !== undefined && { targetDate: this.parseDate(targetDate) }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Study plan item not found');
    return this.prisma.studyPlanItem.findUniqueOrThrow({ where: { id }, include: includeTopic });
  }

  async remove(id: string, userId: string) {
    const result = await this.prisma.studyPlanItem.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Study plan item not found');
  }

  private parseDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined || value === null) return value;
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
