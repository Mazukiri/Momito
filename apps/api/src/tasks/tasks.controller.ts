import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { SnoozeTaskDto } from './dto/snooze-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('tasks')
  list(@Query() query: ListTasksDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasks.list(query, user.id);
  }

  @Post('tasks')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasks.create(dto, user.id);
  }

  @Patch('tasks/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasks.update(id, dto, user.id);
  }

  @Post('tasks/:id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tasks.complete(id, user.id);
  }

  @Post('tasks/:id/snooze')
  snooze(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SnoozeTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasks.snooze(id, dto, user.id);
  }

  @Get('reminders')
  reminders(@CurrentUser() user: AuthenticatedUser) {
    return this.tasks.listReminders(user.id);
  }

  @Post('reminders/:id/dismiss')
  dismissReminder(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tasks.dismissReminder(id, user.id);
  }
}
