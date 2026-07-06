import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

interface JwtPayload extends AuthenticatedUser {
  tv: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // A stateless 30-day JWT (see JWT_EXPIRES_IN in common/config.ts) has no
    // way to be revoked before it naturally expires unless we check something
    // server-side — this is that check. Logout bumps User.tokenVersion, so
    // every token issued before the bump fails here immediately rather than
    // staying valid for up to 30 more days.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Session has been revoked');
    }

    request.user = { id: payload.id, email: payload.email, role: payload.role };
    return true;
  }
}
