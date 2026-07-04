import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfParserService } from './pdf-parser.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfileController],
  providers: [PdfParserService, ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
