import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLE_TEMPLATE_IDS, RoleTemplateId } from '@momito/shared';

export class CreateProfileScoreDto {
  @IsIn(ROLE_TEMPLATE_IDS)
  role!: RoleTemplateId;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  jdText?: string | null;
}
