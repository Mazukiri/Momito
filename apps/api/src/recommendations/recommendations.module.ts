import { Module } from '@nestjs/common';
import { CareerModule } from '../career/career.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ResumesModule } from '../resumes/resumes.module';
import { WeaknessesModule } from '../weaknesses/weaknesses.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [PrismaModule, CareerModule, WeaknessesModule, ResumesModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
