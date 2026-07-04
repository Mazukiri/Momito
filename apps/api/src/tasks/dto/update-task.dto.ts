import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  CAREER_ROLE_AREA_IDS,
  CAREER_ROLE_TRACK_IDS,
  CareerRoleAreaId,
  CareerRoleTrackId,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@momito/shared';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsIn(TASK_TYPES)
  type?: TaskType;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsIn(CAREER_ROLE_TRACK_IDS)
  roleTrackId?: CareerRoleTrackId | null;

  @IsOptional()
  @IsIn(CAREER_ROLE_AREA_IDS)
  area?: CareerRoleAreaId | null;

  @IsOptional()
  @IsUUID()
  topicId?: string | null;

  @IsOptional()
  @IsUUID()
  jobApplicationId?: string | null;

  @IsOptional()
  @IsUUID()
  missionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plannedFor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  recurrence?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60 * 24 * 30)
  reminderOffsetMinutes?: number | null;
}
