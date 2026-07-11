import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResumeAiJdDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  jdText!: string;
}
