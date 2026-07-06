import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../src/common/jwt-auth.guard';

function makeContext(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext & { __request: typeof request };
}

describe('JwtAuthGuard', () => {
  it('allows a @Public() route through without checking a token', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new JwtAuthGuard({} as never, reflector, {} as never);

    await expect(guard.canActivate(makeContext({}))).resolves.toBe(true);
  });

  it('rejects a request with no bearer token', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new JwtAuthGuard({} as never, reflector, {} as never);

    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid/expired token', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwt = { verifyAsync: vi.fn().mockRejectedValue(new Error('bad token')) };
    const guard = new JwtAuthGuard(jwt as never, reflector, {} as never);

    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer bad-token' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token whose tv claim matches the user current tokenVersion', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', role: 'user', tv: 2 }),
    };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ tokenVersion: 2 }) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);
    const context = makeContext({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a token whose tv claim no longer matches (revoked by logout)', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', role: 'user', tv: 1 }),
    };
    // User logged out since this token was issued — tokenVersion has moved to 2.
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ tokenVersion: 2 }) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);
    const context = makeContext({ authorization: 'Bearer stale-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token for a user that no longer exists', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ id: 'deleted-user', email: 'a@b.com', role: 'user', tv: 0 }),
    };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);

    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer token' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
