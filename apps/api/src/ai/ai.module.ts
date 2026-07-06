import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { BudgetService } from './budget.service';
import { GradingService } from './grading.service';

@Module({ controllers: [AiController], providers: [AiService, BudgetService, GradingService] })
export class AiModule {}
