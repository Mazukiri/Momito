import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FollowUpService } from './follow-up.service';

// MOM-118: once a day, sweep for applications that have gone quiet and interviews
// that just concluded, emitting idempotent follow-up / thank-you reminders. The
// idempotency + logic live in FollowUpService; this is just the trigger.
@Injectable()
export class FollowUpScheduler {
  private readonly logger = new Logger(FollowUpScheduler.name);

  constructor(private readonly followUp: FollowUpService) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async tick(): Promise<void> {
    const { followUps, thankYous } = await this.followUp.sweep();
    if (followUps > 0 || thankYous > 0) {
      this.logger.log(`Follow-up sweep: ${followUps} follow-up + ${thankYous} thank-you reminder(s).`);
    }
  }
}
