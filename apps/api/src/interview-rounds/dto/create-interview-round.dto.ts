import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { INTERVIEW_ROUND_TYPES, InterviewRoundType } from '@momito/shared';

export class CreateInterviewRoundDto {
  @IsIn(INTERVIEW_ROUND_TYPES)
  roundType!: InterviewRoundType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  sequence?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMinutes?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  interviewer?: string | null;
}
