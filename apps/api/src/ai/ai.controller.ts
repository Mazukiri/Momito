import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { AiService } from './ai.service';

@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('ai/usage') usage(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.usage(user.id);
  }

  @Post('attempts/:id/grade')
  grade(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ai.gradeAttempt(id, user.id, force === 'true');
  }
}
