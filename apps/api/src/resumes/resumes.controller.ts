import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateResumeVersionDto } from './dto/create-resume-version.dto';
import { UpdateResumeVersionDto } from './dto/update-resume-version.dto';
import { ResumesService } from './resumes.service';

@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.resumes.list(user.id);
  }

  @Post()
  create(@Body() dto: CreateResumeVersionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resumes.create(dto, user.id);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.resumes.get(id, user.id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResumeVersionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resumes.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.resumes.remove(id, user.id);
  }
}
