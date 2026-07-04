import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../src/profile/profile.service';

const now = new Date('2026-07-03T00:00:00.000Z');

function profileRecord(overrides: object = {}) {
  return {
    id: 'profile-1',
    userId: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    githubUrl: 'https://github.com/ada',
    linkedinUrl: null,
    skills: ['TypeScript', 'PostgreSQL'],
    experience: [],
    education: [],
    projects: [],
    rawCvText: 'Ada Lovelace\nada@example.com',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ProfileService', () => {
  it('rejects non-PDF uploads before parsing', async () => {
    const service = new ProfileService({ profile: { upsert: vi.fn() } } as never, { extractText: vi.fn() } as never);

    await expect(service.uploadCv({
      originalname: 'cv.txt',
      mimetype: 'text/plain',
      size: 12,
      buffer: Buffer.from('not pdf'),
    }, 'user-1')).rejects.toEqual(new BadRequestException('Only PDF CV files are accepted.'));
  });

  it('parses a CV and upserts the authenticated users profile', async () => {
    const upsert = vi.fn().mockImplementation(({ create }) => profileRecord(create));
    const service = new ProfileService(
      { profile: { upsert } } as never,
      { extractText: vi.fn().mockResolvedValue('Ada Lovelace\nada@example.com\nhttps://github.com/ada\nTypeScript PostgreSQL CUDA') } as never,
    );

    const result = await service.uploadCv({
      originalname: 'cv.pdf',
      mimetype: 'application/pdf',
      size: 100,
      buffer: Buffer.from('%PDF'),
    }, 'user-1');

    expect(upsert.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
    expect(result.email).toBe('ada@example.com');
    expect(result.skills).toContain('TypeScript');
    expect(result.skills).toContain('CUDA');
    expect(result.createdAt).toBe(now.toISOString());
  });

  it('returns 404 when the user has no profile', async () => {
    const service = new ProfileService(
      { profile: { findUnique: vi.fn().mockResolvedValue(null) } } as never,
      { extractText: vi.fn() } as never,
    );

    await expect(service.get('user-1')).rejects.toEqual(new NotFoundException('No profile yet. Upload your CV first.'));
  });

  it('trims profile updates and deduplicates skills', async () => {
    const upsert = vi.fn().mockImplementation(({ create }) => profileRecord(create));
    const service = new ProfileService(
      { profile: { upsert } } as never,
      { extractText: vi.fn() } as never,
    );

    const result = await service.update('user-1', {
      name: '  Ada  ',
      email: '',
      skills: ['Python', 'Python', ' SQL '],
      projects: [{
        name: 'Backtesting',
        url: '',
        type: 'research',
        githubStars: 3,
        description: 'quant research project',
      }],
    });

    expect(upsert.mock.calls[0][0].create).toMatchObject({
      userId: 'user-1',
      name: 'Ada',
      email: null,
      skills: ['Python', 'SQL'],
      projects: [{
        name: 'Backtesting',
        url: null,
        type: 'research',
        githubStars: 3,
        description: 'quant research project',
      }],
    });
    expect(result.skills).toEqual(['Python', 'SQL']);
  });
});
