import { QUESTION_DIFFICULTIES, QUESTION_TYPES } from '@momito/shared';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateQuestionDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MinLength(1) prompt!: string;
  @IsIn(QUESTION_TYPES) type!: string;
  @IsIn(QUESTION_DIFFICULTIES) difficulty!: string;
  @IsUUID() topicId!: string;
  @IsOptional() @IsString() @MaxLength(150) subtopic?: string;
  @IsOptional() @IsString() referenceAnswer?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048) sourceUrl?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) companyIds?: string[];
}
