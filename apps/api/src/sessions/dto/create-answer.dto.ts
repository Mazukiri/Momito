import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MISS_TAG_REASONS, type MissTagReason } from '@momito/shared';

export class CreateAnswerDto {
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
  @Type(() => Number)
  @Min(0)
  @Max(1)
  rubricScore?: number;

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  // MOM-028: reflection fields (D-003/D-004 human-approved migration).
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
