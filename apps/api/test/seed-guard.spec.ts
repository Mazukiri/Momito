import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEED_EMAIL,
  DEFAULT_SEED_PASSWORD,
  assertSeedCredentialsSafe,
  isLocalDatabase,
} from '../prisma/seed-guard';

const LOCAL_URL = 'postgresql://postgres:postgres@localhost:5432/momito?schema=public';
const NEON_URL = 'postgresql://user:pw@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/momito?sslmode=require';

function check(overrides: Partial<Parameters<typeof assertSeedCredentialsSafe>[0]> = {}) {
  return () =>
    assertSeedCredentialsSafe({
      email: DEFAULT_SEED_EMAIL,
      password: DEFAULT_SEED_PASSWORD,
      databaseUrl: LOCAL_URL,
      nodeEnv: 'development',
      ...overrides,
    });
}

describe('isLocalDatabase', () => {
  it('recognises the usual local hosts', () => {
    expect(isLocalDatabase(LOCAL_URL)).toBe(true);
    expect(isLocalDatabase('postgresql://u:p@127.0.0.1:5432/db')).toBe(true);
    expect(isLocalDatabase('postgresql://u:p@host.docker.internal:5432/db')).toBe(true);
    // docker-compose service name — how the API reaches Postgres in-network.
    expect(isLocalDatabase('postgresql://u:p@postgres:5432/db')).toBe(true);
  });

  it('treats a managed host as remote', () => {
    expect(isLocalDatabase(NEON_URL)).toBe(false);
  });

  // Fails closed: if we cannot tell where the data is going, assume it matters.
  it('treats absent or unparseable URLs as remote', () => {
    expect(isLocalDatabase(undefined)).toBe(false);
    expect(isLocalDatabase('')).toBe(false);
    expect(isLocalDatabase('not a url')).toBe(false);
  });
});

describe('assertSeedCredentialsSafe', () => {
  it('allows the demo defaults against a local database', () => {
    expect(check()).not.toThrow();
  });

  // The actual production accident: seeding Neon from a laptop, where NODE_ENV
  // is unset, having skipped the runbook step that sets the env vars.
  it('refuses the demo defaults against a remote database', () => {
    expect(check({ databaseUrl: NEON_URL })).toThrow(/Refusing to seed/);
    expect(check({ databaseUrl: NEON_URL })).toThrow(/neon\.tech/);
  });

  it('refuses the demo defaults when NODE_ENV is production, even on localhost', () => {
    expect(check({ nodeEnv: 'production' })).toThrow(/NODE_ENV is "production"/);
  });

  it('refuses when only the password is left at the default', () => {
    // A custom email does not help: the password is the part that is public.
    expect(check({ email: 'me@example.com', databaseUrl: NEON_URL })).toThrow(/Refusing to seed/);
  });

  it('refuses when only the email is left at the default', () => {
    expect(check({ password: 'a-real-password', databaseUrl: NEON_URL })).toThrow(/Refusing to seed/);
  });

  it('allows real credentials anywhere', () => {
    expect(
      check({ email: 'me@example.com', password: 'a-real-password', databaseUrl: NEON_URL, nodeEnv: 'production' }),
    ).not.toThrow();
  });

  it('explains how to fix it rather than just failing', () => {
    expect(check({ databaseUrl: NEON_URL })).toThrow(/SEED_USER_EMAIL=.*SEED_USER_PASSWORD=/s);
  });

  it('never puts the actual default password in the error message', () => {
    // The message is printed to a terminal and pasted into issues; pointing at
    // the file is enough.
    let message = '';
    try {
      check({ databaseUrl: NEON_URL })();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain(DEFAULT_SEED_PASSWORD);
  });
});
