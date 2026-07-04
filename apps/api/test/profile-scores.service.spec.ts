import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProfileScoresService } from '../src/profile-scores/profile-scores.service';

const now = new Date('2026-07-03T00:00:00.000Z');

const profile = {
  id: 'profile-1',
  userId: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  githubUrl: 'https://github.com/ada',
  linkedinUrl: 'https://linkedin.com/in/ada',
  skills: ['Python', 'SQL', 'Algorithms'],
  experience: [
    {
      company: 'Research Lab',
      role: 'Software Engineer',
      years: 1,
      tier: 'Tier1',
      description: 'Built distributed jobs serving 100K users and reduced latency by 30%',
    },
  ],
  education: [],
  projects: [
    {
      name: 'Backtesting engine',
      url: 'https://github.com/ada/backtesting',
      description: 'research quant backtesting system',
      type: 'research',
      githubStars: 20,
    },
  ],
  rawCvText: null,
  createdAt: now,
  updatedAt: now,
};

function scoreRecord(data: Record<string, unknown>) {
  return {
    id: 'score-1',
    userId: data.userId,
    profileId: data.profileId,
    targetId: data.targetId,
    targetLabel: data.targetLabel,
    roleTemplate: data.roleTemplate,
    jdText: data.jdText ?? null,
    skillsMatch: data.skillsMatch,
    projectQuality: data.projectQuality,
    experienceDepth: data.experienceDepth,
    presentation: data.presentation,
    skillsGaps: data.skillsGaps,
    projectGaps: data.projectGaps,
    experienceGaps: data.experienceGaps,
    presentationGaps: data.presentationGaps,
    suggestions: data.suggestions,
    createdAt: now,
  };
}

describe('ProfileScoresService', () => {
  it('creates a deterministic four-category profile score', async () => {
    const create = vi.fn().mockImplementation(({ data }) => scoreRecord(data));
    const service = new ProfileScoresService({
      profile: { findUnique: vi.fn().mockResolvedValue(profile) },
      profileScore: { create },
    } as never);

    const result = await service.create({ role: 'quant-hedge-fund-swe' }, 'user-1');

    expect(create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      profileId: 'profile-1',
      targetId: 'quant-hedge-fund-swe',
      targetLabel: 'Quant Hedge Fund SWE',
    });
    expect(result.skillsMatch).toBeGreaterThan(0);
    expect(result.projectQuality).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('adds custom JD skills to required skill gaps', async () => {
    const create = vi.fn().mockImplementation(({ data }) => scoreRecord(data));
    const service = new ProfileScoresService({
      profile: { findUnique: vi.fn().mockResolvedValue(profile) },
      profileScore: { create },
    } as never);

    const result = await service.create({ role: 'google-l4-swe', jdText: 'We need CUDA and Rust experience.' }, 'user-1');

    expect(result.targetId).toMatch(/^jd:/);
    expect(result.targetLabel).toBe('Google L4 SWE (custom JD)');
    expect(result.skillsGaps).toContain('Missing required skill: CUDA');
    expect(result.skillsGaps).toContain('Missing required skill: Rust');
  });

  it('requires a profile before scoring', async () => {
    const service = new ProfileScoresService({
      profile: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never);

    await expect(service.create({ role: 'hpc-engineer' }, 'user-1'))
      .rejects.toEqual(new NotFoundException('No profile yet. Upload your CV first.'));
  });

  it('does not expose another users score', async () => {
    const service = new ProfileScoresService({
      profileScore: { findFirst: vi.fn().mockResolvedValue(null) },
    } as never);

    await expect(service.get('score-1', 'user-2')).rejects.toEqual(new NotFoundException('Profile score not found'));
  });
});
