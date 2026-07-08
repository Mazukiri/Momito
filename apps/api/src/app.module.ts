import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './questions/questions.module';
import { TopicsModule } from './topics/topics.module';
import { SessionsModule } from './sessions/sessions.module';
import { AttemptsModule } from './attempts/attempts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProfileModule } from './profile/profile.module';
import { ProfileScoresModule } from './profile-scores/profile-scores.module';
import { CareerModule } from './career/career.module';
import { JobsModule } from './jobs/jobs.module';
import { InterviewRoundsModule } from './interview-rounds/interview-rounds.module';
import { TasksModule } from './tasks/tasks.module';
import { LearningModule } from './learning/learning.module';
import { MissionsModule } from './missions/missions.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { WeaknessesModule } from './weaknesses/weaknesses.module';
import { HealthModule } from './health/health.module';
import { ContentModule } from './content/content.module';
import { DsaModule } from './dsa/dsa.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StoriesModule } from './stories/stories.module';
import { AiModule } from './ai/ai.module';
import { PushModule } from './push/push.module';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';

@Module({
  imports: [
    // MOM-017: default global rate limit. Health checks stay unaffected in practice
    // because liveness pollers run far below this rate; MOM-018 layers a tighter
    // limit onto auth routes specifically.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Needed for ReminderPushScheduler's @Cron (push/reminder-push.scheduler.ts).
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    ContentModule,
    DsaModule,
    ReviewsModule,
    StoriesModule,
    QuestionsModule,
    TopicsModule,
    CompaniesModule,
    SessionsModule,
    AttemptsModule,
    DashboardModule,
    ProfileModule,
    ProfileScoresModule,
    CareerModule,
    JobsModule,
    InterviewRoundsModule,
    TasksModule,
    LearningModule,
    MissionsModule,
    RecommendationsModule,
    WeaknessesModule,
    AiModule,
    PushModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
