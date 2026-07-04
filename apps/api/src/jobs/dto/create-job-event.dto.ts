import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobEventDto {
  @IsString()
  @MaxLength(80)
  type!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  eventAt?: string | null;
}
