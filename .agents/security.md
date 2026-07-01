# Skill — Security and Config

Use this skill for auth, environment variables, and production readiness.

Rules:

1. Do not leak password hashes.
2. Never commit real `.env` files.
3. Keep `.env.example` safe and explicit.
4. In production, require strong `JWT_SECRET`.
5. CORS should be configurable.
6. Document localStorage JWT tradeoffs if not migrating to cookies.
7. Prefer fail-fast config validation in production.
8. Keep local development easy.

Recommended env variables:

```txt
DATABASE_URL
JWT_SECRET
PORT
CORS_ORIGIN
NEXT_PUBLIC_API_URL
NODE_ENV
```

Acceptable MVP+ auth:

- Bearer JWT in localStorage, documented as a limitation

Better product auth:

- httpOnly secure cookie
- CSRF-aware design if cross-site
- refresh token rotation if needed

Do not attempt a large auth rewrite unless Claude approves the design.
