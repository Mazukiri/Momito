import { STUDY_PLAN_STATUSES } from '@momito/shared';
import { IsIn, IsOptional } from 'class-validator';

export class ListStudyPlanDto {
  @IsOptional()
  @IsIn(STUDY_PLAN_STATUSES)
  status?: (typeof STUDY_PLAN_STATUSES)[number];
}
