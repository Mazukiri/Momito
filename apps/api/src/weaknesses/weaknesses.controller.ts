import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { WeaknessesService } from './weaknesses.service';

@Controller()
export class WeaknessesController {
  constructor(private readonly weaknesses: WeaknessesService) {}

  @Get('weaknesses') summary(@CurrentUser() user: AuthenticatedUser) {
    return this.weaknesses.summary(user.id);
  }
}
