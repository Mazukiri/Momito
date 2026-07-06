import { describe, expect, it, vi } from 'vitest';
import { ReminderPushScheduler } from '../src/push/reminder-push.scheduler';

function makeFakePush(available: boolean) {
  return {
    isAvailable: vi.fn().mockReturnValue(available),
    sendToUser: vi.fn().mockResolvedValue(undefined),
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
});
