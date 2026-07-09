import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CompanyFocusAreas, CompanyInterviewStage, CareerRoleTrackId, VISA_TAGS, VisaTag } from '@momito/shared';
import { IsFocusAreas, IsInterviewProcess, IsRoleTrackIds } from './company-intelligence.validator';

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsFocusAreas() focusAreas?: CompanyFocusAreas;
  @IsOptional() @IsRoleTrackIds() roleTrackIds?: CareerRoleTrackId[];
  @IsOptional() @IsInterviewProcess() interviewProcess?: CompanyInterviewStage[];
  @IsOptional() @IsIn(VISA_TAGS) sponsorshipStatus?: VisaTag;
  @IsOptional() @IsString() @MaxLength(200) compBand?: string;
}
