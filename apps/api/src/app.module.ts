import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './questions/questions.module';
import { TopicsModule } from './topics/topics.module';
import { SessionsModule } from './sessions/sessions.module';
import { AttemptsModule } from './attempts/attempts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StudyPlanModule } from './study-plan/study-plan.module';
import { ProfileModule } from './profile/profile.module';
import { ProfileScoresModule } from './profile-scores/profile-scores.module';
import { CareerModule } from './career/career.module';
import { JobsModule } from './jobs/jobs.module';
import { TasksModule } from './tasks/tasks.module';
import { LearningModule } from './learning/learning.module';
import { MissionsModule } from './missions/missions.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    QuestionsModule,
    TopicsModule,
    CompaniesModule,
    SessionsModule,
    AttemptsModule,
    DashboardModule,
    StudyPlanModule,
    ProfileModule,
    ProfileScoresModule,
    CareerModule,
    JobsModule,
    TasksModule,
    LearningModule,
    MissionsModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
