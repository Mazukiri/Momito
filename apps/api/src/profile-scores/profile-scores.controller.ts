import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { AtsCoverageDto } from './dto/ats-coverage.dto';
import { CreateProfileScoreDto } from './dto/create-profile-score.dto';
import { ProfileScoresService } from './profile-scores.service';

@Controller('profile-scores')
export class ProfileScoresController {
  constructor(private readonly profileScores: ProfileScoresService) {}

  @Post()
  create(@Body() dto: CreateProfileScoreDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profileScores.create(dto, user.id);
  }

  @Post('ats-coverage')
  atsCoverage(@Body() dto: AtsCoverageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profileScores.atsCoverage(dto.jdText, user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.profileScores.list(user.id);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.profileScores.get(id, user.id);
  }

  @Post(':id/generate-tasks')
  generateTasks(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.profileScores.generateTasks(id, user.id);
  }
}
