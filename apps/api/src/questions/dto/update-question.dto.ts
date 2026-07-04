import { Type } from 'class-transformer';
import { CAREER_ROLE_AREA_IDS, CAREER_ROLE_TRACK_IDS, QUESTION_DIFFICULTIES, QUESTION_TYPES } from '@momito/shared';
import {
  IsArray,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateQuestionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MinLength(1) prompt?: string;
  @IsOptional() @IsIn(QUESTION_TYPES) type?: string;
  @IsOptional() @IsIn(QUESTION_DIFFICULTIES) difficulty?: string;
  @IsOptional() @IsUUID() topicId?: string;
  @IsOptional() @IsString() @MaxLength(150) subtopic?: string;
  @IsOptional() @IsString() referenceAnswer?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048) sourceUrl?: string;
  @IsOptional() @IsArray() @IsIn(CAREER_ROLE_TRACK_IDS, { each: true }) roleTags?: string[];
  @IsOptional() @IsArray() @IsIn(CAREER_ROLE_AREA_IDS, { each: true }) areaTags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(120, { each: true }) patternTags?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24 * 60) estimatedMinutes?: number;
  @IsOptional() @IsObject() rubric?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) importance?: number;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) companyIds?: string[];
}
