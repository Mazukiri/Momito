import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';

@Controller('practice/recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.recommendations.list(user.id);
  }
}
