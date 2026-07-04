import { Module } from '@nestjs/common';
import { CareerModule } from '../career/career.module';
import { MissionsModule } from '../missions/missions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [PrismaModule, CareerModule, MissionsModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
