import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('config')
  config() {
    return { available: this.push.isAvailable(), publicKey: this.push.getPublicKey() ?? null };
  }

  @Post('subscriptions')
  async subscribe(
    @Body() dto: SubscribePushDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.push.subscribe(user.id, dto, req.headers['user-agent']);
    return { ok: true };
  }

  @Delete('subscriptions')
  async unsubscribe(@Body() dto: UnsubscribePushDto, @CurrentUser() user: AuthenticatedUser) {
    await this.push.unsubscribe(user.id, dto.endpoint);
    return { ok: true };
  }
}
