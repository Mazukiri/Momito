import { IsString, MaxLength, MinLength } from 'class-validator';

export class AtsCoverageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  jdText!: string;
}
