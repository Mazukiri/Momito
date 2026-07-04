import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  CAREER_ROLE_AREA_IDS,
  CAREER_ROLE_TRACK_IDS,
  CareerRoleAreaId,
  CareerRoleTrackId,
} from '@momito/shared';

export class CreateEvidenceDto {
  @IsString()
  @MaxLength(80)
  type!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  body?: string | null;

  @IsOptional()
  @IsIn(CAREER_ROLE_TRACK_IDS)
  roleTrackId?: CareerRoleTrackId | null;

  @IsOptional()
  @IsIn(CAREER_ROLE_AREA_IDS)
  area?: CareerRoleAreaId | null;

  @IsOptional()
  @IsUUID()
  topicId?: string | null;

  @IsOptional()
  @IsUUID()
  sourceId?: string | null;

  @IsOptional()
  @IsUUID()
  highlightId?: string | null;

  @IsOptional()
  @IsUUID()
  taskId?: string | null;

  @IsOptional()
  @IsUUID()
  questionId?: string | null;

  @IsOptional()
  @IsUUID()
  jobApplicationId?: string | null;

  @IsOptional()
  @IsUUID()
  missionId?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  occurredAt?: string | null;
}
