import { IsIn, IsOptional, IsString } from 'class-validator';
import { TASK_STATUSES, TASK_TYPES, TaskStatus, TaskType } from '@momito/shared';

export class ListTasksDto {
  @IsOptional()
  @IsIn(['all', 'today', 'week', 'overdue'])
  range?: 'all' | 'today' | 'week' | 'overdue';

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsIn(TASK_TYPES)
  type?: TaskType;

  @IsOptional()
  @IsString()
  roleTrackId?: string;

  @IsOptional()
  @IsString()
  missionId?: string;
}
