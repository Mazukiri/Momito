import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InterviewRoundsController } from './interview-rounds.controller';
import { InterviewRoundsService } from './interview-rounds.service';

@Module({
  imports: [PrismaModule],
  controllers: [InterviewRoundsController],
  providers: [InterviewRoundsService],
  exports: [InterviewRoundsService],
})
export class InterviewRoundsModule {}
