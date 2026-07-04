import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProfileExperienceItemDto {
  @IsString()
  @MaxLength(200)
  company!: string;

  @IsString()
  @MaxLength(200)
  role!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(80)
  years!: number;

  @IsString()
  @MaxLength(80)
  tier!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;
}

export class ProfileEducationItemDto {
  @IsString()
  @MaxLength(200)
  degree!: string;

  @IsString()
  @MaxLength(200)
  institution!: string;

  @IsString()
  @MaxLength(120)
  country!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number | null;
}

export class ProfileProjectItemDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string | null;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MaxLength(120)
  type!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  githubStars!: number;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  githubUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkedinUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileExperienceItemDto)
  experience?: ProfileExperienceItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileEducationItemDto)
  education?: ProfileEducationItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileProjectItemDto)
  projects?: ProfileProjectItemDto[];
}
