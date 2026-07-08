import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateInterviewRoundDto } from './dto/create-interview-round.dto';
import { UpdateInterviewRoundDto } from './dto/update-interview-round.dto';
import { InterviewRoundsService } from './interview-rounds.service';

// Rounds are children of a JobApplication — nested under /jobs/:jobId/rounds so
// ownership flows through the parent job. The extra path segment keeps these
// clear of the jobs controller's /jobs/:id param routes.
@Controller('jobs/:jobId/rounds')
export class InterviewRoundsController {
  constructor(private readonly rounds: InterviewRoundsService) {}

  @Get()
  list(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rounds.listForJob(jobId, user.id);
  }

  @Post()
  create(@Param('jobId', ParseUUIDPipe) jobId: string, @Body() dto: CreateInterviewRoundDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rounds.create(jobId, dto, user.id);
  }

  @Patch(':roundId')
  update(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: UpdateInterviewRoundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rounds.update(jobId, roundId, dto, user.id);
  }

  @Delete(':roundId')
  remove(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rounds.remove(jobId, roundId, user.id);
  }
}
