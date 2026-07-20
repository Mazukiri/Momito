import { describe, expect, it, vi } from 'vitest';
import { ReminderPushScheduler } from '../src/push/reminder-push.scheduler';

// Default: one device, delivery succeeds. MOM-176 gave sendToUser a real return
// value, so the fake has to model it — the scheduler now branches on the result
// instead of assuming success.
function makeFakePush(available: boolean, result = { subscriptions: 1, delivered: 1, failed: 0 }) {
  return {
    isAvailable: vi.fn().mockReturnValue(available),
    sendToUser: vi.fn().mockResolvedValue(result),
  };
}

describe('ReminderPushScheduler', () => {
  it('no-ops entirely when push is unavailable (no VAPID keys)', async () => {
    const findMany = vi.fn();
    const push = makeFakePush(false);
    const scheduler = new ReminderPushScheduler({ reminder: { findMany } } as never, push as never);

    await scheduler.tick();

    expect(findMany).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('sends push for due, undelivered, non-dismissed reminders and stamps lastTriggeredAt', async () => {
    const due = [
      { id: 'r1', userId: 'user-1', title: 'Review CUDA memory hierarchy' },
      { id: 'r2', userId: 'user-1', title: 'Prepare for NVIDIA deadline' },
    ];
    const findMany = vi.fn().mockResolvedValue(due);
    const update = vi.fn().mockResolvedValue({});
    const push = makeFakePush(true);
    const scheduler = new ReminderPushScheduler({ reminder: { findMany, update } } as never, push as never);

    await scheduler.tick();

    // Query must only target pending, non-dismissed, undelivered, already-due reminders.
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe('pending');
    expect(where.dismissedAt).toBeNull();
    expect(where.lastTriggeredAt).toBeNull();
    expect(where.dueAt.lte).toBeInstanceOf(Date);

    expect(push.sendToUser).toHaveBeenCalledTimes(2);
    expect(push.sendToUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ title: 'Review CUDA memory hierarchy' }));
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0].where).toEqual({ id: 'r1' });
    expect(update.mock.calls[0][0].data.lastTriggeredAt).toBeInstanceOf(Date);
  });

  it('does nothing when no reminders are due', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const update = vi.fn();
    const push = makeFakePush(true);
    const scheduler = new ReminderPushScheduler({ reminder: { findMany, update } } as never, push as never);

    await scheduler.tick();

    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // The bug MOM-176 fixes: every device rejected the send, but the reminder was
  // stamped as triggered anyway, so it was never retried and the notification
  // was lost for good.
  it('leaves lastTriggeredAt null when every device rejected the send', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'r1', userId: 'user-1', title: 'Follow up' }]);
    const update = vi.fn().mockResolvedValue({});
    const push = makeFakePush(true, { subscriptions: 2, delivered: 0, failed: 2 });
    const scheduler = new ReminderPushScheduler({ reminder: { findMany, update } } as never, push as never);

    await scheduler.tick();

    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it('settles the reminder when the user has no devices at all', async () => {
    // Nothing to retry, so retrying forever would just re-scan this row every
    // 5 minutes and crowd the take: 100 window.
    const findMany = vi.fn().mockResolvedValue([{ id: 'r1', userId: 'user-1', title: 'Follow up' }]);
    const update = vi.fn().mockResolvedValue({});
    const push = makeFakePush(true, { subscriptions: 0, delivered: 0, failed: 0 });
    const scheduler = new ReminderPushScheduler({ reminder: { findMany, update } } as never, push as never);

    await scheduler.tick();

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('settles when at least one of several devices accepted the send', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'r1', userId: 'user-1', title: 'Follow up' }]);
    const update = vi.fn().mockResolvedValue({});
    const push = makeFakePush(true, { subscriptions: 3, delivered: 1, failed: 2 });
    const scheduler = new ReminderPushScheduler({ reminder: { findMany, update } } as never, push as never);

    await scheduler.tick();

    expect(update).toHaveBeenCalledTimes(1);
  });

  // Previously an unhandled rejection aborted the loop, so one bad row starved
  // every reminder queued behind it — invisibly, since nothing logged.
  it('keeps going when one reminder throws, and does not settle that one', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'r1', userId: 'user-1', title: 'Explodes' },
      { id: 'r2', userId: 'user-1', title: 'Should still send' },
    ]);
    const update = vi.fn().mockResolvedValue({});
    const push = makeFakePush(true);
    push.sendToUser
      .mockRejectedValueOnce(new Error('web-push exploded'))
      .mockResolvedValueOnce({ subscriptions: 1, delivered: 1, failed: 0 });
    const scheduler = new ReminderPushScheduler({ reminder: { findMany, update } } as never, push as never);

    await expect(scheduler.tick()).resolves.toBeUndefined();

    expect(push.sendToUser).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where).toEqual({ id: 'r2' });
  });
});
