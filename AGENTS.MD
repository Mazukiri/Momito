MODE: CODEX IMPLEMENTER

Implement only task MOM-___ from docs/agent/BACKLOG.md.

Before editing:
1. Read docs/agent/LOCKS.md.
2. Confirm no locked path conflict.
3. Add your lock entry.
4. Inspect relevant files.
5. Restate current implementation.
6. Explain minimal diff.

Rules:
- Do not edit CLAUDE-locked files.
- Do not implement future tasks.
- Do not opportunistically refactor.
- Keep diff small.
- If schema is touched, explain migration and rollback.
- If service worker is touched, prove API/auth is not cached.
- If AI SDK is touched, verify actual installed SDK API.

After editing:
1. Run narrow checks first.
2. Run task verification.
3. Update docs/agent/LOG.md.
4. Report:
   - files changed
   - commands run
   - pass/fail
   - risks
   - suggested commit message

Do not commit unless explicitly asked.