import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StudyPlanService } from '../src/study-plan/study-plan.service';

describe('StudyPlanService', () => {
  it('creates a user-owned item with normalized input', async () => {
    const create = vi.fn().mockImplementation(({ data }) => data);
    const service = new StudyPlanService({ studyPlanItem: { create } } as never);

    await service.create({
      title: '  Review transactions  ',
      topicId: 'topic-1',
      targetDate: '2026-07-01',
    }, 'user-1');

    expect(create.mock.calls[0][0].data).toEqual({
      userId: 'user-1',
      title: 'Review transactions',
      topicId: 'topic-1',
      notes: undefined,
      targetDate: new Date('2026-07-01T00:00:00.000Z'),
    });
  });

  it('scopes list filters to the authenticated user', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new StudyPlanService({ studyPlanItem: { findMany } } as never);
    await service.list({ status: 'todo' }, 'user-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', status: 'todo' } }));
  });

  it('does not update another users item', async () => {
    const service = new StudyPlanService({ studyPlanItem: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } } as never);
    await expect(service.update('item-1', { status: 'done' }, 'user-2'))
      .rejects.toEqual(new NotFoundException('Study plan item not found'));
  });

  it('normalizes a target date to UTC midnight', async () => {
    const create = vi.fn().mockImplementation(({ data }) => data);
    const service = new StudyPlanService({ studyPlanItem: { create } } as never);
    await service.create({ title: '  Review databases  ', targetDate: '2026-06-20' }, 'user-1');
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      title: 'Review databases',
      targetDate: new Date('2026-06-20T00:00:00.000Z'),
      userId: 'user-1',
    }));
  });

  it('deletes only an item owned by the authenticated user', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new StudyPlanService({ studyPlanItem: { deleteMany } } as never);

    await service.remove('item-1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'item-1', userId: 'user-1' } });
  });
});
