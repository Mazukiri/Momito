import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { CAREER_ROLE_TRACK_IDS, MISSION_SOURCE_TYPES, MISSION_STAGES, CareerRoleTrackId, MissionSourceType, MissionStage } from '@momito/shared';

export class UpdateMissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string | null;

  @IsOptional()
  @IsIn(MISSION_SOURCE_TYPES)
  sourceType?: MissionSourceType;

  @IsOptional()
  @IsIn(CAREER_ROLE_TRACK_IDS)
  roleTrackId?: CareerRoleTrackId;

  @IsOptional()
  @IsUUID()
  careerGoalId?: string | null;

  @IsOptional()
  @IsUUID()
  jobApplicationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  weeklyHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  successDefinition?: string | null;

  @IsOptional()
  @IsIn(MISSION_STAGES)
  stage?: MissionStage;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  diagnosisSummary?: string | null;
}
