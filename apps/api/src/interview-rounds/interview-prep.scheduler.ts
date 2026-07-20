import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CRON_INTERVIEW_PREP, CRON_OPTIONS } from '../common/schedule';
import { InterviewRoundsService } from './interview-rounds.service';

// MOM-141: once a day, assemble the round-scoped prep queue for any interview
// coming up within a week that doesn't have prep yet. The heavy lifting (and
// idempotency) lives in InterviewRoundsService.autoAssembleUpcomingPrep; this is
// just the trigger.
//
// MOM-176: was `CronExpression.EVERY_DAY_AT_6AM`, which with `TZ: UTC` in
// render.yaml actually fired at 13:00 ICT. Time and zone now both come from
// common/schedule.ts — see that file for why it isn't simply 06:00 local.
@Injectable()
export class InterviewPrepScheduler {
  private readonly logger = new Logger(InterviewPrepScheduler.name);

  constructor(private readonly rounds: InterviewRoundsService) {}

  @Cron(CRON_INTERVIEW_PREP, CRON_OPTIONS)
  async tick(): Promise<void> {
    // A throw here escapes into the scheduler as an unhandled rejection and the
    // run vanishes without a trace, so failures are logged rather than raised.
    try {
      const result = await this.rounds.autoAssembleUpcomingPrep();
      if (result.roundsPrepared > 0) {
        this.logger.log(`Auto-assembled prep for ${result.roundsPrepared} upcoming round(s) (${result.tasksCreated} task(s)).`);
      }
    } catch (error) {
      this.logger.error('Interview prep sweep failed.', error instanceof Error ? error.stack : String(error));
    }
  }
}
