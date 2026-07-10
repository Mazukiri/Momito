import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FollowUpScheduler } from './follow-up.scheduler';
import { FollowUpService } from './follow-up.service';

@Module({
  imports: [PrismaModule],
  providers: [FollowUpService, FollowUpScheduler],
  exports: [FollowUpService],
})
export class FollowUpModule {}
