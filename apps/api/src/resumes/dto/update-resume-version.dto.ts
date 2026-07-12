import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CAREER_ROLE_TRACK_IDS, CareerRoleTrackId } from '@momito/shared';

// MOM-154. The AI's rewrites are server state, not scratch state: the model writes them
// (MOM-137) and the user works the list down by accepting or dismissing entries. The column
// is Json, so the shape is validated here rather than trusted as an opaque blob.
export class ResumeBulletRewriteDto {
  @IsString()
  @MaxLength(2000)
  original!: string;

  @IsString()
  @MaxLength(2000)
  rewritten!: string;

  @IsString()
  @MaxLength(2000)
  rationale!: string;
}

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

  // MOM-154: what remains of the AI's rewrites after the user accepted or dismissed some.
  // Sent alongside contentMd, so applying a rewrite and retiring it are a single write.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ResumeBulletRewriteDto)
  aiSuggestions?: ResumeBulletRewriteDto[];
}
