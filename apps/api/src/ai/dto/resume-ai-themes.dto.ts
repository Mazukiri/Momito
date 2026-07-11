import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

// MOM-151. The themes come back from an analysis the user just ran; this turns them into study
// tasks. Bounded so a malformed client can't create an unbounded number of tasks.
export class ResumeAiThemesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(160, { each: true })
  themes!: string[];
}
