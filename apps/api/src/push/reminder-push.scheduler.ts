import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CRON_OPTIONS, CRON_REMINDER_PUSH } from '../common/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

// Fires every 5 minutes on an off-minute (not :00/:05/:10...) to avoid
// clustering with other scheduled jobs. No-ops entirely when Web Push isn't
// configured (docs/adr/0008-web-push-notifications.md) — this is what makes
// the reminder→notification pipeline actually fire while the app is closed,
// unlike the poll-on-fetch ReminderBell which only works while a tab is open.
@Injectable()
export class ReminderPushScheduler {
  private readonly logger = new Logger(ReminderPushScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  @Cron(CRON_REMINDER_PUSH, CRON_OPTIONS)
  async tick(): Promise<void> {
    if (!this.push.isAvailable()) return;

    const due = await this.prisma.reminder.findMany({
      where: {
        status: 'pending',
        dismissedAt: null,
        lastTriggeredAt: null,
        dueAt: { lte: new Date() },
      },
      take: 100,
    });

    let triggered = 0;
    let retrying = 0;

    for (const reminder of due) {
      // MOM-176: each reminder is isolated. Previously one throw aborted the
      // whole tick, so a single bad row silently starved every reminder behind
      // it — and because ticks are 5 minutes apart with no catch-up, those
      // notifications were simply never sent.
      try {
        const result = await this.push.sendToUser(reminder.userId, {
          title: reminder.title,
          body: 'Tap to review on your calendar.',
          url: '/calendar',
        });

        // Only settle the reminder once it is actually resolved. Delivering to
        // at least one device counts; so does having no devices at all, since
        // there is nothing to retry. Having devices that all rejected the send
        // is transient — leave lastTriggeredAt null and try again next tick.
        if (result.delivered > 0 || result.subscriptions === 0) {
          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: { lastTriggeredAt: new Date() },
          });
          triggered += 1;
        } else {
          retrying += 1;
        }
      } catch (error) {
        retrying += 1;
        this.logger.error(
          `Push failed for reminder ${reminder.id}; will retry next tick.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (triggered > 0) {
      this.logger.log(`Sent push notifications for ${triggered} due reminder(s).`);
    }
    if (retrying > 0) {
      this.logger.warn(`${retrying} reminder(s) undelivered; left pending for the next tick.`);
    }
  }
}
