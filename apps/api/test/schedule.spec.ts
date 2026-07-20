import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CRON_DAILY_PLAN,
  CRON_FOLLOW_UP_SWEEP,
  CRON_INTERVIEW_PREP,
  CRON_REMINDER_PUSH,
  SCHEDULE_TIME_ZONE,
} from '../src/common/schedule';

/** Minutes to add to a UTC instant to get wall-clock time in `timeZone`. */
function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  // 'en-US' renders midnight as hour 24; normalise so the arithmetic below holds.
  const hour = Number(parts.hour) % 24;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - at.getTime()) / 60_000;
}

function parseDailyCron(expression: string): { hour: number; minute: number } {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.split(' ');
  // Guard the assumption the rest of this file makes: these run every day.
  expect([dayOfMonth, month, dayOfWeek]).toEqual(['*', '*', '*']);
  return { hour: Number(hour), minute: Number(minute) };
}

/** The UTC hour a daily local-time cron actually fires at. */
function utcHourOf(expression: string): number {
  const { hour } = parseDailyCron(expression);
  // Reference instant only matters for zones with DST; Asia/Ho_Chi_Minh is a
  // fixed UTC+7, and the offset is derived rather than hardcoded so this stays
  // honest if SCHEDULE_TIME_ZONE ever changes.
  const offsetHours = zoneOffsetMinutes(SCHEDULE_TIME_ZONE, new Date('2026-07-20T00:00:00Z')) / 60;
  return (((hour - offsetHours) % 24) + 24) % 24;
}

/** The UTC hours `.github/workflows/keepwarm.yml` actually pings on. */
function keepWarmUtcHours(): number[] {
  const workflow = readFileSync(
    join(__dirname, '..', '..', '..', '.github', 'workflows', 'keepwarm.yml'),
    'utf8',
  );
  const schedule = workflow.match(/cron:\s*'([^']+)'/);
  expect(schedule, 'keepwarm.yml must declare a cron schedule').not.toBeNull();
  const [, hourField] = (schedule as RegExpMatchArray)[1].split(' ');
  const [start, end] = hourField.split('-').map(Number);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

describe('scheduler timing', () => {
  it('interprets the hour in the user timezone, not the server one', () => {
    // The MOM-176 bug in one assertion. render.yaml sets TZ=UTC, so a bare
    // `EVERY_DAY_AT_6AM` fired at 06:00 UTC = 13:00 ICT. With the zone applied,
    // 07:02 in the expression really is 07:02 for the user.
    expect(SCHEDULE_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
    expect(parseDailyCron(CRON_INTERVIEW_PREP)).toEqual({ hour: 7, minute: 2 });
    expect(utcHourOf(CRON_INTERVIEW_PREP)).toBe(0);
  });

  // The constraint that makes "just schedule it at 6am" wrong: the API sleeps on
  // Render's free tier outside the keep-warm window, and an in-process cron
  // cannot fire while it is asleep. Read from the workflow rather than restated,
  // so narrowing keepwarm.yml breaks this test instead of silently killing a job.
  it.each([
    ['interview prep', CRON_INTERVIEW_PREP],
    ['follow-up sweep', CRON_FOLLOW_UP_SWEEP],
    ['daily plan', CRON_DAILY_PLAN],
  ])('%s fires inside the keep-warm window', (_label, expression) => {
    expect(keepWarmUtcHours()).toContain(utcHourOf(expression));
  });

  it('rejects a 06:00 local schedule, which is the tempting wrong fix', () => {
    // 06:00 ICT is 23:00 UTC — outside keepwarm's 0-17, so the instance is
    // likely asleep and the job would never run. Documents why the times start
    // just after 07:00 local.
    expect(keepWarmUtcHours()).not.toContain(utcHourOf('0 6 * * *'));
  });

  it('orders the daily jobs so the plan snapshots fresh inputs', () => {
    const prep = parseDailyCron(CRON_INTERVIEW_PREP);
    const followUp = parseDailyCron(CRON_FOLLOW_UP_SWEEP);
    const plan = parseDailyCron(CRON_DAILY_PLAN);

    expect(prep.hour).toBe(followUp.hour);
    expect(followUp.hour).toBe(plan.hour);
    expect(prep.minute).toBeLessThan(followUp.minute);
    expect(followUp.minute).toBeLessThan(plan.minute);
  });

  it('keeps reminder push on an off-minute so it never collides with the daily jobs', () => {
    const minutes = CRON_REMINDER_PUSH.split(' ')[0].split(',').map(Number);
    const dailyMinutes = [CRON_INTERVIEW_PREP, CRON_FOLLOW_UP_SWEEP, CRON_DAILY_PLAN].map(
      (expression) => parseDailyCron(expression).minute,
    );

    for (const minute of dailyMinutes) {
      expect(minutes).not.toContain(minute);
    }
  });
});
