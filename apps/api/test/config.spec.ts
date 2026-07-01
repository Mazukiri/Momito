import { describe, expect, it } from 'vitest';
import { getCorsOrigin, getJwtSecret } from '../src/common/config';

describe('application config', () => {
  it('keeps the development JWT fallback for easy local setup', () => {
    expect(getJwtSecret({ NODE_ENV: 'development' })).toBe(
      'development-only-secret-change-me',
    );
  });

  it('requires a sufficiently long JWT secret in production', () => {
    expect(() => getJwtSecret({ NODE_ENV: 'production' })).toThrow(
      'JWT_SECRET is required when NODE_ENV=production.',
    );
    expect(() =>
      getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }),
    ).toThrow('JWT_SECRET must be at least 32 characters in production.');
  });

  it('accepts a production JWT secret with at least 32 characters', () => {
    const secret = 'a-production-secret-with-32-chars';

    expect(getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret })).toBe(secret);
  });

  it('parses a comma-separated CORS allowlist', () => {
    expect(
      getCorsOrigin({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://momito.example, https://admin.momito.example ',
      }),
    ).toEqual(['https://momito.example', 'https://admin.momito.example']);
  });

  it('allows local development but disables cross-origin requests by default in production', () => {
    expect(getCorsOrigin({ NODE_ENV: 'development' })).toBe(true);
    expect(getCorsOrigin({ NODE_ENV: 'production' })).toBe(false);
  });
});
