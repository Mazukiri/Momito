import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushService } from '../src/push/push.service';

// Subclass to inject a fake sender without touching Nest DI or real network
// calls — same pattern as GradingService's overridable createClient().
class TestPushService extends PushService {
  public sendCalls: Array<{ endpoint: string; payload: string }> = [];
  public failWith: number | null = null;

  protected override sendRaw(subscription: { endpoint: string }, payload: string) {
    this.sendCalls.push({ endpoint: subscription.endpoint, payload });
    if (this.failWith !== null) {
      const error = new Error('push failed') as Error & { statusCode: number };
      error.statusCode = this.failWith;
      return Promise.reject(error);
    }
    return Promise.resolve({} as never);
  }
}

describe('PushService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports unavailable with no VAPID keys configured', () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    const service = new PushService({} as never);
    expect(service.isAvailable()).toBe(false);
    expect(service.getPublicKey()).toBeUndefined();
  });

  it('reports available once both VAPID keys are set', () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    const service = new PushService({} as never);
    expect(service.isAvailable()).toBe(true);
    expect(service.getPublicKey()).toBe('pub');
  });

  it('upserts a subscription by endpoint', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = { pushSubscription: { upsert } };
    const service = new PushService(prisma as never);

    await service.subscribe(
      'user-1',
      { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
      'test-agent',
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where.endpoint).toBe('https://push.example/abc');
    expect(call.create.userId).toBe('user-1');
    expect(call.create.p256dh).toBe('p');
    expect(call.update.userAgent).toBe('test-agent');
  });

  it('deletes a subscription scoped to the owning user', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { pushSubscription: { deleteMany } };
    const service = new PushService(prisma as never);

    await service.unsubscribe('user-1', 'https://push.example/abc');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', endpoint: 'https://push.example/abc' },
    });
  });

  it('does nothing when sending to a user with no VAPID keys configured', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    const findMany = vi.fn();
    const service = new TestPushService({ pushSubscription: { findMany } } as never);

    await service.sendToUser('user-1', { title: 'Hi' });

    expect(findMany).not.toHaveBeenCalled();
    expect(service.sendCalls).toHaveLength(0);
  });

  it('sends to every subscription for the user when available', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    const findMany = vi.fn().mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'a1' },
      { id: 'sub-2', endpoint: 'https://push.example/2', p256dh: 'p2', auth: 'a2' },
    ]);
    const service = new TestPushService({ pushSubscription: { findMany } } as never);

    await service.sendToUser('user-1', { title: 'Reminder due' });

    expect(service.sendCalls).toHaveLength(2);
    expect(JSON.parse(service.sendCalls[0].payload)).toEqual({ title: 'Reminder due' });
  });

  it('prunes a subscription when the push service reports it gone (410)', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    const deleteFn = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([
      { id: 'sub-dead', endpoint: 'https://push.example/dead', p256dh: 'p', auth: 'a' },
    ]);
    const service = new TestPushService({ pushSubscription: { findMany, delete: deleteFn } } as never);
    service.failWith = 410;

    await service.sendToUser('user-1', { title: 'Reminder due' });

    expect(deleteFn).toHaveBeenCalledWith({ where: { id: 'sub-dead' } });
  });

  it('does not prune on a non-gone error (e.g. transient 500)', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    const deleteFn = vi.fn();
    const findMany = vi.fn().mockResolvedValue([
      { id: 'sub-flaky', endpoint: 'https://push.example/flaky', p256dh: 'p', auth: 'a' },
    ]);
    const service = new TestPushService({ pushSubscription: { findMany, delete: deleteFn } } as never);
    service.failWith = 500;

    await service.sendToUser('user-1', { title: 'Reminder due' });

    expect(deleteFn).not.toHaveBeenCalled();
  });
});
