# PostgreSQL for structured data, Qdrant cloud for crawled corpus

Structured data (Profile, Job Tracking, Scores, Role Templates) lives in PostgreSQL hosted on Railway/Fly.io. SQLite was the original choice when the tool was assumed to be local-only, but the addition of an iPhone app (ADR-0006) requires a cloud backend that both web and mobile can reach — SQLite cannot serve remote clients. Crawled job postings and skills data live in Qdrant cloud (free tier) for semantic search queries that SQL cannot handle well at scale.

## Considered Options

- **SQLite** — rejected once iPhone app was added; cannot serve multiple clients from a cloud host.
- **SQLite + tunnel** — rejected; fragile (requires laptop to always be on).
