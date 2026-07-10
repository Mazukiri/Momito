import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ContactsService } from '../src/contacts/contacts.service';

const now = new Date('2026-07-10T00:00:00.000Z');

function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1', userId: 'user-1', jobApplicationId: null, name: 'Jane Recruiter',
    email: null, linkedinUrl: null, company: null, relationship: 'recruiter', notes: null,
    createdAt: now, updatedAt: now, ...overrides,
  };
}

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    contact: {
      findMany: vi.fn().mockResolvedValue([contactRow()]),
      create: vi.fn().mockImplementation(({ data }) => contactRow(data)),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(contactRow()),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    jobApplication: { findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    ...overrides,
  };
  return { service: new ContactsService(prisma as never), prisma };
}

describe('ContactsService (MOM-116/117)', () => {
  it('serializes the row into a typed ContactResponse', async () => {
    const { service } = makeService();
    const [contact] = await service.list('user-1');
    expect(contact).toMatchObject({ id: 'c-1', name: 'Jane Recruiter', relationship: 'recruiter', jobApplicationId: null });
    expect(contact.createdAt).toBe(now.toISOString());
  });

  it('creates a standalone contact, validating a supplied job link', async () => {
    const { service, prisma } = makeService();
    await service.create({ name: 'Ref Person', relationship: 'referrer', jobApplicationId: 'job-1' } as never, 'user-1');
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({ where: { id: 'job-1', userId: 'user-1' }, select: { id: true } });
    expect(prisma.contact.create.mock.calls[0][0].data).toMatchObject({ name: 'Ref Person', relationship: 'referrer', jobApplicationId: 'job-1', userId: 'user-1' });
  });

  it('rejects a standalone contact linked to someone else\'s job', async () => {
    const { service } = makeService({ jobApplication: { findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(service.create({ name: 'X', jobApplicationId: 'job-x' } as never, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createForJob takes the job from the path and lists by that job', async () => {
    const { service, prisma } = makeService();
    await service.createForJob('job-1', { name: 'Hiring Mgr', relationship: 'hiring_manager' } as never, 'user-1');
    expect(prisma.contact.create.mock.calls[0][0].data).toMatchObject({ jobApplicationId: 'job-1', name: 'Hiring Mgr' });

    await service.listForJob('job-1', 'user-1');
    expect(prisma.contact.findMany).toHaveBeenLastCalledWith({ where: { userId: 'user-1', jobApplicationId: 'job-1' }, orderBy: [{ createdAt: 'asc' }] });
  });

  it('throws NotFound updating a contact that is not the user\'s', async () => {
    const { service } = makeService({
      contact: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: vi.fn() },
      jobApplication: { findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    });
    await expect(service.update('missing', { name: 'x' } as never, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound removing a contact that is not the user\'s', async () => {
    const { service } = makeService({ contact: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } });
    await expect(service.remove('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
