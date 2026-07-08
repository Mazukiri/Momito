import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  // ReadinessModule (MOM-129) provides the shared canonical positive-attempt rule.
  imports: [PrismaModule, ReadinessModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
