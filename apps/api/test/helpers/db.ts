import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';

// MOM-178: the integration tier.
//
// Every one of the 40 spec files that existed before this one is a unit test
// with a hand-written Prisma mock (`new SomeService(prisma as never, …)`), and
// none of them touch a database. That is fine for branching logic and wrong for
// anything whose correctness lives in the query: ordering, `take`, cascade
// behaviour, and above all uniqueness constraints. A mock has no constraints,
// so `@@unique` — which is how the V2 daily-plan generator gets its idempotency
// — cannot be tested against one at all. CI already stands up Postgres, runs
// migrate deploy and seeds it; nothing read from it until now.
//
// SAFETY. These helpers TRUNCATE every table. They deliberately key off
// TEST_DATABASE_URL and never DATABASE_URL, because DATABASE_URL on a developer
// machine is the developer's real data — here it points at a live local
// Postgres with actual practice history in it. Wiping that to run a test would
// be an unforgivable way to find out about this design. Absent the variable the
// integration tier skips rather than falls back.

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** True when an integration database has been explicitly provided. */
export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

/**
 * `describe` for the integration tier: runs when TEST_DATABASE_URL is set,
 * skips otherwise so `pnpm test` still works on a machine with no Postgres.
 */
// Annotated rather than inferred: vitest's own suite types are not nameable
// through pnpm's strict node_modules, and the narrow signature is all a caller
// needs anyway.
export const describeIntegration: (name: string, fn: () => void) => void = hasTestDatabase
  ? describe
  : describe.skip;

let client: PrismaService | undefined;

// A real PrismaService, not a PrismaClient: services are typed against the
// former, and constructing the actual class means the integration tier wires up
// exactly what Nest would rather than something cast into place.
export function testPrisma(): PrismaService {
  if (!TEST_DATABASE_URL) {
    throw new Error('testPrisma() requires TEST_DATABASE_URL — guard the suite with describeIntegration.');
  }
  assertNotTheDevDatabase();
  client ??= new PrismaService({ datasources: { db: { url: TEST_DATABASE_URL } } });
  return client;
}

// Second belt: even with TEST_DATABASE_URL set, refuse if it is literally the
// same database the app develops against. Cheap to check, and the failure it
// prevents is unrecoverable.
function assertNotTheDevDatabase(): void {
  const dev = process.env.DATABASE_URL;
  if (dev && TEST_DATABASE_URL === dev) {
    throw new Error(
      'TEST_DATABASE_URL is identical to DATABASE_URL. The integration tier truncates every table; point it at a scratch database.',
    );
  }
}

/**
 * Empty every table between tests. TRUNCATE ... CASCADE rather than per-model
 * deleteMany: order-independent, so it cannot break when a relation is added,
 * and fast enough that per-test isolation stays affordable.
 */
export async function resetDatabase(): Promise<void> {
  const prisma = testPrisma();
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnectTestDatabase(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

/** A persisted user, since almost everything is scoped by one. */
export async function createUser(overrides: Partial<{ email: string; name: string }> = {}) {
  return testPrisma().user.create({
    data: {
      email: overrides.email ?? `test-${randomUUID()}@momito.local`,
      name: overrides.name ?? 'Integration User',
      passwordHash: 'not-a-real-hash',
    },
  });
}
