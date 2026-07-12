import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OffersService } from '../src/offers/offers.service';

const now = new Date('2026-07-10T00:00:00.000Z');

function offerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o-1', userId: 'user-1', jobApplicationId: 'job-1',
    baseSalary: 180000, bonus: 20000, equityTotal: 200000, equityYears: 4,
    currency: 'USD', location: 'Remote', visaSponsored: true, deadline: new Date('2026-08-01T00:00:00.000Z'),
    notes: null, status: 'received', createdAt: now, updatedAt: now,
    jobApplication: { company: 'Meta' }, ...overrides,
  };
}

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    offer: {
      findMany: vi.fn().mockResolvedValue([offerRow()]),
      findUnique: vi.fn().mockResolvedValue(offerRow()),
      upsert: vi.fn().mockImplementation(({ create, update }) => offerRow({ ...create, ...update })),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    jobApplication: { findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    ...overrides,
  };
  return { service: new OffersService(prisma as never), prisma };
}

describe('OffersService (MOM-114/115)', () => {
  it('computes the normalized annual total = base + bonus + equity/years', async () => {
    const { service } = makeService();
    const [offer] = await service.list('user-1');
    // 180000 + 20000 + 200000/4 = 250000
    expect(offer.normalizedAnnualTotal).toBe(250000);
    expect(offer.company).toBe('Meta');
    expect(offer.baseSalary).toBe(180000);
  });

  it('returns a null normalized total when no comp figures are set', async () => {
    const { service } = makeService({
      offer: { findUnique: vi.fn().mockResolvedValue(offerRow({ baseSalary: null, bonus: null, equityTotal: null })) },
      jobApplication: { findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    });
    const offer = await service.getForJob('job-1', 'user-1');
    expect(offer?.normalizedAnnualTotal).toBeNull();
  });

  it('upserts the single per-job offer and validates job ownership', async () => {
    const { service, prisma } = makeService();
    await service.upsertForJob('job-1', { baseSalary: 200000, status: 'negotiating' } as never, 'user-1');
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({ where: { id: 'job-1', userId: 'user-1' }, select: { id: true } });
    const call = prisma.offer.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ jobApplicationId: 'job-1' });
    expect(call.create).toMatchObject({ userId: 'user-1', jobApplicationId: 'job-1', baseSalary: 200000, status: 'negotiating' });
  });

  it('normalizes currency to upper case', async () => {
    const { service, prisma } = makeService();
    await service.upsertForJob('job-1', { currency: 'gbp' } as never, 'user-1');
    expect(prisma.offer.upsert.mock.calls[0][0].update).toMatchObject({ currency: 'GBP' });
  });

  it('throws NotFound removing an offer for a job with none', async () => {
    const { service } = makeService({
      offer: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      jobApplication: { findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    });
    await expect(service.removeForJob('job-1', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the job is not the user\'s', async () => {
    const { service } = makeService({ jobApplication: { findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(service.getForJob('job-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
