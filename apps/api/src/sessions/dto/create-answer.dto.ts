import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { SELF_RATING_MAX, SELF_RATING_MIN } from '@momito/shared';

export class CreateAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsString()
  @MinLength(1)
  answerText!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(SELF_RATING_MIN)
  @Max(SELF_RATING_MAX)
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
  @Type(() => Number)
  @Min(0)
  @Max(1)
  rubricScore?: number;

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;
}
