import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { HealthModule } from './health/health.module';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';

@Module({
  imports: [
    // MOM-017: default global rate limit. Health checks stay unaffected in practice
    // because liveness pollers run far below this rate; MOM-018 layers a tighter
    // limit onto auth routes specifically.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    HealthModule,
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
