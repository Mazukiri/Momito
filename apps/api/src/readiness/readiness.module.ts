import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessService } from './readiness.service';

// MOM-129: the single readiness engine, shared by CareerModule and MissionsModule.
@Module({
  imports: [PrismaModule],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
