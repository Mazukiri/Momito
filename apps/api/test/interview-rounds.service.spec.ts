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

// A prisma double with sensible defaults; override any slice per test.
function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    jobApplication: {
      findFirst: vi.fn().mockResolvedValue({ id: 'job-1' }),
      findUnique: vi.fn().mockResolvedValue({ company: 'Meta' }),
    },
    interviewRound: {
      create: vi.fn().mockImplementation(({ data }) => roundRow(data)),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(roundRow()),
    },
    learningEvidence: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

const noJob = () => ({ jobApplication: { findFirst: vi.fn().mockResolvedValue(null) } });
const makeWeaknesses = () => ({ recordSignal: vi.fn().mockResolvedValue({}) });

function makeService(prisma: unknown, weaknesses: unknown = makeWeaknesses()) {
  return new InterviewRoundsService(prisma as never, weaknesses as never);
}

describe('InterviewRoundsService.create', () => {
  it('creates a round scoped to an owned job with defaults', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    const result = await service.create('job-1', { roundType: 'onsite', scheduledAt: '2026-08-01T15:00:00.000Z' }, 'user-1');

    const call = (prisma.interviewRound.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data).toMatchObject({ userId: 'user-1', jobApplicationId: 'job-1', roundType: 'onsite', sequence: 0 });
    expect(call.data.scheduledAt).toBeInstanceOf(Date);
    expect(result.outcome).toBe('pending');
  });

  it('refuses to create a round on a job the user does not own', async () => {
    const service = makeService(noJob());
    await expect(service.create('job-x', { roundType: 'onsite' }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InterviewRoundsService.listForJob', () => {
  it('returns serialized rounds for an owned job', async () => {
    const prisma = makePrisma({
      interviewRound: { findMany: vi.fn().mockResolvedValue([roundRow({ id: 'r1', scheduledAt: now })]) },
    });
    const service = makeService(prisma);

    const result = await service.listForJob('job-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'r1', roundType: 'system_design' });
    expect(result[0].scheduledAt).toBe(now.toISOString());
    expect((prisma.interviewRound.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
      jobApplicationId: 'job-1',
      userId: 'user-1',
    });
  });
});

describe('InterviewRoundsService.update', () => {
  it('applies only the provided fields and returns the updated round', async () => {
    const prisma = makePrisma({
      interviewRound: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue(roundRow({ outcome: 'failed', debrief: 'ran out of time', areasWeak: ['system_design'], missTags: ['time_pressure'] })),
      },
    });
    const service = makeService(prisma);

    const result = await service.update(
      'job-1',
      'round-1',
      { outcome: 'failed', debrief: 'ran out of time', areasWeak: ['system_design'], missTags: ['time_pressure'] },
      'user-1',
    );

    const data = (prisma.interviewRound.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data).toEqual({ outcome: 'failed', debrief: 'ran out of time', areasWeak: ['system_design'], missTags: ['time_pressure'] });
    expect(data).not.toHaveProperty('roundType');
    expect(result).toMatchObject({ outcome: 'failed', missTags: ['time_pressure'] });
  });

  it('nulls scheduledAt when explicitly cleared (and does not run the debrief edge)', async () => {
    const prisma = makePrisma();
    const weaknesses = makeWeaknesses();
    const service = makeService(prisma, weaknesses);

    await service.update('job-1', 'round-1', { scheduledAt: null }, 'user-1');

    expect((prisma.interviewRound.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toEqual({ scheduledAt: null });
    expect(weaknesses.recordSignal).not.toHaveBeenCalled();
    expect(prisma.learningEvidence.create).not.toHaveBeenCalled();
  });

  it("throws when the round is not the user's", async () => {
    const prisma = makePrisma({ interviewRound: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } });
    const service = makeService(prisma);
    await expect(service.update('job-1', 'round-x', { outcome: 'passed' }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// MOM-113 — the loop-closing edge.
describe('InterviewRoundsService.update debrief → weakness signals', () => {
  it('emits an area + reason signal and a ledger row on a fresh debrief save', async () => {
    const prisma = makePrisma({
      interviewRound: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue(roundRow({ outcome: 'failed', debrief: 'Blanked on sharding', areasWeak: ['system_design'], missTags: ['time_pressure', 'concept_gap'] })),
      },
    });
    const weaknesses = makeWeaknesses();
    const service = makeService(prisma, weaknesses);

    await service.update(
      'job-1',
      'round-1',
      { debrief: 'Blanked on sharding', areasWeak: ['system_design'], missTags: ['time_pressure', 'concept_gap'] },
      'user-1',
    );

    // One area signal + two reason signals.
    expect(weaknesses.recordSignal).toHaveBeenCalledTimes(3);
    const inputs = weaknesses.recordSignal.mock.calls.map((call: unknown[]) => call[1]);
    expect(inputs).toContainEqual(
      expect.objectContaining({ signalType: 'area', key: 'system_design', source: 'debrief', area: 'system_design', jobApplicationId: 'job-1' }),
    );
    expect(inputs).toContainEqual(expect.objectContaining({ signalType: 'reason', key: 'time_pressure', source: 'debrief' }));

    const evidence = (prisma.learningEvidence.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(evidence.type).toBe('interview_debrief');
    expect(evidence.jobApplicationId).toBe('job-1');
    expect(evidence.metadata.roundId).toBe('round-1');
    expect(evidence.metadata.emittedKeys).toEqual(
      expect.arrayContaining(['area:system_design', 'reason:time_pressure', 'reason:concept_gap']),
    );
  });

  it('does not re-emit signals a round has already fired (idempotent re-save)', async () => {
    const prisma = makePrisma({
      interviewRound: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue(roundRow({ outcome: 'failed', debrief: 'edited note', areasWeak: ['system_design'], missTags: ['time_pressure'] })),
      },
      learningEvidence: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'ev-1', metadata: { roundId: 'round-1', emittedKeys: ['area:system_design', 'reason:time_pressure'] } },
        ]),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const weaknesses = makeWeaknesses();
    const service = makeService(prisma, weaknesses);

    await service.update('job-1', 'round-1', { debrief: 'edited note', areasWeak: ['system_design'], missTags: ['time_pressure'] }, 'user-1');

    expect(weaknesses.recordSignal).not.toHaveBeenCalled();
    expect(prisma.learningEvidence.update).toHaveBeenCalledTimes(1);
    expect(prisma.learningEvidence.create).not.toHaveBeenCalled();
  });

  it('only emits the newly-added area on a re-save that adds one', async () => {
    const prisma = makePrisma({
      interviewRound: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue(roundRow({ outcome: 'mixed', areasWeak: ['system_design', 'behavioral'], missTags: [] })),
      },
      learningEvidence: {
        findMany: vi.fn().mockResolvedValue([{ id: 'ev-1', metadata: { roundId: 'round-1', emittedKeys: ['area:system_design'] } }]),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const weaknesses = makeWeaknesses();
    const service = makeService(prisma, weaknesses);

    await service.update('job-1', 'round-1', { areasWeak: ['system_design', 'behavioral'] }, 'user-1');

    expect(weaknesses.recordSignal).toHaveBeenCalledTimes(1);
    expect(weaknesses.recordSignal.mock.calls[0][1]).toMatchObject({ signalType: 'area', key: 'behavioral' });
  });
});

describe('InterviewRoundsService.generatePrep (MOM-111)', () => {
  const jobRow = { id: 'job-1', company: 'Meta', roleTitle: 'E5 SWE', roleTrackId: 'big-tech-swe', deadline: null };

  it('creates round-typed prep tasks scoped to the round', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({
      jobApplication: { findFirst: vi.fn().mockResolvedValue(jobRow) },
      interviewRound: { findFirst: vi.fn().mockResolvedValue(roundRow({ roundType: 'system_design', scheduledAt: new Date('2026-08-01T00:00:00.000Z') })) },
      task: { createMany },
    });
    const service = makeService(prisma);

    const result = await service.generatePrep('job-1', 'round-1', 'user-1');

    expect(result).toEqual({ created: 1 });
    const data = (createMany as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.length).toBeGreaterThan(0);
    for (const task of data) {
      expect(task.interviewRoundId).toBe('round-1');
      expect(task.jobApplicationId).toBe('job-1');
      // system_design round focuses prep on the system_design area only.
      expect(task.area).toBe('system_design');
      expect(task.dueDate.getTime()).toBeLessThan(new Date('2026-08-01T00:00:00.000Z').getTime());
    }
  });

  it('throws when the round is not the job\'s', async () => {
    const prisma = makePrisma({
      jobApplication: { findFirst: vi.fn().mockResolvedValue(jobRow) },
      interviewRound: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(makeService(prisma).generatePrep('job-1', 'round-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InterviewRoundsService.remove', () => {
  it('deletes an owned round', async () => {
    const prisma = makePrisma({ interviewRound: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) } });
    const service = makeService(prisma);

    await expect(service.remove('job-1', 'round-1', 'user-1')).resolves.toEqual({ deleted: true });
    expect((prisma.interviewRound.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
      id: 'round-1',
      jobApplicationId: 'job-1',
      userId: 'user-1',
    });
  });

  it('throws when deleting a round that is not found', async () => {
    const prisma = makePrisma({ interviewRound: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } });
    const service = makeService(prisma);
    await expect(service.remove('job-1', 'round-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
