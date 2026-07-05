import { describe, expect, it, vi } from 'vitest';
import { JobsService } from '../src/jobs/jobs.service';

describe('JobsService.generatePrep', () => {
  it('creates prep tasks linked back to the target job application', async () => {
    const deadline = new Date('2026-08-15T00:00:00.000Z');
    const prisma = {
      jobApplication: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'job-1',
          userId: 'user-1',
          company: 'Google',
          roleTitle: 'Backend Engineer',
          roleTrackId: 'big-tech-swe',
          deadline,
        }),
      },
      task: {
        createMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      reminder: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'reminder-1' }),
      },
    };
    const service = new JobsService(prisma as never, {} as never);

    const result = await service.generatePrep('job-1', 'user-1');

    expect(result).toEqual({ created: 5 });
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({
      where: { id: 'job-1', userId: 'user-1' },
    });
    expect(prisma.task.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: 'user-1',
          jobApplicationId: 'job-1',
          roleTrackId: 'big-tech-swe',
          priority: 'high',
          title: expect.stringContaining('for Google'),
          notes: expect.stringContaining('Backend Engineer'),
        }),
      ]),
      skipDuplicates: true,
    });

    const createdTasks = prisma.task.createMany.mock.calls[0][0].data;
    expect(createdTasks).toHaveLength(5);
    expect(createdTasks.every((task: { dueDate: Date }) => task.dueDate < deadline)).toBe(true);
    expect(prisma.reminder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ jobApplicationId: 'job-1', type: 'job_deadline' }),
      }),
    );
  });
});
