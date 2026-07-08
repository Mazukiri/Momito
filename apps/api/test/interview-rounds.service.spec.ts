import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InterviewRoundsService } from '../src/interview-rounds/interview-rounds.service';

const now = new Date('2026-07-09T00:00:00.000Z');

function roundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'round-1',
    userId: 'user-1',
    jobApplicationId: 'job-1',
    roundType: 'system_design',
    sequence: 0,
    scheduledAt: null,
    durationMinutes: null,
    interviewer: null,
    outcome: 'pending',
    debrief: null,
    areasWeak: [],
    missTags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const ownsJob = () => ({ findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }) });
const noJob = () => ({ findFirst: vi.fn().mockResolvedValue(null) });

describe('InterviewRoundsService.create', () => {
  it('creates a round scoped to an owned job with defaults', async () => {
    const create = vi.fn().mockImplementation(({ data }) => roundRow(data));
    const service = new InterviewRoundsService({
      jobApplication: ownsJob(),
      interviewRound: { create },
    } as never);

    const result = await service.create('job-1', { roundType: 'onsite', scheduledAt: '2026-08-01T15:00:00.000Z' }, 'user-1');

    expect(create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      jobApplicationId: 'job-1',
      roundType: 'onsite',
      sequence: 0,
    });
    expect(create.mock.calls[0][0].data.scheduledAt).toBeInstanceOf(Date);
    expect(result.outcome).toBe('pending');
  });

  it('refuses to create a round on a job the user does not own', async () => {
    const service = new InterviewRoundsService({ jobApplication: noJob() } as never);
    await expect(service.create('job-x', { roundType: 'onsite' }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InterviewRoundsService.listForJob', () => {
  it('returns serialized rounds for an owned job', async () => {
    const findMany = vi.fn().mockResolvedValue([roundRow({ id: 'r1', scheduledAt: now })]);
    const service = new InterviewRoundsService({
      jobApplication: ownsJob(),
      interviewRound: { findMany },
    } as never);

    const result = await service.listForJob('job-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'r1', roundType: 'system_design' });
    expect(result[0].scheduledAt).toBe(now.toISOString());
    expect(findMany.mock.calls[0][0].where).toEqual({ jobApplicationId: 'job-1', userId: 'user-1' });
  });
});

describe('InterviewRoundsService.update', () => {
  it('applies only the provided fields and returns the updated round', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(
      roundRow({ outcome: 'failed', debrief: 'ran out of time', areasWeak: ['system_design'], missTags: ['time_pressure'] }),
    );
    const service = new InterviewRoundsService({
      jobApplication: ownsJob(),
      interviewRound: { updateMany, findUniqueOrThrow },
    } as never);

    const result = await service.update('job-1', 'round-1', {
      outcome: 'failed',
      debrief: 'ran out of time',
      areasWeak: ['system_design'],
      missTags: ['time_pressure'],
    }, 'user-1');

    const data = updateMany.mock.calls[0][0].data;
    expect(data).toEqual({ outcome: 'failed', debrief: 'ran out of time', areasWeak: ['system_design'], missTags: ['time_pressure'] });
    // Untouched fields are absent from the update payload.
    expect(data).not.toHaveProperty('roundType');
    expect(result).toMatchObject({ outcome: 'failed', missTags: ['time_pressure'] });
  });

  it('nulls scheduledAt when explicitly cleared', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new InterviewRoundsService({
      jobApplication: ownsJob(),
      interviewRound: { updateMany, findUniqueOrThrow: vi.fn().mockResolvedValue(roundRow()) },
    } as never);

    await service.update('job-1', 'round-1', { scheduledAt: null }, 'user-1');

    expect(updateMany.mock.calls[0][0].data).toEqual({ scheduledAt: null });
  });

  it('throws when the round is not the user\'s', async () => {
    const service = new InterviewRoundsService({
      jobApplication: ownsJob(),
      interviewRound: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as never);

    await expect(service.update('job-1', 'round-x', { outcome: 'passed' }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InterviewRoundsService.remove', () => {
  it('deletes an owned round', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new InterviewRoundsService({
      jobApplication: ownsJob(),
      interviewRound: { deleteMany },
    } as never);

    await expect(service.remove('job-1', 'round-1', 'user-1')).resolves.toEqual({ deleted: true });
    expect(deleteMany.mock.calls[0][0].where).toEqual({ id: 'round-1', jobApplicationId: 'job-1', userId: 'user-1' });
  });

  it('throws when deleting a round that is not found', async () => {
    const service = new InterviewRoundsService({
      jobApplication: ownsJob(),
      interviewRound: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as never);

    await expect(service.remove('job-1', 'round-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
