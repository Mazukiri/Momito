import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { CAREER_ROLE_AREA_IDS, CAREER_ROLE_TRACK_IDS, QUESTION_DIFFICULTIES, SESSION_TYPES } from '@momito/shared';

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
  @IsIn(CAREER_ROLE_TRACK_IDS)
  roleTrackId?: (typeof CAREER_ROLE_TRACK_IDS)[number];

  @IsOptional()
  @IsIn(CAREER_ROLE_AREA_IDS)
  area?: (typeof CAREER_ROLE_AREA_IDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pattern?: string;

  @IsOptional()
  @IsUUID()
  jobApplicationId?: string;

  @IsOptional()
  @IsUUID()
  missionId?: string;

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
