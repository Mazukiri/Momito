import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsDto } from './dto/list-sessions.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post() create(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthenticatedUser) { return this.sessions.create(dto, user.id); }
  @Get() list(@Query() query: ListSessionsDto, @CurrentUser() user: AuthenticatedUser) { return this.sessions.list(query, user.id); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.sessions.get(id, user.id); }
  @Post(':id/answer') answer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAnswerDto, @CurrentUser() user: AuthenticatedUser) { return this.sessions.answer(id, dto, user.id); }
  @Post(':id/complete') @HttpCode(200) complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.sessions.complete(id, user.id); }
  @Post(':id/abandon') @HttpCode(200) abandon(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.sessions.abandon(id, user.id); }
}
