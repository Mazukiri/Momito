import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { rethrowDeleteConstraint } from '../src/common/prisma-errors';

describe('rethrowDeleteConstraint', () => {
  it('maps P2003 to ConflictException', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '6.19.0',
    });
    expect(() => rethrowDeleteConstraint(error, 'Cannot delete')).toThrow(ConflictException);
  });

  it('preserves unrelated errors', () => {
    const error = new Error('database unavailable');
    expect(() => rethrowDeleteConstraint(error, 'Cannot delete')).toThrow(error);
  });
});
