# Cloud-hosted backend serving both web app and iPhone app

The backend API runs on a cloud host (Railway or Fly.io) so both the web app and iPhone app can reach it. The iPhone app exposes a subset of features suited to mobile: job tracking (add job, update status, view visa tag) and learning progress (check DSA progress, tick off completed problems). CV scoring, crawler configuration, and detailed analytics are web-only. A single bearer token in `.env` provides auth — sufficient for a personal tool with one known user. This replaces the original local-only assumption and requires PostgreSQL instead of SQLite (see ADR-0005).

## Considered Options

- **Local backend + ngrok tunnel** — rejected; requires the laptop to stay on and tunnel to stay connected. Too fragile for mobile use.
- **Local-first sync (iCloud/CRDTs)** — rejected; conflict resolution and sync logic is significantly more complex than a simple cloud API.
