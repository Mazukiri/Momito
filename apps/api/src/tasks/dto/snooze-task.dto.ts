import { IsString, MaxLength } from 'class-validator';

export class SnoozeTaskDto {
  @IsString()
  @MaxLength(40)
  snoozedUntil!: string;
}
