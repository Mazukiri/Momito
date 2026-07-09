import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LearningService } from '../src/learning/learning.service';

const now = new Date('2026-07-09T00:00:00.000Z');

function highlightRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hl-1',
    userId: 'user-1',
    sourceId: 'src-1',
    readwiseHighlightId: 42,
    text: 'Systems, not goals, drive lasting change.',
    note: null,
    color: null,
    location: null,
    locationType: null,
    highlightedAt: now,
    readwiseUpdatedAt: now,
    isDeleted: false,
    reviewedAt: null,
    usefulness: null,
    roleTrackId: null,
    area: null,
    topicId: null,
    createdAt: now,
    updatedAt: now,
    source: null,
    topic: null,
    ...overrides,
  };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    learningHighlight: {
      findFirst: vi.fn().mockResolvedValue(highlightRow()),
      update: vi.fn().mockImplementation(({ data }) => highlightRow({ ...data })),
    },
    learningEvidence: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function makeReviews() {
  return { record: vi.fn().mockResolvedValue({}) };
}

function makeService(prisma: unknown, reviews: unknown = makeReviews()) {
  return new LearningService(prisma as never, reviews as never);
}

describe('LearningService.updateHighlight — MOM-146 review seeding', () => {
  it('seeds an FSRS review when a kept highlight is reviewed', async () => {
    const prisma = makePrisma({
      learningHighlight: {
        findFirst: vi.fn().mockResolvedValue(highlightRow()),
        update: vi.fn().mockResolvedValue(highlightRow({ reviewedAt: now, usefulness: 'useful' })),
      },
    });
    const reviews = makeReviews();
    const service = makeService(prisma, reviews);

    await service.updateHighlight('hl-1', { reviewed: true, usefulness: 'useful' }, 'user-1');

    expect(reviews.record).toHaveBeenCalledWith('user-1', 'highlight', 'hl-1', 3);
  });

  it('does NOT seed a review for an ignored highlight — it is filed only', async () => {
    const prisma = makePrisma({
      learningHighlight: {
        findFirst: vi.fn().mockResolvedValue(highlightRow()),
        update: vi.fn().mockResolvedValue(highlightRow({ reviewedAt: now, usefulness: 'ignored' })),
      },
    });
    const reviews = makeReviews();
    const service = makeService(prisma, reviews);

    await service.updateHighlight('hl-1', { reviewed: true, usefulness: 'ignored' }, 'user-1');

    expect(reviews.record).not.toHaveBeenCalled();
  });

  it('does not fail the review if FSRS scheduling throws (best-effort)', async () => {
    const prisma = makePrisma({
      learningHighlight: {
        findFirst: vi.fn().mockResolvedValue(highlightRow()),
        update: vi.fn().mockResolvedValue(highlightRow({ reviewedAt: now, usefulness: 'useful' })),
      },
    });
    const reviews = { record: vi.fn().mockRejectedValue(new Error('fsrs down')) };
    const service = makeService(prisma, reviews);

    const result = await service.updateHighlight('hl-1', { reviewed: true, usefulness: 'useful' }, 'user-1');

    expect(result.reviewedAt).toBe(now.toISOString());
  });

  it('does not seed a review when the update is a pure retag (not reviewed)', async () => {
    const reviews = makeReviews();
    const service = makeService(makePrisma(), reviews);

    await service.updateHighlight('hl-1', { area: 'system_design' }, 'user-1');

    expect(reviews.record).not.toHaveBeenCalled();
  });

  it('throws when the highlight is not the user\'s', async () => {
    const prisma = makePrisma({
      learningHighlight: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    });
    const service = makeService(prisma);

    await expect(service.updateHighlight('hl-x', { reviewed: true }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('LearningService.getHighlight — MOM-146', () => {
  it('returns an owned highlight', async () => {
    const prisma = makePrisma({
      learningHighlight: { findFirst: vi.fn().mockResolvedValue(highlightRow({ text: 'Deep work compounds.' })) },
    });
    const service = makeService(prisma);

    const result = await service.getHighlight('hl-1', 'user-1');

    expect(result.text).toBe('Deep work compounds.');
    expect(prisma.learningHighlight.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'hl-1', userId: 'user-1' } }),
    );
  });

  it('throws when the highlight is not found', async () => {
    const prisma = makePrisma({ learningHighlight: { findFirst: vi.fn().mockResolvedValue(null) } });
    const service = makeService(prisma);

    await expect(service.getHighlight('hl-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
