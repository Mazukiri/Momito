import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OfferResponse, OfferStatus } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertOfferDto } from './dto/upsert-offer.dto';

type OfferRow = Prisma.OfferGetPayload<{ include: { jobApplication: { select: { company: true } } } }>;

const offerInclude = { jobApplication: { select: { company: true } } } satisfies Prisma.OfferInclude;

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  // MOM-115: every offer, richest first — the comparison view sorts by the
  // normalized annual total client-side.
  async list(userId: string): Promise<OfferResponse[]> {
    const offers = await this.prisma.offer.findMany({ where: { userId }, include: offerInclude, orderBy: { createdAt: 'desc' } });
    return offers.map((offer) => this.serialize(offer));
  }

  async getForJob(jobId: string, userId: string): Promise<OfferResponse | null> {
    await this.ensureJob(jobId, userId);
    const offer = await this.prisma.offer.findUnique({ where: { jobApplicationId: jobId }, include: offerInclude });
    return offer ? this.serialize(offer) : null;
  }

  // One offer per application — create or update the single row.
  async upsertForJob(jobId: string, dto: UpsertOfferDto, userId: string): Promise<OfferResponse> {
    await this.ensureJob(jobId, userId);
    const data = this.toData(dto);
    const offer = await this.prisma.offer.upsert({
      where: { jobApplicationId: jobId },
      create: { ...data, userId, jobApplicationId: jobId },
      update: data,
      include: offerInclude,
    });
    return this.serialize(offer);
  }

  async removeForJob(jobId: string, userId: string): Promise<void> {
    await this.ensureJob(jobId, userId);
    const result = await this.prisma.offer.deleteMany({ where: { jobApplicationId: jobId, userId } });
    if (result.count === 0) throw new NotFoundException('Offer not found');
  }

  private toData(dto: UpsertOfferDto): Prisma.OfferUncheckedUpdateInput & Prisma.OfferUncheckedCreateInput {
    const data: Record<string, unknown> = {};
    if (dto.baseSalary !== undefined) data.baseSalary = dto.baseSalary;
    if (dto.bonus !== undefined) data.bonus = dto.bonus;
    if (dto.equityTotal !== undefined) data.equityTotal = dto.equityTotal;
    if (dto.equityYears !== undefined) data.equityYears = dto.equityYears;
    if (dto.currency !== undefined) data.currency = dto.currency.trim().toUpperCase();
    if (dto.location !== undefined) data.location = this.clean(dto.location);
    if (dto.visaSponsored !== undefined) data.visaSponsored = dto.visaSponsored;
    if (dto.deadline !== undefined) data.deadline = dto.deadline ? new Date(`${dto.deadline}T00:00:00.000Z`) : null;
    if (dto.notes !== undefined) data.notes = this.clean(dto.notes);
    if (dto.status !== undefined) data.status = dto.status;
    return data as Prisma.OfferUncheckedUpdateInput & Prisma.OfferUncheckedCreateInput;
  }

  private serialize(offer: OfferRow): OfferResponse {
    const base = this.num(offer.baseSalary);
    const bonus = this.num(offer.bonus);
    const equityTotal = this.num(offer.equityTotal);
    const years = offer.equityYears > 0 ? offer.equityYears : 4;
    // Normalized annual comp = base + bonus + amortized equity. Null only when no
    // comp figure at all is set (nothing to compare yet).
    const hasComp = base !== null || bonus !== null || equityTotal !== null;
    const normalizedAnnualTotal = hasComp ? Math.round((base ?? 0) + (bonus ?? 0) + (equityTotal ?? 0) / years) : null;
    return {
      id: offer.id,
      userId: offer.userId,
      jobApplicationId: offer.jobApplicationId,
      company: offer.jobApplication?.company ?? null,
      baseSalary: base,
      bonus,
      equityTotal,
      equityYears: years,
      currency: offer.currency,
      location: offer.location,
      visaSponsored: offer.visaSponsored,
      deadline: offer.deadline ? offer.deadline.toISOString().slice(0, 10) : null,
      notes: offer.notes,
      status: offer.status as OfferStatus,
      normalizedAnnualTotal,
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  private num(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private async ensureJob(jobId: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobId, userId }, select: { id: true } });
    if (!job) throw new NotFoundException('Job not found');
  }

  private clean(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
