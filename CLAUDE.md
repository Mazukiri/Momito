# Momito

A personal job preparation tool for a single developer targeting FAANG, HPC Engineer, and Quant Hedge Fund SWE roles. Helps track CV quality, learning progress, and job applications.

## Domain language

Read `CONTEXT.md` first. Key terms: **Profile** (structured career data, not the PDF), **Source of Truth** (crawled market data), **Target** (Role Template or JD), **Score** (4-category breakdown), **Gap** (missing item vs. Target checklist).

## Architecture

**Stack**
- Backend: Python + FastAPI, deployed on Railway or Fly.io
- Web: Next.js (React + TypeScript)
- Mobile: React Native + Expo (iOS)
- Database: PostgreSQL (structured data) + Qdrant cloud (crawled corpus, semantic search)
- Auth: single bearer token in `.env` — personal tool, no multi-tenancy

**Services**
```
backend/          FastAPI — all business logic, LLM calls, crawler orchestration
web/              Next.js — full feature set
mobile/           React Native/Expo — job tracking + learning progress only
```

## Features

### CV/ATS
- User uploads PDF → LLM parses into structured **Profile** (one-time)
- Profile scored against a **Target** (Role Template or pasted JD) across 4 categories:
  - **Skills Match** — set intersection of profile skills vs. target required skills
  - **Project Quality** — checklist: does profile have all 3 project archetypes?
  - **Experience Depth** — tenure, scope, company tier (weighted rules)
  - **Presentation** — quantified bullets, structure checks (regex)
- Score calculation is deterministic — no LLM in the scoring path
- LLM called exactly twice per session: PDF parse (input) + suggestion text (output)
- **Project Formula**: 3 archetypes checked in Project Quality — (1) full-stack + system design, (2) CS fundamentals deep-dive, (3) paper re-implementation. App suggests specific projects when an archetype is missing.
- **Job Tracking**: list of applications with status, deadline, visa tag
- **Visa Tag**: H1B sponsorship signal from public USCIS annual data — not a prediction model

### Learning System
- **DSA**: user pastes LeetCode URL → app crawls metadata (title, difficulty, topics), user manually ticks solved
- **Progress**: per-role checklists (hardcoded). "Google L4 SWE" has its own checklist; "Jane Street SWE" has another. Progress = % of checklist completed.
- **Weekly plan**: app shows gaps clearly (remaining items per checklist). No auto-scheduling.
- **Learning materials**: curated links per topic, authored manually

### Crawlers (run in parallel)
1. **Job postings** (LinkedIn, Greenhouse, Lever) — feeds Role Templates and Skills Match scoring
2. **GitHub trending + ArXiv** — feeds Project Quality suggestions and paper re-implementation ideas
3. **USCIS H1B disclosure CSVs** — feeds Visa Tags (public data, updated annually)

Crawled data lands in Qdrant. Structured metadata lands in PostgreSQL.

## Key documents

| Document | Purpose |
|---|---|
| `CONTEXT.md` | Domain glossary — canonical term definitions |
| `docs/adr/` | Architectural decisions — read before changing data model or tech choices |
| `Requirement.MD` | Original requirements — reference only, superseded by ADRs |

## ADR index

| ADR | Decision |
|---|---|
| 0001 | Personal tool, not SaaS — single bearer token auth |
| 0002 | Source of Truth is auto-crawled (3 sources in parallel) |
| 0003 | Visa signal = H1B tag from USCIS, not a prediction model |
| 0004 | LLM called only at input/output boundaries, never for scoring |
| 0005 | PostgreSQL for structured data, Qdrant for crawled corpus |
| 0006 | Cloud backend (Railway/Fly.io) serving web + iPhone |
| 0007 | Python FastAPI backend, Next.js web, React Native/Expo mobile |
| 0008 | Role checklists are hardcoded, not crawled or LLM-synthesized |

## What's not in scope

- Auto-apply (too fragile, browser automation across many portals)
- Visa prediction model (training data not publicly available)
- Auto-scheduling of weekly study plan (gap visibility is sufficient)
- Multi-user / SaaS (personal tool only)
