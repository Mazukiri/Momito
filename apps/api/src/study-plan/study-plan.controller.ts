import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateStudyPlanItemDto } from './dto/create-study-plan-item.dto';
import { ListStudyPlanDto } from './dto/list-study-plan.dto';
import { UpdateStudyPlanItemDto } from './dto/update-study-plan-item.dto';
import { StudyPlanService } from './study-plan.service';

@Controller('study-plan')
export class StudyPlanController {
  constructor(private readonly studyPlan: StudyPlanService) {}

  @Get() list(@Query() query: ListStudyPlanDto, @CurrentUser() user: AuthenticatedUser) { return this.studyPlan.list(query, user.id); }
  @Post() create(@Body() dto: CreateStudyPlanItemDto, @CurrentUser() user: AuthenticatedUser) { return this.studyPlan.create(dto, user.id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudyPlanItemDto, @CurrentUser() user: AuthenticatedUser) { return this.studyPlan.update(id, dto, user.id); }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.studyPlan.remove(id, user.id); }
}
