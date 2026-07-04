import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfileScoresController } from './profile-scores.controller';
import { ProfileScoresService } from './profile-scores.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfileScoresController],
  providers: [ProfileScoresService],
  exports: [ProfileScoresService],
})
export class ProfileScoresModule {}
