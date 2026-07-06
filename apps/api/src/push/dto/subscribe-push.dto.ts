import { Type } from 'class-transformer';
import { IsObject, IsString, IsUrl, ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class SubscribePushDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class UnsubscribePushDto {
  @IsString()
  endpoint!: string;
}
