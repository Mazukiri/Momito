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

function serviceWith(attempts: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(attempts);
  return { service: new WeaknessesService({ answerAttempt: { findMany } } as never), findMany };
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
