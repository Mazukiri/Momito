import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReviewsService } from '../src/reviews/reviews.service';

describe('ReviewsService', () => {
  it('rejects an unsupported objectType before touching the database', async () => {
    const prisma = { reviewState: { findUnique: vi.fn(), upsert: vi.fn() } };
    const service = new ReviewsService(prisma as never);

    await expect(service.record('user-1', 'story', 'obj-1', 3)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reviewState.findUnique).not.toHaveBeenCalled();
  });

  it('creates a new review state with FSRS defaults on first review', async () => {
    const upsert = vi.fn().mockImplementation(({ create }) => ({ id: 'rs-1', ...create }));
    const prisma = {
      reviewState: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
    };
    const service = new ReviewsService(prisma as never);
    const now = new Date('2026-07-05T00:00:00.000Z');

    const result = await service.record('user-1', 'question', 'q-1', 5, now);

    expect(upsert.mock.calls[0][0].create).toEqual(
      expect.objectContaining({ userId: 'user-1', objectType: 'question', objectId: 'q-1', reps: 1 }),
    );
    expect(result.objectType).toBe('question');
    expect(result.reps).toBe(1);
  });

  it('schedules from the existing state on a repeat review instead of resetting it', async () => {
    const existing = {
      id: 'rs-1',
      userId: 'user-1',
      objectType: 'question',
      objectId: 'q-1',
      stability: 4,
      difficulty: 5,
      due: new Date('2026-07-01T00:00:00.000Z'),
      state: 2,
      reps: 1,
      lapses: 0,
      suspended: false,
      lastReviewedAt: new Date('2026-06-30T00:00:00.000Z'),
    };
    const upsert = vi.fn().mockImplementation(({ update }) => ({ ...existing, ...update }));
    const prisma = {
      reviewState: {
        findUnique: vi.fn().mockResolvedValue(existing),
        upsert,
      },
    };
    const service = new ReviewsService(prisma as never);

    const result = await service.record('user-1', 'question', 'q-1', 5, new Date('2026-07-05T00:00:00.000Z'));

    expect(result.reps).toBe(2);
    expect(prisma.reviewState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_objectType_objectId: { userId: 'user-1', objectType: 'question', objectId: 'q-1' } } }),
    );
  });

  it('lists only due, non-suspended states ordered soonest-first', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { reviewState: { findMany } };
    const service = new ReviewsService(prisma as never);
    const now = new Date('2026-07-05T00:00:00.000Z');

    await service.listDue('user-1', now);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', suspended: false, due: { lte: now } },
      orderBy: { due: 'asc' },
    });
  });
});
