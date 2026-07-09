import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InterviewRoundsService } from './interview-rounds.service';

// MOM-141: once a day, assemble the round-scoped prep queue for any interview
// coming up within a week that doesn't have prep yet. The heavy lifting (and
// idempotency) lives in InterviewRoundsService.autoAssembleUpcomingPrep; this is
// just the trigger.
@Injectable()
export class InterviewPrepScheduler {
  private readonly logger = new Logger(InterviewPrepScheduler.name);

  constructor(private readonly rounds: InterviewRoundsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async tick(): Promise<void> {
    const result = await this.rounds.autoAssembleUpcomingPrep();
    if (result.roundsPrepared > 0) {
      this.logger.log(`Auto-assembled prep for ${result.roundsPrepared} upcoming round(s) (${result.tasksCreated} task(s)).`);
    }
  }
}
