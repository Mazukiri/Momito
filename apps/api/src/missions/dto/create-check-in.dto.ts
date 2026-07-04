import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCheckInDto {
  @IsString()
  @MaxLength(500)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  wins?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  blockers?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adjustments?: string | null;
}
