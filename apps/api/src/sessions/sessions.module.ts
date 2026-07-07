import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { WeaknessesModule } from '../weaknesses/weaknesses.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({ imports: [ReviewsModule, WeaknessesModule], controllers: [SessionsController], providers: [SessionsService] })
export class SessionsModule {}
