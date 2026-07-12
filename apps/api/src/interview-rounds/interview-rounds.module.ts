import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WeaknessesModule } from '../weaknesses/weaknesses.module';
import { InterviewPrepScheduler } from './interview-prep.scheduler';
import { InterviewRoundsController } from './interview-rounds.controller';
import { InterviewRoundsService } from './interview-rounds.service';

@Module({
  // WeaknessesModule provides WeaknessesService for the MOM-113 debrief→signal edge.
  imports: [PrismaModule, WeaknessesModule],
  controllers: [InterviewRoundsController],
  // InterviewPrepScheduler (MOM-141) auto-assembles prep for upcoming rounds daily.
  providers: [InterviewRoundsService, InterviewPrepScheduler],
  exports: [InterviewRoundsService],
})
export class InterviewRoundsModule {}
