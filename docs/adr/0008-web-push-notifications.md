# ADR-0008: Web Push notifications (dormant until VAPID keys are set)

## Status
**Implemented, dormant by default** — 2026-07-07. Built and unit-tested (mocked `web-push`
sender, zero network) with a locally-generated VAPID keypair in this dev environment; the
real iOS Safari install→subscribe→receive path is unverified until deployed over HTTPS.

## Context
The user asked for push notifications and initially assumed a native Flutter rewrite was
required to get them on an iPhone X. That's not the case: iOS 16.4+ added Web Push support
for PWAs installed to the home screen, and the user's iPhone X runs up to iOS 16.7 —
comfortably past that threshold. Momito already has a service worker (`public/sw.js`,
MOM-016) and an installable manifest; it had no push subscription plumbing at all.

Reminders already existed (`Reminder` model, poll-on-fetch `ReminderBell`), but that only
notifies while a browser tab is open. The gap this ADR closes is notifying while the app is
closed — which requires a server-side scheduler that actually pushes, not just a client that
polls.

Like AI grading (ADR-0007), this must build and ship with no keys present, and report itself
unavailable rather than failing, since Momito is a single-user personal tool with no bundled
push credentials.

## Decision
1. **`PushSubscription` table** (`userId`, `endpoint @unique`, `p256dh`, `auth`, `userAgent?`)
   — one row per browser/device that has granted permission and subscribed. A user can have
   several (phone + desktop). No new column was needed on `Reminder` to dedupe sends — the
   existing `lastTriggeredAt` field (previously unused) does that job.
2. **VAPID keys via `common/config.ts`** (`getVapidPublicKey`/`getVapidPrivateKey`/
   `getVapidSubject`/`isPushAvailable`), following the same env-access convention as every
   other config value in this file. Generated once locally via `npx web-push
   generate-vapid-keys` — no third-party account required, unlike AI grading's Anthropic key.
3. **`apps/api/src/push/`**:
   - `push.service.ts` — wraps `web-push.sendNotification`; `sendRaw` is `protected` and
     overridden in tests to inject a fake sender without touching Nest DI or a real network
     call (mirrors `GradingService.createClient()`). Prunes a subscription automatically on a
     404/410 response (the push service's way of saying "this endpoint is gone"); leaves it
     alone on any other error (e.g. a transient 500) so a flaky delivery doesn't silently
     unsubscribe a working device.
   - `push.controller.ts` — `GET /push/config` (public key + availability, so the frontend
     can decide whether to show the "Enable notifications" UI at all), `POST
     /push/subscriptions` (upsert by endpoint), `DELETE /push/subscriptions`.
   - `reminder-push.scheduler.ts` — `@Cron` every 5 minutes, on an off-minute (`3,8,13,...`)
     rather than `*/5` so it doesn't cluster with other jobs at `:00`/`:05`. No-ops entirely
     when `isPushAvailable()` is false. Selects reminders that are `pending`, not dismissed,
     not yet `lastTriggeredAt`-stamped, and due — sends, then stamps `lastTriggeredAt` so a
     reminder is only ever pushed once.
4. **Frontend**: `sw.js` gets `push` (shows the notification) and `notificationclick`
   (focuses an existing tab or opens one) handlers. A `push-settings-card.tsx` on `/settings`
   is hidden entirely when `GET /push/config` reports unavailable — same dormant-UI pattern
   as `ai-feedback-card.tsx`. Subscribing calls `Notification.requestPermission()` from
   inside the click handler (iOS requires a user gesture, not a page-load prompt) before
   `pushManager.subscribe()`.

## Consequences
- No cost, no external account, no rate limits to worry about — VAPID is self-hosted crypto,
  not a paid service (unlike AI grading's per-token Anthropic cost).
- iOS's install-to-home-screen requirement means push can't be demoed in a bare Safari tab;
  the settings card should say so rather than silently doing nothing on tap.
- The 5-minute scheduler resolution means a reminder can arrive up to ~5 minutes after its
  `dueAt` — acceptable for a personal study reminder, not real-time messaging.
- Real end-to-end delivery (VAPID→push service→Apple's push gateway→lock screen) requires a
  real HTTPS deployment; this is unverified in local dev and is called out as a post-deploy
  check, the same way AI grading's live Claude call is.
