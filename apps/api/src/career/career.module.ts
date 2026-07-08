import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';

@Module({
  // ReadinessModule (MOM-129) provides the shared FSRS-grounded readiness engine.
  imports: [PrismaModule, ReadinessModule],
  controllers: [CareerController],
  providers: [CareerService],
  exports: [CareerService],
})
export class CareerModule {}
