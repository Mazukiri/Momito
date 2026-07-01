# Handoff Notes

Use this file when one agent finishes a task and another agent needs context.

## Current Status (2026-06-20)

All MVP implementation and documentation are **DONE**.

### What's Built

**Authentication** (`WEB-002`)
- Login, register pages with form validation
- Auth context/provider with token management
- Protected routes redirect to login

**Questions** (`WEB-002`)
- List with search, type/difficulty/topic filters, pagination
- Detail page with reference answer toggle, notes, source links
- "Start Practice" button creates 1-question session

**Practice Sessions** (`WEB-003`)
- `/practice/new` — create session with type (quick/topic/company/mixed), topic, company, difficulty, question count
- `/practice/session/[id]` — question-by-question flow: progress bar, answer textarea, self-rating (1-5), prev/next nav, complete/abandon
- `/practice/session/[id]/summary` — stats cards (status, answered/total, duration, type), question/answer review with star ratings, skipped badges

**Answer History** (`WEB-003`)
- `/attempts` — paginated list of past answers
- `/attempts/[id]` — full answer text, self-rating stars, link to question and session

**Dashboard** (`WEB-004`)
- `/dashboard` — summary cards, topic progress bars, weak topics, suggested next topics, recent sessions list

**Study Plan** (`WEB-004`)
- `/study-plan` — tabbed layout (todo/in_progress/done) with create form, status progression, delete

**Documentation** (`DOCS-001`)
- `README.md` complete with setup prerequisites, env vars, quick-start, and API endpoints reference.

### Next Steps

1. **Human**: Set `JWT_SECRET` and `DATABASE_URL` env vars.
2. **Human**: Set up PostgreSQL, run `pnpm install` + `prisma migrate dev`.
3. **Human**: Run the backend and test end-to-end.

### Known Issues

- No tests for frontend (scope was implementation only)
- Active session has no auto-save — browser refresh loses unsaved answer text
- Attempt detail page shows `questionId` UUID instead of question title (API returns questionId only)
- Dashboard loads all attempts — fine for MVP, may need pagination later
