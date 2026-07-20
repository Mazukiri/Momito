import { afterAll, afterEach, expect, it } from 'vitest';
import { WeaknessesService } from '../src/weaknesses/weaknesses.service';
import {
  createUser,
  describeIntegration,
  disconnectTestDatabase,
  resetDatabase,
  testPrisma,
} from './helpers/db';

// MOM-178: the first test in this codebase that reads from a real database.
//
// weaknesses.service.spec.ts already covers this service's branching with a
// mocked Prisma, and those tests are worth keeping. What they cannot cover is
// anything the database decides: whether recordSignal's service-layer upsert
// actually accrues onto the right row, whether status filters select what we
// think, and whether the ordering listOpenSignals promises survives a real
// ORDER BY over real rows. Each of those is asserted here against Postgres.
//
// This is the tier the V2 daily-plan generator will live in: its idempotency is
// a @@unique constraint, which has no meaning against a mock.
describeIntegration('WeaknessesService (real database)', () => {
  afterEach(resetDatabase);
  afterAll(disconnectTestDatabase);

  const service = () => new WeaknessesService(testPrisma());

  it('accrues a repeat signal onto the existing row instead of inserting a duplicate', async () => {
    const user = await createUser();
    const weaknesses = service();

    await weaknesses.recordSignal(user.id, {
      signalType: 'area',
      key: 'dsa',
      area: 'dsa',
      label: 'Data structures',
      source: 'attempt',
    });
    await weaknesses.recordSignal(user.id, {
      signalType: 'area',
      key: 'dsa',
      area: 'dsa',
      label: 'Data structures',
      source: 'attempt',
    });

    const rows = await testPrisma().weaknessSignal.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].occurrences).toBe(2);
  });

  it('opens a fresh row when the previous one was already resolved', async () => {
    // The comment at recordSignal says a resolved signal stays closed and a
    // recurrence opens a new row. That branch depends entirely on the status
    // filter matching real rows.
    const user = await createUser();
    const weaknesses = service();

    const first = await weaknesses.recordSignal(user.id, {
      signalType: 'area',
      key: 'dsa',
      area: 'dsa',
      label: 'Data structures',
      source: 'attempt',
    });
    await testPrisma().weaknessSignal.update({
      where: { id: first.id },
      data: { status: 'resolved' },
    });

    await weaknesses.recordSignal(user.id, {
      signalType: 'area',
      key: 'dsa',
      area: 'dsa',
      label: 'Data structures',
      source: 'attempt',
    });

    const rows = await testPrisma().weaknessSignal.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.status === 'resolved')).toHaveLength(1);
  });

  it('scopes signals to their owner', async () => {
    // Cross-user leakage is exactly the class of bug a mocked `where` cannot
    // catch: the mock returns whatever the test handed it.
    const [mine, theirs] = await Promise.all([createUser(), createUser()]);
    const weaknesses = service();

    await weaknesses.recordSignal(theirs.id, {
      signalType: 'area',
      key: 'system_design',
      area: 'system_design',
      label: 'System design',
      source: 'attempt',
    });

    expect(await weaknesses.listOpenSignals(mine.id)).toHaveLength(0);
    expect(await weaknesses.listOpenSignals(theirs.id)).toHaveLength(1);
  });

  it('closes the loop: two positive reps resolve an open signal', async () => {
    // The behaviour the whole closed-loop design rests on, over real rows.
    const user = await createUser();
    const weaknesses = service();

    await weaknesses.recordSignal(user.id, {
      signalType: 'area',
      key: 'dsa',
      area: 'dsa',
      label: 'Data structures',
      source: 'attempt',
    });

    await weaknesses.creditRepairEvidence(user.id, [
      { area: 'dsa', positive: true },
      { area: 'dsa', positive: true },
    ]);

    const rows = await testPrisma().weaknessSignal.findMany({ where: { userId: user.id } });
    expect(rows[0].status).toBe('resolved');
    expect(await weaknesses.listOpenSignals(user.id)).toHaveLength(0);
  });

  it('orders open signals by severity, strongest first', async () => {
    const user = await createUser();
    const weaknesses = service();

    await weaknesses.recordSignal(user.id, {
      signalType: 'area',
      key: 'dsa',
      area: 'dsa',
      label: 'Data structures',
      source: 'attempt',
    });
    for (let index = 0; index < 3; index += 1) {
      await weaknesses.recordSignal(user.id, {
        signalType: 'area',
        key: 'system_design',
        area: 'system_design',
        label: 'System design',
        source: 'attempt',
      });
    }

    const open = await weaknesses.listOpenSignals(user.id);

    expect(open).toHaveLength(2);
    expect(open[0].key).toBe('system_design');
    expect(open[0].severity).toBeGreaterThan(open[1].severity);
  });
});
