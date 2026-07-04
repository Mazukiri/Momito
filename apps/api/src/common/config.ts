const DEVELOPMENT_JWT_SECRET = 'development-only-secret-change-me';
const MINIMUM_PRODUCTION_JWT_SECRET_LENGTH = 32;

type Environment = Partial<
  Record<'NODE_ENV' | 'JWT_SECRET' | 'CORS_ORIGIN' | 'ALLOW_MULTI_USER_REGISTRATION', string | undefined>
>;

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

// MOM-018: Momito is built as a single-user personal tool exposed on the public
// internet (see the "personal tool, not SaaS" product doctrine), not multi-tenant
// SaaS. By default, once one account exists, further registrations are refused so a
// deployed instance can't be silently taken over by a stranger who finds the URL.
// Set ALLOW_MULTI_USER_REGISTRATION=true to opt into open registration.
export function isMultiUserRegistrationAllowed(environment: Environment = process.env): boolean {
  return environment.ALLOW_MULTI_USER_REGISTRATION === 'true';
}
