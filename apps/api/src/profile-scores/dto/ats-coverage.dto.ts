import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AtsCoverageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  jdText!: string;

  // MOM-134-full: when set, measure coverage against this ResumeVersion's
  // contentMd instead of the base profile skills.
  @IsOptional()
  @IsUUID()
  resumeVersionId?: string;
}
