import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { AttemptsService } from './attempts.service';
import { CreateAttemptDto } from './dto/create-attempt.dto';
import { ListAttemptsDto } from './dto/list-attempts.dto';
import { UpdateAttemptDto } from './dto/update-attempt.dto';

@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('attempts') list(@Query() query: ListAttemptsDto, @CurrentUser() user: AuthenticatedUser) { return this.attempts.list(query, user.id); }
  @Get('attempts/:id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.attempts.get(id, user.id); }
  @Get('questions/:id/attempts') forQuestion(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListAttemptsDto, @CurrentUser() user: AuthenticatedUser) { return this.attempts.list(query, user.id, id); }
  // Standalone attempt (Today inline recall) — sessionless by design.
  @Post('attempts') create(@Body() dto: CreateAttemptDto, @CurrentUser() user: AuthenticatedUser) { return this.attempts.create(dto, user.id); }
  // Post-reveal rate/reflect (plan §7.2 attempt lifecycle).
  @Patch('attempts/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttemptDto, @CurrentUser() user: AuthenticatedUser) { return this.attempts.update(id, dto, user.id); }
}
