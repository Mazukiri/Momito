import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
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

  // MOM-139: download a version as .md or .pdf. Static-suffix route declared
  // before :id so `:id/export` never shadows the plain `:id` GET.
  @Get(':id/export')
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format = 'md',
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.resumes.export(id, user.id, format);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    });
    return new StreamableFile(file.body);
  }

  // MOM-155: what the profile has gained since this version was cut. Static suffix, so it is
  // declared before the plain `:id` GET for the same reason `:id/export` is.
  @Get(':id/drift')
  drift(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.resumes.drift(id, user.id);
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
