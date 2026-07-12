import { IsIn, IsOptional, IsString, IsUrl, IsUUID, Matches, MaxLength } from 'class-validator';
import {
  CAREER_ROLE_TRACK_IDS,
  CareerRoleTrackId,
  JOB_APPLICATION_SOURCES,
  JOB_APPLICATION_STATUSES,
  JobApplicationSource,
  JobApplicationStatus,
  REJECTION_REASONS,
  RejectionReason,
  VISA_TAGS,
  VisaTag,
} from '@momito/shared';

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  // MOM-122: link/unlink the catalog company. `null` unlinks (keeps free text).
  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  roleTitle?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsIn(JOB_APPLICATION_STATUSES)
  status?: JobApplicationStatus;

  @IsOptional()
  @IsIn(CAREER_ROLE_TRACK_IDS)
  roleTrackId?: CareerRoleTrackId | null;

  @IsOptional()
  @IsString()
  @MaxLength(30000)
  jdText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  appliedDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline?: string | null;

  @IsOptional()
  @IsIn(JOB_APPLICATION_SOURCES)
  source?: JobApplicationSource | null;

  // MOM-164: referralName/h1bCountLastYear/compensationNotes removed — write-only, no UI. Columns stay.

  @IsOptional()
  @IsIn(VISA_TAGS)
  visaTag?: VisaTag | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  // MOM-106: the service enforces this is only accepted when the resulting status
  // is 'rejected', and clears it if the app is moved back out of rejected.
  @IsOptional()
  @IsIn(REJECTION_REASONS)
  rejectionReason?: RejectionReason | null;
}
