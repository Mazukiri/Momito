import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateStoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) situation?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) task?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) action?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) result?: string;
  @IsOptional() @IsString() @MaxLength(1000) metrics?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(120, { each: true }) competencyTags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(300, { each: true }) followUpQuestions?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) companyIds?: string[];
}
