import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { getJwtExpiresIn, getJwtSecret } from '../common/config';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      // @nestjs/jwt's expiresIn type is `ms`'s narrow literal-template union
      // (e.g. '30d'), which an env-driven runtime string can't satisfy
      // structurally — the format is validated by `ms` itself at runtime.
      signOptions: { expiresIn: getJwtExpiresIn() as never },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
