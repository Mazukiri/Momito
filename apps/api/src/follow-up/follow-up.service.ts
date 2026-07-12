import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
// MOM-118: an `applied` app with no stage movement for this long earns a gentle
// "follow up" nudge — earlier than the MOM-105 stall threshold (21d), because a
// nudge to act is useful well before the app is officially stale.
const APPLIED_FOLLOWUP_DAYS = 10;

@Injectable()
export class FollowUpService {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotent daily sweep. (a) an `applied` app stale ≥ N days gets one open
  // `follow_up` reminder; (b) a just-decided interview round with a known contact
  // gets one `thank_you` reminder. Both are capped so a re-run never duplicates.
  async sweep(now: Date = new Date()): Promise<{ followUps: number; thankYous: number }> {
    return {
      followUps: await this.sweepApplicationFollowUps(now),
      thankYous: await this.sweepThankYous(now),
    };
  }

  private async sweepApplicationFollowUps(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - APPLIED_FOLLOWUP_DAYS * DAY_MS);
    const jobs = await this.prisma.jobApplication.findMany({
      where: { status: 'applied' },
      select: {
        id: true,
        userId: true,
        company: true,
        createdAt: true,
        // The current stage's entry time (MOM-104): last transition, else creation.
        events: { where: { type: 'status_change' }, orderBy: { eventAt: 'desc' }, take: 1, select: { eventAt: true } },
        // Cap: skip if this job already has an open follow-up reminder.
        reminders: { where: { type: 'follow_up', status: 'pending' }, select: { id: true }, take: 1 },
      },
    });

    let created = 0;
    for (const job of jobs) {
      const enteredAt = job.events[0]?.eventAt ?? job.createdAt;
      if (enteredAt > cutoff) continue; // not stale enough yet
      if (job.reminders.length > 0) continue; // already nudging
      await this.prisma.reminder.create({
        data: { userId: job.userId, jobApplicationId: job.id, type: 'follow_up', title: `Follow up with ${job.company}`, dueAt: now },
      });
      created += 1;
    }
    return created;
  }

  private async sweepThankYous(now: Date): Promise<number> {
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const rounds = await this.prisma.interviewRound.findMany({
      where: { outcome: { not: 'pending' }, updatedAt: { gte: dayAgo } },
      select: { id: true, userId: true, jobApplicationId: true, jobApplication: { select: { company: true } } },
    });

    let created = 0;
    for (const round of rounds) {
      // Only nudge a thank-you when there's someone to thank.
      const contact = await this.prisma.contact.findFirst({ where: { jobApplicationId: round.jobApplicationId }, select: { id: true } });
      if (!contact) continue;
      // Cap: one thank-you reminder per round.
      const existing = await this.prisma.reminder.findFirst({ where: { interviewRoundId: round.id, type: 'thank_you' }, select: { id: true } });
      if (existing) continue;
      await this.prisma.reminder.create({
        data: {
          userId: round.userId,
          jobApplicationId: round.jobApplicationId,
          interviewRoundId: round.id,
          type: 'thank_you',
          title: `Send a thank-you note for your ${round.jobApplication?.company ?? 'interview'} interview`,
          dueAt: now,
        },
      });
      created += 1;
    }
    return created;
  }
}
