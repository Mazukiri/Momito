import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { isMultiUserRegistrationAllowed } from '../common/config';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const publicUserSelect = { id: true, email: true, name: true, role: true } as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    if (!isMultiUserRegistrationAllowed()) {
      const existingUserCount = await this.prisma.user.count();
      if (existingUserCount > 0) {
        throw new ForbiddenException('Registration is closed for this instance');
      }
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash: await hash(dto.password, 12),
          name: dto.name.trim(),
        },
        select: publicUserSelect,
      });
      return { user, accessToken: await this.sign({ ...user, tokenVersion: 0 }) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const publicUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    return { user: publicUser, accessToken: await this.sign(user) };
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ...publicUserSelect, createdAt: true },
    });
  }

  // Bumping tokenVersion invalidates every previously issued token for this
  // user immediately (JwtAuthGuard rejects any token whose `tv` claim no
  // longer matches) — turns what used to be a no-op into real revocation for
  // an otherwise stateless, 30-day-lived JWT.
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  private sign(user: { id: string; email: string; role: string; tokenVersion: number }) {
    return this.jwt.signAsync({ id: user.id, email: user.email, role: user.role, tv: user.tokenVersion });
  }
}
