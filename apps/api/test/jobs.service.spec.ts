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

describe('JobsService.funnel', () => {
  function serviceWith(jobs: Array<{ status: string; source: string | null; visaTag: string | null }>) {
    const prisma = { jobApplication: { findMany: vi.fn().mockResolvedValue(jobs) } };
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
});
