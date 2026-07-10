import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CAREER_ROLE_TRACK_IDS, CareerRoleTrackId } from '@momito/shared';

export class UpdateResumeVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsIn(CAREER_ROLE_TRACK_IDS)
  targetRoleTrackId?: CareerRoleTrackId | null;

  // `null` detaches from the job.
  @IsOptional()
  @IsUUID()
  jobApplicationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  contentMd?: string;
}
