import { IsEmail, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { CONTACT_RELATIONSHIPS, ContactRelationship } from '@momito/shared';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

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

  // `null` detaches the contact from its job (keeps the contact).
  @IsOptional()
  @IsUUID()
  jobApplicationId?: string | null;
}
