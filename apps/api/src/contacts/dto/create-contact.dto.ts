import { IsEmail, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { CONTACT_RELATIONSHIPS, ContactRelationship } from '@momito/shared';

export class CreateContactDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  linkedinUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string | null;

  @IsOptional()
  @IsIn(CONTACT_RELATIONSHIPS)
  relationship?: ContactRelationship | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  // Only honored on the standalone POST /contacts route (the nested route takes
  // the job id from the path).
  @IsOptional()
  @IsUUID()
  jobApplicationId?: string | null;
}
