import { describe, expect, it, vi } from 'vitest';
import { isStruggleAttempt, WeaknessesService } from '../src/weaknesses/weaknesses.service';

function buildAttempt(overrides: Partial<{
  questionId: string;
  selfRating: number | null;
  correctness: string | null;
  missTags: string[];
  createdAt: Date;
  title: string;
  patternTags: string[];
  topic: { id: string; name: string } | null;
}> = {}) {
  const questionId = overrides.questionId ?? 'q-1';
  return {
    questionId,
    selfRating: overrides.selfRating ?? null,
    correctness: overrides.correctness ?? null,
    missTags: overrides.missTags ?? [],
    createdAt: overrides.createdAt ?? new Date('2026-07-01T00:00:00Z'),
    question: {
      id: questionId,
      title: overrides.title ?? `Question ${questionId}`,
      patternTags: overrides.patternTags ?? [],
      topic: overrides.topic === undefined ? { id: 'topic-1', name: 'Databases' } : overrides.topic,
    },
  };
}

function serviceWith(attempts: unknown[], signals: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(attempts);
  const signalFindMany = vi.fn().mockResolvedValue(signals);
  return {
    service: new WeaknessesService({
      answerAttempt: { findMany },
      weaknessSignal: { findMany: signalFindMany },
    } as never),
    findMany,
    signalFindMany,
  };
}

function signalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sig-1',
    userId: 'user-1',
    signalType: 'area',
    key: 'system_design',
    label: 'System design',
    roleTrackId: 'big-tech-swe',
    area: 'system_design',
    jobApplicationId: 'job-1',
    severity: 2,
    occurrences: 2,
    source: 'debrief',
    status: 'open',
    lastSignalAt: new Date(),
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('isStruggleAttempt', () => {
  it('treats any miss tag, a rating of 2 or below, or incorrect correctness as a struggle', () => {
    expect(isStruggleAttempt({ selfRating: null, correctness: null, missTags: ['edge_case'] })).toBe(true);
    expect(isStruggleAttempt({ selfRating: 2, correctness: null, missTags: [] })).toBe(true);
    expect(isStruggleAttempt({ selfRating: null, correctness: 'incorrect', missTags: [] })).toBe(true);
    expect(isStruggleAttempt({ selfRating: 3, correctness: 'partial', missTags: [] })).toBe(false);
    expect(isStruggleAttempt({ selfRating: null, correctness: null, missTags: [] })).toBe(false);
  });
});

describe('WeaknessesService.summary', () => {
  it('aggregates miss-tag reasons with counts, sample titles, and question ids', async () => {
    const { service } = serviceWith([
      buildAttempt({ questionId: 'q-1', missTags: ['edge_case'], title: 'Two Sum', createdAt: new Date('2026-07-02T00:00:00Z') }),
      buildAttempt({ questionId: 'q-2', missTags: ['edge_case', 'time_pressure'], title: 'Merge Intervals' }),
      buildAttempt({ questionId: 'q-3', selfRating: 5, title: 'Clean solve' }),
    ]);

    const summary = await service.summary('user-1');

    expect(summary.totalAttempts).toBe(3);
    expect(summary.totalStruggles).toBe(2);
    const edgeCase = summary.reasons.find((reason) => reason.reason === 'edge_case');
    expect(edgeCase).toMatchObject({ count: 2, label: 'Missed an edge case' });
    expect(edgeCase?.sampleTitles).toEqual(expect.arrayContaining(['Two Sum', 'Merge Intervals']));
    expect(edgeCase?.questionIds).toEqual(expect.arrayContaining(['q-1', 'q-2']));
  });

  it('keys weak topics by topic id with a human label, and only areas with struggles appear', async () => {
    const { service } = serviceWith([
      buildAttempt({ questionId: 'q-1', selfRating: 1, topic: { id: 'topic-db', name: 'Databases' } }),
      buildAttempt({ questionId: 'q-2', selfRating: 5, topic: { id: 'topic-net', name: 'Networking' } }),
      buildAttempt({ questionId: 'q-3', selfRating: 2, patternTags: ['sliding-window'], topic: { id: 'topic-dsa', name: 'DSA' } }),
    ]);

    const summary = await service.summary('user-1');

    expect(summary.topics.map((topic) => topic.key)).toEqual(expect.arrayContaining(['topic-db', 'topic-dsa']));
    expect(summary.topics.map((topic) => topic.key)).not.toContain('topic-net');
    expect(summary.topics.find((topic) => topic.key === 'topic-db')?.label).toBe('Databases');
    expect(summary.patterns).toEqual([
      expect.objectContaining({ key: 'sliding-window', struggles: 1, attempts: 1 }),
    ]);
  });
});

describe('WeaknessesService.summary — openSignals (MOM-127)', () => {
  it('surfaces a recent stored signal, decayed and above the floor', async () => {
    const { service } = serviceWith([], [signalRow({ severity: 3, lastSignalAt: new Date() })]);

    const summary = await service.summary('user-1');

    expect(summary.openSignals).toHaveLength(1);
    const signal = summary.openSignals[0];
    expect(signal).toMatchObject({ key: 'system_design', source: 'debrief', occurrences: 2 });
    // Fresh signal (~0 age) keeps ~full raw severity.
    expect(signal.severity).toBeGreaterThan(2.9);
  });

  it('drops a stale signal whose decayed severity falls below the floor', async () => {
    // A single-severity signal aged ~1 year decays far below the 0.15 floor.
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const { service } = serviceWith([], [signalRow({ severity: 1, lastSignalAt: oneYearAgo })]);

    const summary = await service.summary('user-1');

    expect(summary.openSignals).toEqual([]);
  });

  it('sorts open signals by decayed severity, most severe first', async () => {
    const now = new Date();
    const { service } = serviceWith(
      [],
      [
        signalRow({ id: 'sig-low', key: 'behavioral', severity: 1, lastSignalAt: now }),
        signalRow({ id: 'sig-high', key: 'coding', severity: 5, lastSignalAt: now }),
      ],
    );

    const summary = await service.summary('user-1');

    expect(summary.openSignals.map((signal) => signal.id)).toEqual(['sig-high', 'sig-low']);
  });
});

describe('WeaknessesService.recordSignal (MOM-127)', () => {
  it('creates a new signal when no live one matches', async () => {
    const create = vi.fn().mockImplementation(({ data }) => signalRow({ ...data, id: 'sig-new', severity: 1, occurrences: 1 }));
    const service = new WeaknessesService({
      weaknessSignal: { findFirst: vi.fn().mockResolvedValue(null), create },
    } as never);

    const result = await service.recordSignal('user-1', {
      signalType: 'area',
      key: 'system_design',
      label: 'System design',
      source: 'debrief',
      jobApplicationId: 'job-1',
    });

    expect(create).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ key: 'system_design', occurrences: 1 });
  });

  it('accrues onto an existing open signal instead of duplicating it', async () => {
    const existing = signalRow({ severity: 2, occurrences: 2 });
    const update = vi.fn().mockImplementation(({ data }) => signalRow({ ...existing, ...data }));
    const service = new WeaknessesService({
      weaknessSignal: { findFirst: vi.fn().mockResolvedValue(existing), update },
    } as never);

    await service.recordSignal('user-1', {
      signalType: 'area',
      key: 'system_design',
      label: 'System design',
      source: 'debrief',
      jobApplicationId: 'job-1',
    });

    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0].data).toMatchObject({ occurrences: 3, severity: 3 });
  });

  it('caps accrued raw severity at 10', async () => {
    const existing = signalRow({ severity: 10, occurrences: 10 });
    const update = vi.fn().mockImplementation(({ data }) => signalRow({ ...existing, ...data }));
    const service = new WeaknessesService({
      weaknessSignal: { findFirst: vi.fn().mockResolvedValue(existing), update },
    } as never);

    await service.recordSignal('user-1', { signalType: 'area', key: 'system_design', label: 'x', source: 'debrief' });

    expect(update.mock.calls[0][0].data.severity).toBe(10);
  });
});

describe('WeaknessesService.resolveSignal / dismissSignal (MOM-127)', () => {
  it('resolves an owned signal', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(signalRow({ status: 'resolved' }));
    const service = new WeaknessesService({ weaknessSignal: { updateMany, findUniqueOrThrow } } as never);

    const result = await service.resolveSignal('sig-1', 'user-1');

    expect(updateMany.mock.calls[0][0].data.status).toBe('resolved');
    expect(result.status).toBe('resolved');
  });

  it('throws when the signal is not the user\'s', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const service = new WeaknessesService({ weaknessSignal: { updateMany } } as never);

    await expect(service.dismissSignal('sig-1', 'user-2')).rejects.toThrow('Weakness signal not found');
  });
});

describe('WeaknessesService.struggledQuestionIds', () => {
  it('excludes questions repaired by a later clean attempt (attempts arrive newest-first)', async () => {
    const { service } = serviceWith([
      // Newest first: q-1 was solved cleanly after an earlier struggle.
      buildAttempt({ questionId: 'q-1', selfRating: 4, createdAt: new Date('2026-07-03T00:00:00Z') }),
      buildAttempt({ questionId: 'q-1', selfRating: 1, createdAt: new Date('2026-07-01T00:00:00Z') }),
      buildAttempt({ questionId: 'q-2', missTags: ['concept_gap'], createdAt: new Date('2026-07-02T00:00:00Z') }),
    ]);

    const ids = await service.struggledQuestionIds('user-1');

    expect(ids).toEqual(['q-2']);
  });
});
