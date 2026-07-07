import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MISS_TAG_REASONS, type MissTagReason } from '@momito/shared';

// Attempt lifecycle (plan §7.2) is Submit → Reveal reference → Reflect →
// Self-rate. The answer is therefore submitted *before* the user can honestly
// rate or tag what they missed — this PATCH carries the post-reveal half.
// answerText is deliberately not updatable: the attempt is a record of what
// was recalled before the reference was shown.
export class UpdateAttemptDto {
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
  @IsArray()
  @ArrayMaxSize(MISS_TAG_REASONS.length)
  @IsIn(MISS_TAG_REASONS, { each: true })
  missTags?: MissTagReason[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reflectionNote?: string;
}
