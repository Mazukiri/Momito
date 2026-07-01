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
  ],
})
export class AppModule {}
