import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { AttemptsService } from './attempts.service';
import { ListAttemptsDto } from './dto/list-attempts.dto';

@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('attempts') list(@Query() query: ListAttemptsDto, @CurrentUser() user: AuthenticatedUser) { return this.attempts.list(query, user.id); }
  @Get('attempts/:id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.attempts.get(id, user.id); }
  @Get('questions/:id/attempts') forQuestion(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListAttemptsDto, @CurrentUser() user: AuthenticatedUser) { return this.attempts.list(query, user.id, id); }
}
