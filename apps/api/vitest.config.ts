import { defineConfig } from 'vitest/config';

// MOM-178: apps/api had no vitest config at all — `vitest run` on bare defaults,
// which also meant test/helpers/*.ts would be collected as suites once helpers
// existed. Two tiers now share this config:
//
//   *.spec.ts      unit, hand-mocked Prisma, no database, runs everywhere
//   *.int.spec.ts  integration, real Postgres via TEST_DATABASE_URL
//
// The integration tier self-skips when TEST_DATABASE_URL is unset (see
// test/helpers/db.ts), so `pnpm test` stays green on a machine with no
// Postgres running and CI opts in by setting the variable.
export default defineConfig({
  test: {
    // Explicit, so helpers and fixtures can live under test/ without being
    // mistaken for suites.
    include: ['test/**/*.spec.ts'],
    // The integration tier truncates shared tables, so its files must not run
    // concurrently with each other. Unit files are pure and unaffected.
    fileParallelism: false,
    // A cold Neon/Postgres connection can take a few seconds on the first test.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
