# Skill — Deployment and Local Setup

Use this skill for Docker, env examples, README, and deployment docs.

Local setup should be reproducible.

Preferred local flow:

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Required docs:

- prerequisites
- env setup
- database setup
- migration
- seed
- dev
- build
- test
- troubleshooting

Do not assume the developer already has a local database configured.

Provide safe example env values but no real secrets.

Generated/local files must be ignored:

```txt
node_modules
dist
.next
build
coverage
*.tsbuildinfo
.env
.env.*
```
