import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { ReminderPushScheduler } from './reminder-push.scheduler';

@Module({
  controllers: [PushController],
  providers: [PushService, ReminderPushScheduler],
})
export class PushModule {}
