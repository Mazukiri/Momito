import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateJobEventDto } from './dto/create-job-event.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.jobs.list(user.id, status);
  }

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.create(dto, user.id);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.get(id, user.id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.update(id, dto, user.id);
  }

  @Post(':id/events')
  addEvent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateJobEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.addEvent(id, dto, user.id);
  }

  @Post(':id/generate-prep')
  generatePrep(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.generatePrep(id, user.id);
  }

  @Post(':id/score-profile')
  scoreProfile(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.scoreProfile(id, user.id);
  }
}
