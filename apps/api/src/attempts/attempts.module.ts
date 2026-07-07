import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';

@Module({ imports: [ReviewsModule], controllers: [AttemptsController], providers: [AttemptsService] })
export class AttemptsModule {}
