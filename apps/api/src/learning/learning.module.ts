import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  // ReviewsModule (MOM-146) lets a reviewed highlight seed an FSRS ReviewState so
  // it enters the spaced-repetition queue instead of dead-ending in the ledger.
  imports: [PrismaModule, ReviewsModule],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
