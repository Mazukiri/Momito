import { STUDY_PLAN_STATUSES } from '@momito/shared';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateStudyPlanItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsUUID()
  topicId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  targetDate?: string | null;

  @IsOptional()
  @IsIn(STUDY_PLAN_STATUSES)
  status?: (typeof STUDY_PLAN_STATUSES)[number];
}
