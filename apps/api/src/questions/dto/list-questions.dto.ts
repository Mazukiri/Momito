import { QUESTION_DIFFICULTIES, QUESTION_TYPES } from '@momito/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListQuestionsDto {
  @IsOptional() @IsUUID() topic?: string;
  @IsOptional() @IsIn(QUESTION_DIFFICULTIES) difficulty?: string;
  @IsOptional() @IsIn(QUESTION_TYPES) type?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
