import { Module } from '@nestjs/common';
import { WeaknessesController } from './weaknesses.controller';
import { WeaknessesService } from './weaknesses.service';

@Module({
  controllers: [WeaknessesController],
  providers: [WeaknessesService],
  exports: [WeaknessesService],
})
export class WeaknessesModule {}
