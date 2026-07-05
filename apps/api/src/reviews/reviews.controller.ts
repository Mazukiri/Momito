import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { RecordReviewDto } from './dto/record-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('due')
  listDue(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.listDue(user.id);
  }

  @Post(':objectType/:objectId')
  record(
    @Param('objectType') objectType: string,
    @Param('objectId', ParseUUIDPipe) objectId: string,
    @Body() dto: RecordReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviews.record(user.id, objectType, objectId, dto.selfRating);
  }
}
