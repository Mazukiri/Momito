import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { getVapidPrivateKey, getVapidPublicKey, getVapidSubject, isPushAvailable } from '../common/config';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

// What a send attempt actually achieved. `subscriptions === 0` means the user
// has no devices registered, which is a settled state rather than a failure —
// distinct from `delivered === 0 && failed > 0`, which is worth retrying.
export interface PushDeliveryResult {
  subscriptions: number;
  delivered: number;
  failed: number;
}

// Web Push: absence of a VAPID keypair means every call here is a silent
// no-op rather than an error — same dormant-until-configured pattern as AI
// grading (docs/adr/0008-web-push-notifications.md).
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(private readonly prisma: PrismaService) {}

  isAvailable(): boolean {
    return isPushAvailable();
  }

  getPublicKey(): string | undefined {
    return getVapidPublicKey();
  }

  // Overridden in tests to inject a fake sender without touching Nest DI.
  protected sendRaw(
    subscription: webpush.PushSubscription,
    payload: string,
  ): Promise<webpush.SendResult> {
    this.ensureConfigured();
    return webpush.sendNotification(subscription, payload);
  }

  private ensureConfigured(): void {
    if (this.configured) return;
    const publicKey = getVapidPublicKey();
    const privateKey = getVapidPrivateKey();
    if (!publicKey || !privateKey) return;
    webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
    this.configured = true;
  }

  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent: string | undefined,
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  // Sends to every device the user has subscribed on; prunes any subscription
  // the push service reports as gone (404/410) instead of surfacing an error.
  //
  // MOM-176: now reports what actually happened. This used to return void and
  // swallow every failure, which meant ReminderPushScheduler had no way to tell
  // "delivered" from "every device rejected it" — and it marked the reminder as
  // triggered either way, losing the notification permanently. Errors are still
  // never thrown; the caller decides what a failure means.
  async sendToUser(userId: string, payload: PushPayload): Promise<PushDeliveryResult> {
    if (!this.isAvailable()) return { subscriptions: 0, delivered: 0, failed: 0 };

    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    const body = JSON.stringify(payload);

    const outcomes = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await this.sendRaw(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
          return true;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // The device is gone for good, not failing transiently — pruning it
            // counts as resolved, so a stale subscription can't wedge a reminder
            // in permanent retry.
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
            return true;
          }
          this.logger.warn(`Push send failed for subscription ${sub.id}: ${String(error)}`);
          return false;
        }
      }),
    );

    const delivered = outcomes.filter(Boolean).length;
    return { subscriptions: subscriptions.length, delivered, failed: outcomes.length - delivered };
  }
}
