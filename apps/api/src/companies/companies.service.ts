import { Injectable, NotFoundException } from '@nestjs/common';
import { rethrowDeleteConstraint } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.company.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateCompanyDto) {
    return this.prisma.company.create({ data: dto });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.ensureExists(id);
    return this.prisma.company.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    try {
      await this.prisma.company.delete({ where: { id } });
    } catch (error) {
      rethrowDeleteConstraint(error, 'Company is in use and cannot be deleted.');
    }
  }

  private async ensureExists(id: string) {
    if (!(await this.prisma.company.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Company not found');
    }
  }
}
