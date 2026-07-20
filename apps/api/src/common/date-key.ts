// MOM-172: one definition of "what day is it" for the whole API.
//
// The app's day is a calendar day in the user's timezone, not a UTC day. Until now
// only DashboardService needed that (the study streak), so the logic lived there as
// two private methods. The V2 daily plan keys on the same notion of a day
// (DailyPlan.planDate is a @db.Date, one row per user per local day), and the two
// must agree exactly: if the plan resolved "today" in UTC while the streak resolved
// it in UTC+7, every plan created between 00:00 and 07:00 local would file under the
// previous day — silently double-counting one day and skipping another.
//
// Asia/Ho_Chi_Minh is a fixed UTC+7 with no DST, so Intl formatting is exact and no
// date library is needed. There is no per-user timezone preference yet (single-user
// app), so it is the default rather than a hardcode: every function takes a timeZone.
export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// 'en-CA' formats as YYYY-MM-DD, which sorts lexicographically and matches the
// ISO date prefix the shift/parse helpers below round-trip through.
function dayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** The calendar day an instant falls on, in `timeZone`, as "YYYY-MM-DD". */
export function dayKey(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return dayKeyFormatter(timeZone).format(date);
}

/** Move a day key by whole days (negative goes back). Calendar-safe across months/years. */
export function shiftDayKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// A day key denotes a whole calendar day, not an instant, so it maps to UTC midnight —
// which is how Postgres `date` columns (and Prisma's @db.Date) round-trip without the
// value drifting a day either side of the timezone conversion.
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/**
 * Consecutive-day streak ending today, counting backward over the days present in
 * `timestamps`. If today has no entry the streak is not broken — it is counted from
 * yesterday backward, which is how most streak UIs give you the rest of the day to
 * keep it alive.
 */
export function consecutiveDayStreak(
  timestamps: Date[],
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): number {
  if (timestamps.length === 0) return 0;
  const format = dayKeyFormatter(timeZone);
  const days = new Set(timestamps.map((timestamp) => format.format(timestamp)));

  const today = format.format(now);
  let cursor = days.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}
