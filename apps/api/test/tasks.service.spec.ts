import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TasksService } from '../src/tasks/tasks.service';

describe('TasksService.remove', () => {
  it('deletes only a task owned by the authenticated user', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new TasksService({ task: { deleteMany } } as never);

    await service.remove('task-1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'task-1', userId: 'user-1' } });
  });

  it('throws NotFoundException when the task does not belong to the user', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const service = new TasksService({ task: { deleteMany } } as never);

    await expect(service.remove('task-1', 'user-2')).rejects.toEqual(new NotFoundException('Task not found'));
  });
});
