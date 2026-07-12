import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// MOM-153. Both fields are optional, but at least one must resolve to a JD:
//   jdText           — paste a JD that is not in the pipeline yet.
//   jobApplicationId — tailor against an application already tracked, reusing its stored jdText,
//                      its company's focus areas and its sponsorship posture. Omitted → the
//                      orchestrator falls back to the job this version is already linked to.
// Neither present and no linked job carrying a JD → {ok:false}, before any model call.
export class ResumeAiJdDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  jdText?: string;

  @IsOptional()
  @IsUUID()
  jobApplicationId?: string;
}
