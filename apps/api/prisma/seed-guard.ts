// MOM-174: stop the seed from creating a publicly-known login on a real database.
//
// The failure mode this exists to prevent, in order:
//   1. `render.yaml` sets ALLOW_MULTI_USER_REGISTRATION=false, so AuthService
//      closes registration as soon as one user exists.
//   2. `auth.controller.ts` has register/login/logout/me and nothing else —
//      there is no password reset and no recovery path of any kind.
//   3. The deploy runbook seeds production by hand from a laptop. Forget to set
//      SEED_USER_EMAIL / SEED_USER_PASSWORD and the only account on the instance
//      is demo@momito.local with a password committed to a public repo.
//
// At that point the deployment is both unusable by its owner and open to anyone
// who reads the source. So: defaults are fine locally, refused anywhere else.
//
// NODE_ENV is deliberately not the primary signal. The seed runs from a
// developer machine (where NODE_ENV is unset) pointed at a remote DATABASE_URL,
// so "is the target local" is the question that actually matters.

export const DEFAULT_SEED_EMAIL = 'demo@momito.local';
export const DEFAULT_SEED_PASSWORD = 'MomitoDemo123!';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal', 'postgres', 'db']);

/**
 * Whether `databaseUrl` points at a database on this machine. Unparseable or
 * absent URLs are treated as remote: this guard fails closed.
 */
export function isLocalDatabase(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

export interface SeedCredentials {
  email: string;
  password: string;
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
}

/**
 * Throws when the built-in demo credentials would be written to anything other
 * than a local development database.
 */
export function assertSeedCredentialsSafe({ email, password, databaseUrl, nodeEnv }: SeedCredentials): void {
  const usingDefaults = email === DEFAULT_SEED_EMAIL || password === DEFAULT_SEED_PASSWORD;
  if (!usingDefaults) return;

  const isProduction = nodeEnv === 'production';
  if (!isProduction && isLocalDatabase(databaseUrl)) return;

  const reason = isProduction
    ? 'NODE_ENV is "production"'
    : `DATABASE_URL does not point at a local database (${describeTarget(databaseUrl)})`;

  throw new Error(
    [
      'Refusing to seed: the built-in demo credentials would be written to a real database.',
      '',
      `  Reason: ${reason}.`,
      `  Default email:    ${DEFAULT_SEED_EMAIL}`,
      '  Default password: committed to this repository in prisma/seed-guard.ts',
      '',
      'This instance has no password reset and closes registration after the first',
      'user, so seeding with the defaults would leave you locked out of an account',
      'anyone reading the source can sign into.',
      '',
      'Set both before re-running:',
      '  SEED_USER_EMAIL=you@example.com SEED_USER_PASSWORD=<a real password> pnpm db:seed',
    ].join('\n'),
  );
}

function describeTarget(databaseUrl: string | undefined): string {
  if (!databaseUrl) return 'DATABASE_URL is not set';
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return 'unparseable URL';
  }
}
