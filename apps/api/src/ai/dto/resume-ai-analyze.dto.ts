import { IsOptional, IsUUID } from 'class-validator';

// MOM-149. Optional: analyse this version *against a specific application*, so the critique is
// judged relative to that JD and that company's focus areas. Omitted → the orchestrator falls
// back to the job the version is already linked to, then to a generic target-role critique.
export class ResumeAiAnalyzeDto {
  @IsOptional()
  @IsUUID()
  jobApplicationId?: string;
}
