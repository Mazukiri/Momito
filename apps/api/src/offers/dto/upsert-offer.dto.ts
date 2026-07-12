import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { OFFER_STATUSES, OfferStatus } from '@momito/shared';

export class UpsertOfferDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  baseSalary?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  bonus?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  equityTotal?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  equityYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsBoolean()
  visaSponsored?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsIn(OFFER_STATUSES)
  status?: OfferStatus;
}
