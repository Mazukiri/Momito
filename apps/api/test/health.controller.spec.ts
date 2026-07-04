import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HealthController', () => {
  it('returns ok status with uptime and timestamp', () => {
    const controller = new HealthController({} as PrismaService);
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });

  it('reports database up when the ping succeeds', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    const result = await controller.checkDb();

    expect(result).toEqual(expect.objectContaining({ status: 'ok', database: 'up' }));
  });

  it('throws ServiceUnavailableException when the ping fails', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.checkDb()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
