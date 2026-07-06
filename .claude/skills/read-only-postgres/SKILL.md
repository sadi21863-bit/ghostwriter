---
name: read-only-postgres
description: "Safely run read-only SQL (SELECT/SHOW/EXPLAIN/WITH) against this project's live Neon Postgres database directly from a Claude Code session — for debugging, data inspection, and verifying assumptions against real data. Use whenever a question needs an actual look at live rows/schema rather than reading Drizzle schema definitions alone (e.g. 'how many users are on story_pro', 'what does a real generations row look like', 'is this column actually populated in prod')."
---

# read-only-postgres

Runs a query against `DATABASE_URL` (this project's live Neon Postgres) via the `@neondatabase/serverless` HTTP driver already used by `src/db/index.ts` — no new dependency, no persistent connection, no local Postgres needed.

Adapted from the `read-only-postgres` pattern (jawwadfirdousi/agent-skills) for this project specifically: single database via `DATABASE_URL` rather than a separate multi-connection config file, since this project only ever talks to one database.

## When to use this

Use it instead of grepping `src/db/schema.ts` when the question is about the **actual data**, not the schema shape — e.g. checking whether a migration actually populated a column, counting real rows for a cost/usage question, or looking at a specific user's row to debug a support issue. For schema *shape* questions, reading `src/db/schema.ts` directly is faster and doesn't need a live query.

## Usage

```bash
node .claude/skills/read-only-postgres/scripts/query.mjs --query "SELECT id, tier, status FROM subscriptions WHERE status = 'active' LIMIT 20"
node .claude/skills/read-only-postgres/scripts/query.mjs --tables
node .claude/skills/read-only-postgres/scripts/query.mjs --schema users
```

Output is JSON: `{ rowCount, returned, truncated, rows }`.

## Safety (enforced in `scripts/query.mjs`, not just documented here)

- **Statement allowlist**: only `SELECT`, `SHOW`, `EXPLAIN`, `WITH` are accepted (checked after stripping comments).
- **Denylist**: `INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`TRUNCATE`/`GRANT`/`CREATE`/`COPY`/`CALL`/etc. anywhere in the statement is rejected outright, even inside a CTE.
- **Single statement only**: a second `;`-separated statement is rejected.
- **`SELECT ... INTO` rejected** (it creates a table — the one SELECT-shaped statement that isn't actually read-only).
- **20s timeout** via `AbortController` — a runaway query is killed, not left hanging.
- **500-row cap** and **120-char column-width cap** on the returned JSON, so a broad query can't flood the session with an enormous result.

This is a defense-in-depth text-level gate, not a database-level read-only role — it protects against an accidental destructive query in a debugging session, not against a determined bypass. Never use this script's connection for anything but ad hoc read queries during development.

## Auth

Requires `DATABASE_URL` to be set in the environment the Claude Code session runs in (same variable `src/db/index.ts` reads — see this project's `.env.local` / `CLAUDE.md`). No separate credentials file.
