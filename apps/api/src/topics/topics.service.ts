import { Injectable, NotFoundException } from '@nestjs/common';
import { rethrowDeleteConstraint } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.topic.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateTopicDto) {
    return this.prisma.topic.create({ data: dto });
  }

  async update(id: string, dto: UpdateTopicDto) {
    await this.ensureExists(id);
    return this.prisma.topic.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    try {
      await this.prisma.topic.delete({ where: { id } });
    } catch (error) {
      rethrowDeleteConstraint(error, 'Topic is used by questions and cannot be deleted.');
    }
  }

  private async ensureExists(id: string) {
    if (!(await this.prisma.topic.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Topic not found');
    }
  }
}
