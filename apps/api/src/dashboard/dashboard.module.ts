import { Module } from '@nestjs/common';
import { CareerModule } from '../career/career.module';
import { MissionsModule } from '../missions/missions.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({ imports: [CareerModule, MissionsModule, RecommendationsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
