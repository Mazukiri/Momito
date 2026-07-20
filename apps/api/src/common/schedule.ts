// MOM-176: one place for "when do the daily jobs run", because the answer is
// constrained by something non-obvious that lives outside this repo's src/.
//
// TWO CONSTRAINTS, BOTH EASY TO BREAK BY ACCIDENT
//
// 1. Timezone. `render.yaml` sets `TZ: UTC`, and @Cron with a bare expression is
//    interpreted in the server's zone. So `CronExpression.EVERY_DAY_AT_6AM` —
//    which is what interview-prep used to carry — actually fired at 13:00 in
//    Asia/Ho_Chi_Minh. Every schedule here passes `timeZone` explicitly so the
//    literal number in the expression is the hour the user experiences.
//
// 2. The keep-warm window. The API runs on Render's free tier, which spins the
//    instance down after ~15 min idle; an in-process cron cannot fire while the
//    instance is asleep. `.github/workflows/keepwarm.yml` pings /health every
//    10 min on `*/10 0-17 * * *` UTC — that is 07:00 ICT through 00:59 ICT the
//    next day. Outside that window the instance is probably asleep.
//
//    => A daily job scheduled before 07:00 ICT will silently never run.
//
//    This is the trap in "just move it to 6am so it's actually the morning":
//    06:00 ICT is 23:00 UTC, which is outside `0-17`, so the fix would be worse
//    than the bug it replaces. Everything daily therefore starts just after
//    07:00 ICT, once keep-warm has had a chance to wake the instance.
//
// If you change these times, check keepwarm.yml. If you change keepwarm.yml,
// check these times. They are a pair (docs/adr/0016).
import { DEFAULT_TIME_ZONE } from './date-key';

export const SCHEDULE_TIME_ZONE = DEFAULT_TIME_ZONE;

// Ordered so that by the time the daily plan snapshots the day's inputs, the
// jobs that produce those inputs have already run: prep tasks exist, follow-up
// reminders exist. Spread by a few minutes rather than stacked on the same
// minute so a slow run doesn't overlap the next job.
export const CRON_INTERVIEW_PREP = '2 7 * * *'; // 07:02 ICT
export const CRON_FOLLOW_UP_SWEEP = '5 7 * * *'; // 07:05 ICT
export const CRON_DAILY_PLAN = '10 7 * * *'; // 07:10 ICT — Epic 1 (A4)

// Reminder push is time-of-day agnostic: it fires all day on an off-minute
// (not :00/:05/:10) to avoid clustering with the jobs above. It still carries
// the timezone so its behaviour doesn't change if TZ ever does.
export const CRON_REMINDER_PUSH = '3,8,13,18,23,28,33,38,43,48,53,58 * * * *';

/** Options every @Cron in this codebase should spread, so none can forget the zone. */
export const CRON_OPTIONS = { timeZone: SCHEDULE_TIME_ZONE } as const;
