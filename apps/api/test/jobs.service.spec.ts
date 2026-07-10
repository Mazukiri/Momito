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

describe('JobsService.update — status transition logging (MOM-102)', () => {
  function fullJob(overrides: Record<string, unknown> = {}) {
    return {
      id: 'job-1',
      userId: 'user-1',
      company: 'Meta',
      roleTitle: 'E4 SWE',
      url: null,
      location: null,
      status: 'interview',
      roleTrackId: null,
      jdText: null,
      appliedDate: null,
      deadline: null, // null → ensureDeadlineReminder returns early, no reminder mocks needed
      source: null,
      referralName: null,
      visaTag: 'unknown',
      h1bCountLastYear: null,
      compensationNotes: null,
      notes: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-08T00:00:00.000Z'),
      _count: { events: 0, tasks: 0, reminders: 0 },
      events: [], // MOM-105: latest status_change (take:1) for stall detection
      ...overrides,
    };
  }

  function makeService(previousStatus: string) {
    const create = vi.fn().mockResolvedValue({});
    const prisma = {
      jobApplication: {
        findFirst: vi.fn().mockResolvedValue({ status: previousStatus }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(fullJob()),
      },
      jobEvent: { create },
    };
    return { service: new JobsService(prisma as never, {} as never), create, prisma };
  }

  it('logs a status_change JobEvent when the status actually changes', async () => {
    const { service, create } = makeService('applied');
    await service.update('job-1', { status: 'interview' } as never, 'user-1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        jobApplicationId: 'job-1',
        type: 'status_change',
        title: 'applied → interview',
        // MOM-103: structured transition endpoints alongside the display title.
        fromStatus: 'applied',
        toStatus: 'interview',
      }),
    });
  });

  it('does not log when the status is unchanged', async () => {
    const { service, create } = makeService('interview');
    await service.update('job-1', { status: 'interview' } as never, 'user-1');
    expect(create).not.toHaveBeenCalled();
  });

  it('does not query previous status or log when no status is in the update', async () => {
    const { service, create, prisma } = makeService('applied');
    await service.update('job-1', { notes: 'recruiter call went well' } as never, 'user-1');
    expect(prisma.jobApplication.findFirst).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('JobsService — company link (MOM-122)', () => {
  const companyRef = { id: 'co-1', name: 'Meta', region: 'Global', sponsorshipStatus: 'sponsored', focusAreas: { dsa: 5 } };
  function jobRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'job-1', userId: 'user-1', company: 'Meta', companyId: 'co-1', companyRef,
      roleTitle: 'E4 SWE', url: null, location: null, status: 'saved', roleTrackId: null, jdText: null,
      appliedDate: null, deadline: null, source: null, referralName: null, visaTag: 'unknown',
      h1bCountLastYear: null, compensationNotes: null, notes: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'), updatedAt: new Date('2026-07-08T00:00:00.000Z'),
      _count: { events: 0, tasks: 0, reminders: 0 }, events: [], ...overrides,
    };
  }

  it('validates the company exists and stores companyId + serializes companyRef on create', async () => {
    const prisma = {
      company: { findUnique: vi.fn().mockResolvedValue({ id: 'co-1' }) },
      jobApplication: { create: vi.fn().mockResolvedValue(jobRow()) },
      reminder: { findFirst: vi.fn(), upsert: vi.fn() },
    };
    const service = new JobsService(prisma as never, {} as never);

    const result = await service.create({ company: 'Meta', companyId: 'co-1', roleTitle: 'E4 SWE' } as never, 'user-1');

    expect(prisma.company.findUnique).toHaveBeenCalledWith({ where: { id: 'co-1' }, select: { id: true } });
    expect(prisma.jobApplication.create.mock.calls[0][0].data).toMatchObject({ companyId: 'co-1', company: 'Meta' });
    expect(result.companyId).toBe('co-1');
    expect(result.companyRef).toMatchObject({ id: 'co-1', name: 'Meta', sponsorshipStatus: 'sponsored', focusAreas: { dsa: 5 } });
  });

  it('rejects an unknown companyId before creating', async () => {
    const prisma = {
      company: { findUnique: vi.fn().mockResolvedValue(null) },
      jobApplication: { create: vi.fn() },
    };
    const service = new JobsService(prisma as never, {} as never);

    await expect(service.create({ company: 'X', companyId: 'nope', roleTitle: 'R' } as never, 'user-1')).rejects.toThrow('Unknown company');
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  it('passes companyId through on update (null unlinks)', async () => {
    const prisma = {
      jobApplication: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(jobRow({ companyId: null, companyRef: null })),
      },
      reminder: { findFirst: vi.fn(), upsert: vi.fn() },
    };
    const service = new JobsService(prisma as never, {} as never);

    const result = await service.update('job-1', { companyId: null } as never, 'user-1');

    expect(prisma.jobApplication.updateMany.mock.calls[0][0].data).toEqual({ companyId: null });
    expect(result.companyId).toBeNull();
    expect(result.companyRef).toBeNull();
  });
});

describe('JobsService — stall detection (MOM-105)', () => {
  function listService(job: Record<string, unknown>) {
    const prisma = { jobApplication: { findMany: vi.fn().mockResolvedValue([job]) } };
    return new JobsService(prisma as never, {} as never);
  }
  function jobRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'job-1', userId: 'user-1', company: 'Google', companyId: null, companyRef: null,
      roleTitle: 'SWE', url: null, location: null, status: 'applied', roleTrackId: null, jdText: null,
      appliedDate: null, deadline: null, source: null, referralName: null, visaTag: 'unknown',
      h1bCountLastYear: null, compensationNotes: null, notes: null,
      createdAt: new Date(), updatedAt: new Date(), _count: { events: 0, tasks: 0, reminders: 0 },
      events: [], ...overrides,
    };
  }

  it('flags an application past its stage threshold as stalled, dating from the last transition', async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    // applied threshold is 21 days; entered 25 days ago via a status_change.
    const [job] = await listService(jobRow({ status: 'applied', events: [{ eventAt: daysAgo(25) }] })).list('user-1');
    expect(job.daysInStage).toBe(25);
    expect(job.isStalled).toBe(true);
  });

  it('is not stalled within the threshold, and terminal statuses never stall', async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const [fresh] = await listService(jobRow({ status: 'applied', createdAt: daysAgo(3), events: [] })).list('user-1');
    expect(fresh.daysInStage).toBe(3);
    expect(fresh.isStalled).toBe(false);

    const [rejected] = await listService(jobRow({ status: 'rejected', createdAt: daysAgo(90), events: [] })).list('user-1');
    expect(rejected.daysInStage).toBeNull();
    expect(rejected.isStalled).toBe(false);
  });
});

describe('JobsService.funnel', () => {
  function serviceWith(
    jobs: Array<{ status: string; source: string | null; visaTag: string | null }>,
    transitions: Array<{ jobApplicationId: string; fromStatus: string | null; toStatus: string | null; eventAt: Date }> = [],
  ) {
    const prisma = {
      jobApplication: { findMany: vi.fn().mockResolvedValue(jobs) },
      jobEvent: { findMany: vi.fn().mockResolvedValue(transitions) },
    };
    return new JobsService(prisma as never, {} as never);
  }

  it('returns an all-zero funnel with no applications', async () => {
    const funnel = await serviceWith([]).funnel('user-1');
    expect(funnel.total).toBe(0);
    expect(funnel.active).toBe(0);
    expect(funnel.stages).toHaveLength(6);
    expect(funnel.stages.every((row) => row.reached === 0)).toBe(true);
    expect(funnel.stages[0].conversionFromPrev).toBeNull();
  });

  it('computes cumulative reached counts and stage conversions from current status', async () => {
    // saved:1, applied:2, oa:1, interview:2, onsite:1, offer:1, rejected:1, withdrawn:1
    const jobs = [
      { status: 'saved', source: 'online', visaTag: 'sponsored' },
      { status: 'applied', source: 'online', visaTag: 'sponsored' },
      { status: 'applied', source: 'referral', visaTag: 'sponsored' },
      { status: 'oa', source: 'referral', visaTag: 'unknown' },
      { status: 'interview', source: 'referral', visaTag: 'sponsored' },
      { status: 'interview', source: 'online', visaTag: 'sponsored' },
      { status: 'onsite', source: 'referral', visaTag: 'sponsored' },
      { status: 'offer', source: 'referral', visaTag: 'sponsored' },
      { status: 'rejected', source: 'online', visaTag: 'not_sponsoring' },
      { status: 'withdrawn', source: 'cold_email', visaTag: 'unknown' },
    ];
    const funnel = await serviceWith(jobs).funnel('user-1');

    expect(funnel.total).toBe(10);
    expect(funnel.active).toBe(8); // excludes rejected + withdrawn
    expect(funnel.offers).toBe(1);
    expect(funnel.rejected).toBe(1);
    expect(funnel.withdrawn).toBe(1);

    const byStage = Object.fromEntries(funnel.stages.map((row) => [row.stage, row]));
    expect(byStage.saved.reached).toBe(8); // everyone active
    expect(byStage.applied.reached).toBe(7); // all but the 1 still at saved
    expect(byStage.oa.reached).toBe(5);
    expect(byStage.interview.reached).toBe(4);
    expect(byStage.onsite.reached).toBe(2);
    expect(byStage.offer.reached).toBe(1);
    expect(byStage.offer.atStage).toBe(1);

    // applied→oa conversion = reached[oa]/reached[applied] = 5/7
    expect(byStage.oa.conversionFromPrev).toBeCloseTo(5 / 7, 3);
    // responseRate = reached[oa]/reached[applied]
    expect(funnel.responseRate).toBeCloseTo(5 / 7, 3);
  });

  it('breaks down conversion by source and visa tag, sorted by volume', async () => {
    const jobs = [
      { status: 'offer', source: 'referral', visaTag: 'sponsored' },
      { status: 'interview', source: 'referral', visaTag: 'sponsored' },
      { status: 'rejected', source: 'referral', visaTag: 'sponsored' },
      { status: 'applied', source: 'online', visaTag: 'unknown' },
    ];
    const funnel = await serviceWith(jobs).funnel('user-1');

    expect(funnel.bySource[0].key).toBe('referral'); // highest volume first
    const referral = funnel.bySource.find((row) => row.key === 'referral')!;
    expect(referral.total).toBe(3);
    expect(referral.offers).toBe(1);
    expect(referral.interviewing).toBe(2); // interview + offer
    expect(referral.conversion).toBeCloseTo(1 / 3, 3);
  });

  it('coalesces a null source to "unspecified"', async () => {
    const jobs = [{ status: 'applied', source: null, visaTag: null }];
    const funnel = await serviceWith(jobs).funnel('user-1');
    expect(funnel.bySource[0].key).toBe('unspecified');
    expect(funnel.byVisaTag[0].key).toBe('unknown');
  });

  it('leaves every stage median null with no transition history', async () => {
    const funnel = await serviceWith([{ status: 'applied', source: null, visaTag: null }]).funnel('user-1');
    expect(funnel.stages.every((row) => row.medianDaysInStage === null)).toBe(true);
  });

  it('computes median days-in-stage from transitions (MOM-104), ignoring the open current stage', async () => {
    // Job A: saved 2d (7/1→7/3), applied 5d (7/3→7/8), now open in oa.
    // Job B: saved 4d (7/1→7/5), now open in applied.
    const jobs = [
      { id: 'A', status: 'oa', source: null, visaTag: null, createdAt: new Date('2026-07-01T00:00:00Z') },
      { id: 'B', status: 'applied', source: null, visaTag: null, createdAt: new Date('2026-07-01T00:00:00Z') },
    ] as never;
    const transitions = [
      { jobApplicationId: 'A', fromStatus: 'saved', toStatus: 'applied', eventAt: new Date('2026-07-03T00:00:00Z') },
      { jobApplicationId: 'A', fromStatus: 'applied', toStatus: 'oa', eventAt: new Date('2026-07-08T00:00:00Z') },
      { jobApplicationId: 'B', fromStatus: 'saved', toStatus: 'applied', eventAt: new Date('2026-07-05T00:00:00Z') },
    ];
    const funnel = await serviceWith(jobs, transitions).funnel('user-1');

    const byStage = Object.fromEntries(funnel.stages.map((row) => [row.stage, row.medianDaysInStage]));
    expect(byStage.saved).toBe(3); // median of [2, 4]
    expect(byStage.applied).toBe(5); // only [5]
    expect(byStage.oa).toBeNull(); // still open, no completed sample
  });
});
