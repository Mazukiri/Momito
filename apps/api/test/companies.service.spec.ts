import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it, vi } from 'vitest';
import { CompaniesService } from '../src/companies/companies.service';
import { CreateCompanyDto } from '../src/companies/dto/create-company.dto';

const now = new Date('2026-07-10T00:00:00.000Z');

function companyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    name: 'Google',
    region: 'Global',
    notes: 'prose',
    focusAreas: { system_design: 5, dsa: 5 },
    roleTrackIds: ['big-tech-swe'],
    interviewProcess: [{ roundType: 'system_design', label: 'System design' }],
    sponsorshipStatus: 'sponsored',
    compBand: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    company: {
      findMany: vi.fn().mockResolvedValue([companyRow()]),
      findUnique: vi.fn().mockResolvedValue(companyRow()),
      create: vi.fn().mockImplementation(({ data }) => companyRow(data)),
      update: vi.fn().mockImplementation(({ data }) => companyRow(data)),
      delete: vi.fn().mockResolvedValue({}),
      ...(overrides.company as object),
    },
  };
  return { service: new CompaniesService(prisma as never), prisma };
}

describe('CompaniesService — structured intelligence (MOM-121)', () => {
  it('serializes the structured columns into a typed response', async () => {
    const { service } = makeService();
    const [company] = await service.list();
    expect(company).toMatchObject({
      focusAreas: { system_design: 5, dsa: 5 },
      roleTrackIds: ['big-tech-swe'],
      sponsorshipStatus: 'sponsored',
    });
    expect(company.interviewProcess[0]).toEqual({ roundType: 'system_design', label: 'System design' });
    expect(company.createdAt).toBe(now.toISOString());
  });

  it('coerces malformed Json (non-object focusAreas, non-array tracks) to safe empties', async () => {
    const { service } = makeService({
      company: { findUnique: vi.fn().mockResolvedValue(companyRow({ focusAreas: 'oops', roleTrackIds: 'nope', interviewProcess: {} })) },
    });
    const company = await service.get('c-1');
    expect(company.focusAreas).toEqual({});
    expect(company.roleTrackIds).toEqual([]);
    expect(company.interviewProcess).toEqual([]);
  });

  it('only writes the keys a PATCH provided (never clobbers focusAreas on a notes-only update)', async () => {
    const { service, prisma } = makeService();
    await service.update('c-1', { notes: 'updated' });
    const data = prisma.company.update.mock.calls[0][0].data;
    expect(data).toEqual({ notes: 'updated' });
    expect(data).not.toHaveProperty('focusAreas');
  });

  it('throws NotFound for a missing company', async () => {
    const { service } = makeService({ company: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CreateCompanyDto validation (MOM-121)', () => {
  async function errorsFor(payload: Record<string, unknown>) {
    return validate(plainToInstance(CreateCompanyDto, payload));
  }

  it('accepts a well-formed structured company', async () => {
    const errors = await errorsFor({
      name: 'Stripe',
      focusAreas: { system_design: 4, lld_oop: 4 },
      roleTrackIds: ['big-tech-swe', 'fullstack-swe'],
      interviewProcess: [{ roundType: 'coding', label: 'Coding' }],
      sponsorshipStatus: 'sponsored',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown focus-area key and an out-of-range weight', async () => {
    const badKey = await errorsFor({ name: 'X', focusAreas: { not_an_area: 3 } });
    expect(badKey.some((e) => e.property === 'focusAreas')).toBe(true);
    const badWeight = await errorsFor({ name: 'X', focusAreas: { dsa: 9 } });
    expect(badWeight.some((e) => e.property === 'focusAreas')).toBe(true);
  });

  it('rejects an invalid role track id and an unknown sponsorship value', async () => {
    const badTrack = await errorsFor({ name: 'X', roleTrackIds: ['not-a-track'] });
    expect(badTrack.some((e) => e.property === 'roleTrackIds')).toBe(true);
    const badVisa = await errorsFor({ name: 'X', sponsorshipStatus: 'maybe' });
    expect(badVisa.some((e) => e.property === 'sponsorshipStatus')).toBe(true);
  });

  it('rejects an interview stage with an invalid round type', async () => {
    const errors = await errorsFor({ name: 'X', interviewProcess: [{ roundType: 'nope', label: 'Bad' }] });
    expect(errors.some((e) => e.property === 'interviewProcess')).toBe(true);
  });
});
