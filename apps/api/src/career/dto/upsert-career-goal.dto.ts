import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  CAREER_GOAL_HORIZONS,
  CAREER_GOAL_STATUSES,
  CAREER_ROLE_TRACK_IDS,
  CareerGoalHorizon,
  CareerGoalStatus,
  CareerRoleTrackId,
} from '@momito/shared';

export class UpsertCareerGoalDto {
  @IsIn(CAREER_ROLE_TRACK_IDS)
  roleTrackId!: CareerRoleTrackId;

  @IsOptional()
  @IsIn(CAREER_GOAL_HORIZONS)
  horizon?: CareerGoalHorizon;

  @IsOptional()
  @IsIn(CAREER_GOAL_STATUSES)
  status?: CareerGoalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetDate?: string | null;
}
