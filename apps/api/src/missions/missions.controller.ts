import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { CreateMissionDto } from './dto/create-mission.dto';
import { ReviewPlanDto } from './dto/review-plan.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { MissionsService } from './missions.service';

@Controller()
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get('missions')
  list(@CurrentUser() user: AuthenticatedUser, @Query('stage') stage?: string) {
    return this.missions.list(user.id, stage);
  }

  @Post('missions')
  create(@Body() dto: CreateMissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.create(dto, user.id);
  }

  @Post('missions/from-job/:jobId')
  createFromJob(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.createFromJob(jobId, user.id);
  }

  @Get('missions/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.get(id, user.id);
  }

  @Patch('missions/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.update(id, dto, user.id);
  }

  @Post('missions/:id/diagnose')
  diagnose(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.diagnose(id, user.id);
  }

  @Post('missions/:id/plans/generate')
  generatePlan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.generatePlan(id, user.id);
  }

  @Get('missions/:id/today')
  today(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.today(id, user.id);
  }

  @Post('missions/:id/check-ins')
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.missions.createCheckIn(id, dto, user.id);
  }

  @Post('plans/:id/review')
  reviewPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.missions.reviewPlan(id, dto, user.id);
  }
}
