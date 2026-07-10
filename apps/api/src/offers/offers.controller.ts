import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { UpsertOfferDto } from './dto/upsert-offer.dto';
import { OffersService } from './offers.service';

// MOM-114/115: an offer is a child of its job (at most one). The comparison list
// lives at /offers; the single per-job offer at /jobs/:jobId/offer.
@Controller()
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get('offers')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.offers.list(user.id);
  }

  @Get('jobs/:jobId/offer')
  getForJob(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.getForJob(jobId, user.id);
  }

  @Put('jobs/:jobId/offer')
  upsertForJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Body() dto: UpsertOfferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.upsertForJob(jobId, dto, user.id);
  }

  @Delete('jobs/:jobId/offer')
  removeForJob(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.removeForJob(jobId, user.id);
  }
}
