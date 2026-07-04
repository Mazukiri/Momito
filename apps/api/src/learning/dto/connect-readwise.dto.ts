import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConnectReadwiseDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  token!: string;
}
