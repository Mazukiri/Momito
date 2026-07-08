import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { WeaknessesModule } from '../weaknesses/weaknesses.module';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';

@Module({
  // ReadinessModule (MOM-129): shared FSRS-grounded readiness engine.
  // WeaknessesModule (MOM-130): open weakness signals dock the job readiness verdict.
  imports: [PrismaModule, ReadinessModule, WeaknessesModule],
  controllers: [CareerController],
  providers: [CareerService],
  exports: [CareerService],
})
export class CareerModule {}
