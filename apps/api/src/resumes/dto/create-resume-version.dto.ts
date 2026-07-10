import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CAREER_ROLE_TRACK_IDS, CareerRoleTrackId } from '@momito/shared';

export class CreateResumeVersionDto {
  @IsString()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsIn(CAREER_ROLE_TRACK_IDS)
  targetRoleTrackId?: CareerRoleTrackId | null;

  @IsOptional()
  @IsUUID()
  jobApplicationId?: string | null;

  // Omit to derive the content from the current Profile.
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  contentMd?: string;
}
