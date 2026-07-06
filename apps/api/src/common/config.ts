const DEVELOPMENT_JWT_SECRET = 'development-only-secret-change-me';
const MINIMUM_PRODUCTION_JWT_SECRET_LENGTH = 32;

const DEFAULT_JWT_EXPIRES_IN = '30d';
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';
const DEFAULT_AI_DAILY_BUDGET_USD = 1.0;

type Environment = Partial<
  Record<
    | 'NODE_ENV'
    | 'JWT_SECRET'
    | 'JWT_EXPIRES_IN'
    | 'CORS_ORIGIN'
    | 'ALLOW_MULTI_USER_REGISTRATION'
    | 'ANTHROPIC_API_KEY'
    | 'ANTHROPIC_MODEL'
    | 'AI_DAILY_BUDGET_USD',
    string | undefined
  >
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

// B1: was hardcoded to '24h' (never env-configurable), which meant a phone
// user studying daily got logged out every day instead of the intended
// long-lived single-user session — the localStorage-Bearer tradeoff (helmet
// CSP + no third-party scripts + registration lockdown) only makes sense
// alongside an actually-long expiry.
export function getJwtExpiresIn(environment: Environment = process.env): string {
  return environment.JWT_EXPIRES_IN?.trim() || DEFAULT_JWT_EXPIRES_IN;
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

// Workstream C: absence of a key means the AI grading feature reports itself
// unavailable rather than failing — Momito is fully usable on self-rating
// alone (docs/adr/0007-ai-grading-scaffold.md).
export function getAnthropicApiKey(environment: Environment = process.env): string | undefined {
  return environment.ANTHROPIC_API_KEY?.trim() || undefined;
}

export function getAnthropicModel(environment: Environment = process.env): string {
  return environment.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

export function getAiDailyBudgetUsd(environment: Environment = process.env): number {
  const parsed = Number(environment.AI_DAILY_BUDGET_USD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_DAILY_BUDGET_USD;
}

export function isAiGradingAvailable(environment: Environment = process.env): boolean {
  return Boolean(getAnthropicApiKey(environment));
}
