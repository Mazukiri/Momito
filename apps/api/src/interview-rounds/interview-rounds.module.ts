import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WeaknessesModule } from '../weaknesses/weaknesses.module';
import { InterviewRoundsController } from './interview-rounds.controller';
import { InterviewRoundsService } from './interview-rounds.service';

@Module({
  // WeaknessesModule provides WeaknessesService for the MOM-113 debrief→signal edge.
  imports: [PrismaModule, WeaknessesModule],
  controllers: [InterviewRoundsController],
  providers: [InterviewRoundsService],
  exports: [InterviewRoundsService],
})
export class InterviewRoundsModule {}
