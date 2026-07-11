import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { BudgetService } from './budget.service';
import { GradingService } from './grading.service';
import { ResumeAiController } from './resume-ai.controller';
import { ResumeAiOrchestrator } from './resume-ai.orchestrator';
import { ResumeAiService } from './resume-ai.service';

@Module({
  controllers: [AiController, ResumeAiController],
  // MOM-136/137/138 résumé AI shares the same daily BudgetService pool as grading.
  providers: [AiService, BudgetService, GradingService, ResumeAiService, ResumeAiOrchestrator],
})
export class AiModule {}
