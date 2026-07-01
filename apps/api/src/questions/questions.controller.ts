import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get() list(@Query() query: ListQuestionsDto) { return this.questions.list(query); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.questions.get(id, user.id); }
  @Post() create(@Body() dto: CreateQuestionDto, @CurrentUser() user: AuthenticatedUser) { return this.questions.create(dto, user.id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuestionDto) { return this.questions.update(id, dto); }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) { return this.questions.remove(id); }
}
