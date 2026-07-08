import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  CAREER_ROLE_AREA_IDS,
  CareerRoleAreaId,
  INTERVIEW_ROUND_OUTCOMES,
  INTERVIEW_ROUND_TYPES,
  InterviewRoundOutcome,
  InterviewRoundType,
  MISS_TAG_REASONS,
  MissTagReason,
} from '@momito/shared';

export class UpdateInterviewRoundDto {
  @IsOptional()
  @IsIn(INTERVIEW_ROUND_TYPES)
  roundType?: InterviewRoundType;

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

  @IsOptional()
  @IsIn(INTERVIEW_ROUND_OUTCOMES)
  outcome?: InterviewRoundOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  debrief?: string | null;

  // The competency areas this round exposed as weak — MOM-113 turns each into a
  // WeaknessSignal, so it must speak the same taxonomy as the practice engine.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(CAREER_ROLE_AREA_IDS, { each: true })
  areasWeak?: CareerRoleAreaId[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(MISS_TAG_REASONS, { each: true })
  missTags?: MissTagReason[];
}
