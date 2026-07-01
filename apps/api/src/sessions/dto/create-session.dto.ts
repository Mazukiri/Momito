import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { QUESTION_DIFFICULTIES, SESSION_TYPES } from '@momito/shared';

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsIn(SESSION_TYPES)
  sessionType!: (typeof SESSION_TYPES)[number];

  @IsOptional()
  @IsUUID()
  topicId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsIn(QUESTION_DIFFICULTIES)
  difficulty?: (typeof QUESTION_DIFFICULTIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  questionIds?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  questionCount!: number;
}
