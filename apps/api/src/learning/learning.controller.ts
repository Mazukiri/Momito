import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { ConnectReadwiseDto } from './dto/connect-readwise.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { LearningService } from './learning.service';

@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('integrations/readwise')
  readwiseConnection(@CurrentUser() user: AuthenticatedUser) {
    return this.learning.getReadwiseConnection(user.id);
  }

  @Post('integrations/readwise/connect')
  connectReadwise(@Body() dto: ConnectReadwiseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.learning.connectReadwise(dto, user.id);
  }

  @Post('integrations/readwise/sync')
  syncReadwise(@CurrentUser() user: AuthenticatedUser) {
    return this.learning.syncReadwise(user.id);
  }

  @Get('learning/inbox')
  inbox(@CurrentUser() user: AuthenticatedUser) {
    return this.learning.inbox(user.id);
  }

  @Patch('learning/highlights/:id')
  updateHighlight(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHighlightDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learning.updateHighlight(id, dto, user.id);
  }

  @Get('learning/ledger')
  ledger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('roleTrackId') roleTrackId?: string,
    @Query('area') area?: string,
    @Query('missionId') missionId?: string,
  ) {
    return this.learning.ledger(user.id, roleTrackId, area, missionId);
  }

  @Post('learning/evidence')
  createEvidence(@Body() dto: CreateEvidenceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.learning.createEvidence(dto, user.id);
  }
}
