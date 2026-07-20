import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CRON_FOLLOW_UP_SWEEP, CRON_OPTIONS } from '../common/schedule';
import { FollowUpService } from './follow-up.service';

// MOM-118: once a day, sweep for applications that have gone quiet and interviews
// that just concluded, emitting idempotent follow-up / thank-you reminders. The
// idempotency + logic live in FollowUpService; this is just the trigger.
//
// MOM-176: was `CronExpression.EVERY_DAY_AT_7AM`, which with `TZ: UTC` in
// render.yaml actually fired at 14:00 ICT. Time and zone now both come from
// common/schedule.ts.
@Injectable()
export class FollowUpScheduler {
  private readonly logger = new Logger(FollowUpScheduler.name);

  constructor(private readonly followUp: FollowUpService) {}

  @Cron(CRON_FOLLOW_UP_SWEEP, CRON_OPTIONS)
  async tick(): Promise<void> {
    // Logged rather than thrown: an unhandled rejection in a cron tick is an
    // invisible no-op, and a missed sweep is never made up.
    try {
      const { followUps, thankYous } = await this.followUp.sweep();
      if (followUps > 0 || thankYous > 0) {
        this.logger.log(`Follow-up sweep: ${followUps} follow-up + ${thankYous} thank-you reminder(s).`);
      }
    } catch (error) {
      this.logger.error('Follow-up sweep failed.', error instanceof Error ? error.stack : String(error));
    }
  }
}
