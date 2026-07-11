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

describe('ProfileScoresService.atsCoverage (MOM-134-lite)', () => {
  it('reports covered and missing JD keywords against profile skills', async () => {
    const service = new ProfileScoresService({
      profile: { findUnique: vi.fn().mockResolvedValue({ skills: ['Python', 'SQL'] }) },
    } as never);

    // extractJdSkills pulls capitalized tokens (minus stopwords like "We"):
    // Kubernetes, Go, Python, SQL.
    const result = await service.atsCoverage('We need Kubernetes, Go, Python and SQL experience.', 'user-1');

    expect(result.jdKeywordCount).toBe(4);
    expect(result.covered).toEqual(expect.arrayContaining(['Python', 'SQL']));
    expect(result.missing).toEqual(expect.arrayContaining(['Kubernetes', 'Go']));
    expect(result.coveragePct).toBeCloseTo(0.5, 3);
  });

  it('treats every JD keyword as missing when there is no profile', async () => {
    const service = new ProfileScoresService({
      profile: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never);

    const result = await service.atsCoverage('Rust and Kubernetes required.', 'user-1');

    expect(result.covered).toEqual([]);
    expect(result.missing.length).toBe(result.jdKeywordCount);
    expect(result.coveragePct).toBe(0);
  });
});

describe('ProfileScoresService.atsCoverage vs a ResumeVersion (MOM-134-full)', () => {
  it('measures coverage against the version contentMd, not the profile skills', async () => {
    const service = new ProfileScoresService({
      resumeVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: 'rv-1', contentMd: 'Built Python and SQL pipelines on Kubernetes.' }),
      },
      // profile.findUnique must NOT be consulted on the resume path
      profile: { findUnique: vi.fn().mockRejectedValue(new Error('should not be called')) },
    } as never);

    const result = await service.atsCoverage('We need Kubernetes, Go, Python and SQL experience.', 'user-1', 'rv-1');

    expect(result.source).toBe('resume');
    expect(result.resumeVersionId).toBe('rv-1');
    expect(result.covered).toEqual(expect.arrayContaining(['Kubernetes', 'Python', 'SQL']));
    expect(result.missing).toEqual(['Go']);
    expect(result.coveragePct).toBeCloseTo(0.75, 3);
  });

  // MOM-159 — the JD capture class allows dots (so "Node.js" survives), which also swallowed the
  // sentence-final period. "Kubernetes." kept its dot while the résumé have-set stripped it, so a
  // covered skill at the end of a clause was false-flagged as missing.
  it('matches a JD keyword at the end of a sentence despite the trailing period (MOM-159)', async () => {
    const service = new ProfileScoresService({
      resumeVersion: { findFirst: vi.fn().mockResolvedValue({ id: 'rv-1', contentMd: 'Shipped services in Go on Kubernetes.' }) },
    } as never);

    // both skills sit at a clause end in the JD → both would keep a trailing dot pre-fix
    const result = await service.atsCoverage('We use Go. Must have Kubernetes.', 'user-1', 'rv-1');

    // pre-fix these were reported missing ("go." / "kubernetes." never matched the have-set)
    expect(result.covered).toEqual(expect.arrayContaining(['Go', 'Kubernetes']));
    expect(result.missing).not.toContain('Go');
    expect(result.missing).not.toContain('Kubernetes');
    // and the stray period never appears in either list (so tasks read "Add … Kubernetes")
    expect([...result.covered, ...result.missing].some((k) => k.endsWith('.'))).toBe(false);
  });

  it('404s when the résumé version is not the caller\'s', async () => {
    const service = new ProfileScoresService({
      resumeVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    } as never);

    await expect(service.atsCoverage('Rust required.', 'user-2', 'rv-1'))
      .rejects.toEqual(new NotFoundException('Résumé version not found'));
  });

  it('reports source=profile with a null version id on the lite path', async () => {
    const service = new ProfileScoresService({
      profile: { findUnique: vi.fn().mockResolvedValue({ skills: ['Python'] }) },
    } as never);

    const result = await service.atsCoverage('Python and Rust.', 'user-1');

    expect(result.source).toBe('profile');
    expect(result.resumeVersionId).toBeNull();
  });
});

describe('ProfileScoresService.atsGenerateTasks (MOM-134-full gap→task bridge)', () => {
  it('turns missing ATS keywords into idempotent study tasks', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new ProfileScoresService({
      resumeVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: 'rv-1', contentMd: 'Built Python and SQL pipelines on Kubernetes.' }),
      },
      task: { findMany: vi.fn().mockResolvedValue([]), createMany },
    } as never);

    const result = await service.atsGenerateTasks('We need Kubernetes, Go, Python and SQL experience.', 'user-1', 'rv-1');

    expect(result).toEqual({ created: 1 });
    const created = createMany.mock.calls[0][0].data;
    expect(created).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        type: 'study',
        priority: 'high',
        title: 'Add to résumé: Go',
        notes: 'Missing ATS keyword vs your target JD.',
      }),
    ]);
  });

  it('skips keyword tasks already tracked', async () => {
    const createMany = vi.fn();
    // Echo the queried titles back as "already exists" so the test is agnostic to
    // the exact "Add to résumé: …" string the service builds.
    const findMany = vi.fn().mockImplementation(({ where }) => where.title.in.map((title: string) => ({ title })));
    const service = new ProfileScoresService({
      resumeVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: 'rv-1', contentMd: 'Python only.' }),
      },
      task: { findMany, createMany },
    } as never);

    const result = await service.atsGenerateTasks('Go and Python.', 'user-1', 'rv-1');

    expect(result).toEqual({ created: 0 });
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('ProfileScoresService.generateTasks (MOM-135)', () => {
  const scoreWithGaps = {
    id: 'score-1',
    userId: 'user-1',
    targetLabel: 'Google L4 SWE',
    skillsGaps: ['Missing required skill: Kubernetes', 'Missing required skill: Go', 'Missing required skill: gRPC'],
    experienceGaps: ['Experience (1.0 years) below target (4 years)'],
    projectGaps: ['No project evidence for: distributed systems'],
    presentationGaps: ['No GitHub URL in profile'],
  };

  it('creates prioritized gap tasks and skips gaps already tracked, idempotently', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 6 });
    const service = new ProfileScoresService({
      profileScore: { findFirst: vi.fn().mockResolvedValue(scoreWithGaps) },
      task: { findMany: vi.fn().mockResolvedValue([]), createMany },
    } as never);

    const result = await service.generateTasks('score-1', 'user-1');

    expect(result).toEqual({ created: 6 });
    const created = createMany.mock.calls[0][0].data;
    // 3 skills (high) + 2 experience/project (medium) + 1 presentation (low), capped at 6
    expect(created).toHaveLength(6);
    expect(created[0]).toMatchObject({
      userId: 'user-1',
      type: 'study',
      priority: 'high',
      title: 'Résumé gap: Missing required skill: Kubernetes',
      notes: 'From your "Google L4 SWE" profile score.',
    });
    expect(created.filter((task: { priority: string }) => task.priority === 'high')).toHaveLength(3);
    expect(created.some((task: { priority: string }) => task.priority === 'low')).toBe(true);
  });

  it('does not recreate a gap task whose title already exists', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 5 });
    const service = new ProfileScoresService({
      profileScore: { findFirst: vi.fn().mockResolvedValue(scoreWithGaps) },
      task: {
        findMany: vi.fn().mockResolvedValue([{ title: 'Résumé gap: Missing required skill: Kubernetes' }]),
        createMany,
      },
    } as never);

    const result = await service.generateTasks('score-1', 'user-1');

    expect(result).toEqual({ created: 5 });
    const created = createMany.mock.calls[0][0].data;
    expect(created.some((task: { title: string }) => task.title.includes('Kubernetes'))).toBe(false);
  });

  it('creates nothing when the score has no gaps', async () => {
    const createMany = vi.fn();
    const service = new ProfileScoresService({
      profileScore: {
        findFirst: vi.fn().mockResolvedValue({ id: 'score-1', userId: 'user-1', targetLabel: 'x', skillsGaps: [], experienceGaps: [], projectGaps: [], presentationGaps: [] }),
      },
      task: { findMany: vi.fn(), createMany },
    } as never);

    const result = await service.generateTasks('score-1', 'user-1');
    expect(result).toEqual({ created: 0 });
    expect(createMany).not.toHaveBeenCalled();
  });
});
