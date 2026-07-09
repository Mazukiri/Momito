import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CareerRoleTrackId } from '@momito/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CareerService } from './career.service';
import { UpsertCareerGoalDto } from './dto/upsert-career-goal.dto';

@Controller('career')
export class CareerController {
  constructor(private readonly career: CareerService) {}

  @Get('role-tracks')
  listRoleTracks() {
    return this.career.listRoleTracks();
  }

  @Get('goals')
  listGoals(@CurrentUser() user: AuthenticatedUser) {
    return this.career.listGoals(user.id);
  }

  @Post('goals')
  upsertGoal(@Body() dto: UpsertCareerGoalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.career.upsertGoal(dto, user.id);
  }

  @Patch('goals/:id')
  updateGoal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertCareerGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.career.updateGoal(id, dto, user.id);
  }

  @Get('role-tracks/:id/readiness')
  readiness(@Param('id') id: CareerRoleTrackId, @CurrentUser() user: AuthenticatedUser) {
    return this.career.getReadiness(id, user.id);
  }

  @Get('readiness')
  activeReadiness(@CurrentUser() user: AuthenticatedUser) {
    return this.career.listActiveReadiness(user.id);
  }

  // MOM-130: "am I ready for <company>?" for a specific application.
  @Get('jobs/:jobId/readiness')
  jobReadiness(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.career.getJobReadiness(jobId, user.id);
  }

  // MOM-131: this target's behavioral story gap map.
  @Get('jobs/:jobId/story-gaps')
  jobStoryGaps(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.career.getJobStoryGaps(jobId, user.id);
  }
}
