import { Module } from '@nestjs/common';
import { DsaController } from './dsa.controller';
import { DsaService } from './dsa.service';

@Module({ controllers: [DsaController], providers: [DsaService] })
export class DsaModule {}
