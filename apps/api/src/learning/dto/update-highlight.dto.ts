import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  CAREER_ROLE_AREA_IDS,
  CAREER_ROLE_TRACK_IDS,
  CareerRoleAreaId,
  CareerRoleTrackId,
} from '@momito/shared';

export class UpdateHighlightDto {
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
  @IsBoolean()
  reviewed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  usefulness?: string | null;
}
