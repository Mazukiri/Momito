import { describe, expect, it, vi } from 'vitest';
import { FollowUpService } from '../src/follow-up/follow-up.service';

const NOW = new Date('2026-07-10T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function makeService(over: {
  jobs?: unknown[];
  rounds?: unknown[];
  contactFor?: (jobId: string) => unknown;
  existingThankYou?: (roundId: string) => unknown;
} = {}) {
  const create = vi.fn().mockResolvedValue({});
  const prisma = {
    jobApplication: { findMany: vi.fn().mockResolvedValue(over.jobs ?? []) },
    interviewRound: { findMany: vi.fn().mockResolvedValue(over.rounds ?? []) },
    contact: { findFirst: vi.fn().mockImplementation(({ where }) => (over.contactFor ? over.contactFor(where.jobApplicationId) : null)) },
    reminder: {
      findFirst: vi.fn().mockImplementation(({ where }) => (over.existingThankYou ? over.existingThankYou(where.interviewRoundId) : null)),
      create,
    },
  };
  return { service: new FollowUpService(prisma as never), create, prisma };
}

describe('FollowUpService.sweep — application follow-ups (MOM-118)', () => {
  it('nudges a stale applied job with no open follow-up', async () => {
    const { service, create } = makeService({
      jobs: [{ id: 'job-1', userId: 'u1', company: 'Meta', createdAt: daysAgo(20), events: [{ eventAt: daysAgo(12) }], reminders: [] }],
    });
    const result = await service.sweep(NOW);
    expect(result.followUps).toBe(1);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'follow_up', jobApplicationId: 'job-1', title: 'Follow up with Meta' }) });
  });

  it('does not nudge within the threshold or when a follow-up is already open', async () => {
    const fresh = makeService({ jobs: [{ id: 'j', userId: 'u1', company: 'X', createdAt: daysAgo(3), events: [{ eventAt: daysAgo(3) }], reminders: [] }] });
    expect((await fresh.service.sweep(NOW)).followUps).toBe(0);

    const alreadyNudged = makeService({ jobs: [{ id: 'j', userId: 'u1', company: 'X', createdAt: daysAgo(30), events: [{ eventAt: daysAgo(30) }], reminders: [{ id: 'r' }] }] });
    expect((await alreadyNudged.service.sweep(NOW)).followUps).toBe(0);
    expect(alreadyNudged.create).not.toHaveBeenCalled();
  });
});

describe('FollowUpService.sweep — thank-you notes (MOM-118)', () => {
  const round = { id: 'round-1', userId: 'u1', jobApplicationId: 'job-1', jobApplication: { company: 'Meta' } };

  it('creates a thank-you when a just-decided round has a contact and none exists yet', async () => {
    const { service, create } = makeService({ rounds: [round], contactFor: () => ({ id: 'c1' }), existingThankYou: () => null });
    const result = await service.sweep(NOW);
    expect(result.thankYous).toBe(1);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'thank_you', interviewRoundId: 'round-1', jobApplicationId: 'job-1' }) });
  });

  it('skips when there is no contact, or a thank-you already exists', async () => {
    const noContact = makeService({ rounds: [round], contactFor: () => null });
    expect((await noContact.service.sweep(NOW)).thankYous).toBe(0);

    const dup = makeService({ rounds: [round], contactFor: () => ({ id: 'c1' }), existingThankYou: () => ({ id: 'r' }) });
    expect((await dup.service.sweep(NOW)).thankYous).toBe(0);
    expect(dup.create).not.toHaveBeenCalled();
  });
});
