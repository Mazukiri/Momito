import { ForbiddenException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService', () => {
  it('rejects registration once an account already exists (single-user lock)', async () => {
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn(),
      },
    };
    const service = new AuthService(prisma as never, {} as never);

    await expect(
      service.register({ email: 'second@example.com', password: 'secure-pass', name: 'Second' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });


  it('normalizes registration data and returns a signed access token', async () => {
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(({ data }) => ({
          id: 'user-1',
          email: data.email,
          name: data.name,
          role: 'user',
        })),
      },
    };
    const jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };
    const service = new AuthService(prisma as never, jwt as never);

    const result = await service.register({
      email: '  Student@Example.com ',
      password: 'secure-pass',
      name: ' Student ',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'student@example.com', name: 'Student' }),
      }),
    );
    expect(result.accessToken).toBe('signed-token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('logs in with normalized email and excludes the password hash', async () => {
    const user = {
      id: 'user-1',
      email: 'student@example.com',
      name: 'Student',
      role: 'user',
      passwordHash: await hash('secure-pass', 4),
    };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(user) } };
    const jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };
    const service = new AuthService(prisma as never, jwt as never);

    const result = await service.login({
      email: ' Student@Example.com ',
      password: 'secure-pass',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'student@example.com' },
    });
    expect(result).toEqual({
      user: { id: 'user-1', email: 'student@example.com', name: 'Student', role: 'user' },
      accessToken: 'signed-token',
    });
  });

  it('bumps tokenVersion on logout to revoke every previously issued token', async () => {
    const update = vi.fn().mockResolvedValue({});
    const service = new AuthService({ user: { update } } as never, {} as never);

    await service.logout('user-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it('loads the current user through the public field selection', async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: 'user-1' });
    const service = new AuthService({ user: { findUniqueOrThrow } } as never, {} as never);

    await service.me('user-1');

    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  });
});
