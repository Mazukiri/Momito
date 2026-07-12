import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { WeaknessesService } from './weaknesses.service';

@Controller()
export class WeaknessesController {
  constructor(private readonly weaknesses: WeaknessesService) {}

  @Get('weaknesses') summary(@CurrentUser() user: AuthenticatedUser) {
    return this.weaknesses.summary(user.id);
  }

  // MOM-127: act on a persisted signal surfaced in summary.openSignals. Resolve
  // = "I've repaired this"; dismiss = "not a real weakness / stop showing it".
  @Post('weaknesses/signals/:id/resolve')
  resolveSignal(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.weaknesses.resolveSignal(id, user.id);
  }

  @Post('weaknesses/signals/:id/dismiss')
  dismissSignal(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.weaknesses.dismissSignal(id, user.id);
  }
}
