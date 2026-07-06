import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

  @Cron('3,8,13,18,23,28,33,38,43,48,53,58 * * * *')
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

    for (const reminder of due) {
      await this.push.sendToUser(reminder.userId, {
        title: reminder.title,
        body: 'Tap to review on your calendar.',
        url: '/calendar',
      });
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { lastTriggeredAt: new Date() },
      });
    }

    if (due.length) {
      this.logger.log(`Sent push notifications for ${due.length} due reminder(s).`);
    }
  }
}
