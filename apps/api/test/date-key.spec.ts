import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  consecutiveDayStreak,
  dayKey,
  dayKeyToDate,
  shiftDayKey,
} from '../src/common/date-key';

describe('dayKey', () => {
  // The whole reason this helper exists: between 17:00 and 24:00 UTC it is already
  // tomorrow in Asia/Ho_Chi_Minh. A daily plan or streak that resolved "today" in UTC
  // would file those hours under the wrong day.
  it('resolves the local calendar day, not the UTC one', () => {
    expect(dayKey(new Date('2026-07-19T17:30:00Z'))).toBe('2026-07-20');
    expect(dayKey(new Date('2026-07-19T16:59:59Z'))).toBe('2026-07-19');
  });

  it('formats as a lexicographically sortable YYYY-MM-DD', () => {
    expect(dayKey(new Date('2026-01-05T03:00:00Z'))).toBe('2026-01-05');
  });

  it('honours an explicit timezone over the default', () => {
    const instant = new Date('2026-07-19T17:30:00Z');
    expect(dayKey(instant, 'UTC')).toBe('2026-07-19');
    expect(dayKey(instant, DEFAULT_TIME_ZONE)).toBe('2026-07-20');
  });
});

describe('shiftDayKey', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap days', () => {
    expect(shiftDayKey('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is a no-op for zero', () => {
    expect(shiftDayKey('2026-07-19', 0)).toBe('2026-07-19');
  });
});

describe('dayKeyToDate', () => {
  // A day key denotes a calendar day, so it maps to UTC midnight — the form a
  // Postgres `date` / Prisma @db.Date column round-trips without drifting a day.
  it('maps to UTC midnight of that day', () => {
    expect(dayKeyToDate('2026-07-19').toISOString()).toBe('2026-07-19T00:00:00.000Z');
  });

  it('round-trips through shiftDayKey', () => {
    expect(dayKey(dayKeyToDate('2026-07-19'), 'UTC')).toBe('2026-07-19');
  });
});

describe('consecutiveDayStreak', () => {
  const now = new Date('2026-07-19T05:00:00Z'); // 12:00 local, mid-afternoon on the 19th
  // Local noon on the given local day, so fixtures read as the day they represent.
  const localNoonOf = (key: string) => new Date(`${key}T05:00:00Z`);

  it('is zero with no activity', () => {
    expect(consecutiveDayStreak([], DEFAULT_TIME_ZONE, now)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const timestamps = ['2026-07-17', '2026-07-18', '2026-07-19'].map(localNoonOf);
    expect(consecutiveDayStreak(timestamps, DEFAULT_TIME_ZONE, now)).toBe(3);
  });

  it('does not break the streak when today has no activity yet', () => {
    const timestamps = ['2026-07-17', '2026-07-18'].map(localNoonOf);
    expect(consecutiveDayStreak(timestamps, DEFAULT_TIME_ZONE, now)).toBe(2);
  });

  it('stops at the first missing day', () => {
    const timestamps = ['2026-07-15', '2026-07-18', '2026-07-19'].map(localNoonOf);
    expect(consecutiveDayStreak(timestamps, DEFAULT_TIME_ZONE, now)).toBe(2);
  });

  it('counts a day once no matter how many entries it holds', () => {
    const timestamps = [
      new Date('2026-07-19T01:00:00Z'),
      new Date('2026-07-19T06:00:00Z'),
      new Date('2026-07-19T09:00:00Z'),
    ];
    expect(consecutiveDayStreak(timestamps, DEFAULT_TIME_ZONE, now)).toBe(1);
  });

  it('is zero when the most recent activity is older than yesterday', () => {
    expect(consecutiveDayStreak([localNoonOf('2026-07-10')], DEFAULT_TIME_ZONE, now)).toBe(0);
  });

  // Late-evening local activity lands on the next UTC date; it must still count as
  // the local day the user experienced it on.
  it('credits late-evening local activity to the local day', () => {
    const lateOn18th = new Date('2026-07-18T16:00:00Z'); // 23:00 local on the 18th
    const timestamps = [lateOn18th, localNoonOf('2026-07-19')];
    expect(consecutiveDayStreak(timestamps, DEFAULT_TIME_ZONE, now)).toBe(2);
  });
});
