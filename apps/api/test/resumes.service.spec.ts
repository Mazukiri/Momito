import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ResumesService } from '../src/resumes/resumes.service';

const now = new Date('2026-07-10T00:00:00.000Z');

function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rv-1', userId: 'user-1', jobApplicationId: null, label: 'Base', targetRoleTrackId: null,
    contentMd: '# Me', baseProfileSnapshot: null, aiSuggestions: [], createdAt: now, updatedAt: now,
    jobApplication: null, ...overrides,
  };
}

const profile = {
  name: 'Ada Lovelace', email: 'ada@x.com', githubUrl: 'https://github.com/ada', linkedinUrl: null,
  skills: ['TypeScript', 'Rust'],
  experience: [{ company: 'Meta', role: 'SWE', years: 3, tier: 'big', description: 'Built X.' }],
  education: [{ degree: 'BSc CS', institution: 'MIT', country: 'US', year: 2020 }],
  projects: [{ name: 'Momito', url: 'https://momito.dev', description: 'A study OS.', type: 'web', githubStars: 5 }],
};

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    resumeVersion: {
      findMany: vi.fn().mockResolvedValue([versionRow()]),
      findFirst: vi.fn().mockResolvedValue(versionRow()),
      create: vi.fn().mockImplementation(({ data }) => versionRow(data)),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    profile: { findUnique: vi.fn().mockResolvedValue(profile) },
    jobApplication: { findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    ...overrides,
  };
  return { service: new ResumesService(prisma as never), prisma };
}

describe('ResumesService.profileToMarkdown (MOM-132)', () => {
  it('renders the profile as structured Markdown sections', () => {
    const { service } = makeService();
    const md = service.profileToMarkdown(profile as never);
    expect(md).toContain('# Ada Lovelace');
    expect(md).toContain('ada@x.com · https://github.com/ada');
    expect(md).toContain('## Skills\nTypeScript, Rust');
    expect(md).toContain('### SWE — Meta (3y)');
    expect(md).toContain('### [Momito](https://momito.dev)');
    expect(md).toContain('- BSc CS, MIT (2020)');
  });
});

describe('ResumesService (MOM-133)', () => {
  it('derives contentMd from the profile when none is supplied, snapshotting it', async () => {
    const { service, prisma } = makeService();
    const result = await service.create({ label: 'Meta v1' } as never, 'user-1');
    const data = prisma.resumeVersion.create.mock.calls[0][0].data;
    expect(data.contentMd).toContain('# Ada Lovelace');
    expect(data.baseProfileSnapshot).toMatchObject({ name: 'Ada Lovelace' });
    expect(result.label).toBe('Meta v1');
  });

  it('uses supplied contentMd verbatim and does not snapshot', async () => {
    const { service, prisma } = makeService();
    await service.create({ label: 'Custom', contentMd: '# Custom CV' } as never, 'user-1');
    const data = prisma.resumeVersion.create.mock.calls[0][0].data;
    expect(data.contentMd).toBe('# Custom CV');
    expect(data.baseProfileSnapshot).toBeUndefined();
  });

  it('rejects deriving from a missing profile', async () => {
    const { service } = makeService({ profile: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.create({ label: 'x' } as never, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates a supplied job link and throws NotFound on a foreign job', async () => {
    const { service } = makeService({ jobApplication: { findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(service.create({ label: 'x', jobApplicationId: 'job-x', contentMd: '#' } as never, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound updating/removing a version that is not the user\'s', async () => {
    const upd = makeService({ resumeVersion: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, jobApplication: { findFirst: vi.fn() } });
    await expect(upd.service.update('missing', { label: 'x' } as never, 'user-1')).rejects.toBeInstanceOf(NotFoundException);

    const del = makeService({ resumeVersion: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } });
    await expect(del.service.remove('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
