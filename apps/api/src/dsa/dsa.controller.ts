import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { DsaService } from './dsa.service';

@Controller('dsa')
export class DsaController {
  constructor(private readonly dsa: DsaService) {}

  @Get('progress')
  progress(@CurrentUser() user: AuthenticatedUser) {
    return this.dsa.progress(user.id);
  }
}
