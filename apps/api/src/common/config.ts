const DEVELOPMENT_JWT_SECRET = 'development-only-secret-change-me';
const MINIMUM_PRODUCTION_JWT_SECRET_LENGTH = 32;

type Environment = Partial<Record<'NODE_ENV' | 'JWT_SECRET' | 'CORS_ORIGIN', string | undefined>>;

export function getJwtSecret(environment: Environment = process.env): string {
  const secret = environment.JWT_SECRET?.trim();

  if (environment.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('JWT_SECRET is required when NODE_ENV=production.');
    }

    if (secret.length < MINIMUM_PRODUCTION_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MINIMUM_PRODUCTION_JWT_SECRET_LENGTH} characters in production.`,
      );
    }
  }

  return secret || DEVELOPMENT_JWT_SECRET;
}

export function getCorsOrigin(environment: Environment = process.env): boolean | string[] {
  const origins = environment.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins?.length) {
    return origins;
  }

  return environment.NODE_ENV === 'production' ? false : true;
}
