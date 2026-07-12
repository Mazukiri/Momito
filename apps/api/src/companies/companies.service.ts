import { Injectable, NotFoundException } from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import {
  CareerRoleTrackId,
  CompanyFocusAreas,
  CompanyInterviewStage,
  CompanyResponse,
  VisaTag,
} from '@momito/shared';
import { rethrowDeleteConstraint } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CompanyResponse[]> {
    const companies = await this.prisma.company.findMany({ orderBy: { name: 'asc' } });
    return companies.map((company) => this.serialize(company));
  }

  async get(id: string): Promise<CompanyResponse> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { _count: { select: { questions: true, stories: true } } },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      ...this.serialize(company),
      linkedQuestionCount: company._count.questions,
      linkedStoryCount: company._count.stories,
    };
  }

  async create(dto: CreateCompanyDto): Promise<CompanyResponse> {
    const company = await this.prisma.company.create({ data: this.toData(dto) });
    return this.serialize(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<CompanyResponse> {
    await this.ensureExists(id);
    const company = await this.prisma.company.update({ where: { id }, data: this.toData(dto) });
    return this.serialize(company);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    try {
      await this.prisma.company.delete({ where: { id } });
    } catch (error) {
      rethrowDeleteConstraint(error, 'Company is in use and cannot be deleted.');
    }
  }

  // Only writes the keys the DTO actually provided (so a PATCH of just `notes`
  // never clobbers focusAreas). Json fields go through as InputJsonValue.
  private toData(dto: CreateCompanyDto | UpdateCompanyDto): Prisma.CompanyUncheckedCreateInput & Prisma.CompanyUncheckedUpdateInput {
    const data: Record<string, unknown> = {};
    if ('name' in dto && dto.name !== undefined) data.name = dto.name;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.focusAreas !== undefined) data.focusAreas = dto.focusAreas as unknown as Prisma.InputJsonValue;
    if (dto.roleTrackIds !== undefined) data.roleTrackIds = dto.roleTrackIds as unknown as Prisma.InputJsonValue;
    if (dto.interviewProcess !== undefined) data.interviewProcess = dto.interviewProcess as unknown as Prisma.InputJsonValue;
    if (dto.sponsorshipStatus !== undefined) data.sponsorshipStatus = dto.sponsorshipStatus;
    if (dto.compBand !== undefined) data.compBand = dto.compBand;
    return data as Prisma.CompanyUncheckedCreateInput & Prisma.CompanyUncheckedUpdateInput;
  }

  private serialize(company: Company): CompanyResponse {
    return {
      id: company.id,
      name: company.name,
      region: company.region,
      notes: company.notes,
      focusAreas: this.asFocusAreas(company.focusAreas),
      roleTrackIds: this.asStringArray(company.roleTrackIds) as CareerRoleTrackId[],
      interviewProcess: this.asInterviewProcess(company.interviewProcess),
      sponsorshipStatus: (company.sponsorshipStatus as VisaTag | null) ?? null,
      compBand: company.compBand,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  }

  private asFocusAreas(value: Prisma.JsonValue): CompanyFocusAreas {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [area, weight] of Object.entries(value)) {
      if (typeof weight === 'number') out[area] = weight;
    }
    return out as CompanyFocusAreas;
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private asInterviewProcess(value: Prisma.JsonValue): CompanyInterviewStage[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((stage) => {
      if (!stage || typeof stage !== 'object' || Array.isArray(stage)) return [];
      const s = stage as Record<string, unknown>;
      if (typeof s.roundType !== 'string' || typeof s.label !== 'string') return [];
      return [{ roundType: s.roundType, label: s.label, ...(typeof s.notes === 'string' ? { notes: s.notes } : {}) }];
    });
  }

  private async ensureExists(id: string) {
    if (!(await this.prisma.company.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Company not found');
    }
  }
}
