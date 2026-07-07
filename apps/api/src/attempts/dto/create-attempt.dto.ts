import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MISS_TAG_REASONS, type MissTagReason } from '@momito/shared';

// Standalone attempt (no session) — AnswerAttempt.sessionId is already
// nullable, so a quick recall recorded straight from the Today queue is a
// first-class attempt: it feeds streak, weakness signals, and attempt history
// exactly like a session answer ("Every serious attempt creates history",
// plan §2.1.3). Field-for-field the same shape as sessions' CreateAnswerDto.
export class CreateAttemptDto {
  @IsUUID()
  questionId!: string;

  @IsString()
  @MinLength(1)
  answerText!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  selfRating?: number;

  @IsOptional()
  @IsIn(['correct', 'partial', 'incorrect'])
  correctness?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  timeSpentSeconds?: number;

  @IsOptional()
  @IsBoolean()
  hintUsed?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MISS_TAG_REASONS.length)
  @IsIn(MISS_TAG_REASONS, { each: true })
  missTags?: MissTagReason[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reflectionNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  complexity?: string;
}
