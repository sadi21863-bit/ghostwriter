# Local-first writing lane

Ghostwriter normally runs as a Next.js SaaS on Neon PostgreSQL + Anthropic.
This lane runs the **same business handlers** on your machine:

```
Compose shell (vanilla JS)  →  127.0.0.1:<port>  →  local host routes  →  SQLite
                                      │
                                      └─ provider adapter → OpenCode Go / Anthropic
                                                           / detected localhost
```

No Next.js server, no Neon, no metering, no cloud auth. The loopback host binds
`127.0.0.1` only, mints a per-launch owner token, and serves three static assets
unauthenticated (`/`, `/app.js`, `/app.css`); every data route is bearer-gated.

## Quick start

1. Put the local provider settings in `.env.local` (gitignored; never commit it):

   ```dotenv
   GW_LOCAL_GENERATION=opencode
   GW_LOCAL_MODEL=deepseek-v4.1-flash
   GW_LOCAL_API_KEY=<your key>
   # optional:
   GW_LOCAL_DB=data/local-ghostwriter.sqlite
   GW_LOCAL_HOST_PORT=4178
   GW_LOCAL_TIMEOUT_MS=900000
   ```

2. Start the host:

   ```powershell
   npm run local:host
   ```

3. Open the printed `http://127.0.0.1:4178` address and paste the **owner token**
   printed to stderr at launch. The token is per launch unless
   `GW_LOCAL_TOKEN` is set (see below).

4. Provider changes made in Settings are written to `local-settings.json` next
   to the database. **Restart the host** to apply them — the generation bundle
   is composed at boot.

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `GW_LOCAL_DB` | `data/local-ghostwriter.sqlite` | SQLite file (WAL enabled) |
| `GW_LOCAL_HOST_PORT` | `4178` | loopback port |
| `GW_LOCAL_GENERATION` | unset = off | `off`, `auto`, `opencode`, `generic`, `anthropic` |
| `GW_LOCAL_MODEL` | — | model id for the chosen lane |
| `GW_LOCAL_API_KEY` | — | provider key (opencode/anthropic/generic) |
| `GW_LOCAL_ENDPOINT_URL` | — | required for `generic` |
| `GW_LOCAL_TIMEOUT_MS` | adapter default | caller timeout for slow local hardware |
| `GW_LOCAL_TIER` | `all_access` | tier the host reports (local owners are not billed) |
| `GW_LOCAL_SEGMIND_API_KEY` / `GW_LOCAL_OPENAI_API_KEY` | — | presence-only for the run-plan preflight |
| `GW_LOCAL_TOKEN` | per launch | fixed owner token for scripted demos/tests (min 32 chars) |

Only `GW_LOCAL_*` keys are read from `.env.local`; real process env wins. The
API key is never logged or returned by a route.

`GW_LOCAL_GENERATION=auto` probes the documented localhost provider list
(Ollama `:11434`, LM Studio `:1234`, portable server `:8080`) and composes the
first target that serves `GW_LOCAL_MODEL`. Localhost targets carry no key and
no external spend, so auto-detection never forwards one.

## The shell

| View | What it does |
|---|---|
| **Write** | project + chapter list, editor with 1.2 s autosave (Ctrl+S saves now), word count |
| **Continue with AI** | posts the last ~4,000 characters as `dynamicContext`, inserts the reply at the end, autosaves |
| **Bible** | characters/locations; edits go through propose → diff → Accept/Reject, not a direct save |
| **Continuity notes** | per-chapter promises opened/resolved and `Character: what they learned` lines |
| **Check continuity** | runs the Story Doctor's two checks and prints the issues |
| **Settings** | provider + live model picker (OpenCode Go catalogue / Anthropic / localhost) |

The continuity panel is the hand-written counterpart to the story loop. Saving
is **delete-then-create**: each chapter has at most one loop-written note, so
the Doctor never reads the same promise twice. Load-back prefills the panel by
`chapterId`, so renaming a chapter does not orphan its notes.

The Story Doctor has exactly two deterministic checks:

1. **Knowledge conflict** — a character acts on a fact in a chapter before the
   memory timeline says they learned it. Evidence is a repeated content-word
   bigram ("brass key"), not loose topic words.
2. **Unresolved promise** — a setup opened earlier is still open at the final
   chapter. This is framed as a **review decision**: a deliberate open thread
   is allowed; an overlooked setup should be revised.

An empty continuity note means the Doctor has nothing to check for that
chapter. Generated books get structured notes from the loop (below).

## The story loop

`scripts/story-loop.mts` writes a book one unit (chapter/scene/episode) at a
time, revises it, extracts continuity notes, and runs the Doctor. It is
resumable and refuses to start without a title and premise.

```powershell
$env:GW_LOOP_TITLE = "The Lantern Ledger"
$env:GW_LOOP_PREMISE = "..."
$env:GW_LOOP_FORMAT = "Novel"
$env:GW_LOOP_CHAPTERS = "4"
$env:GW_LOOP_DB = "the-lantern-ledger.sqlite"
npm run story:loop

# validate config without doing anything
npm run story:loop -- --check

# upgrade an existing book's structured notes and run the Doctor only
npm run story:loop -- --notes
```

Full env table, guards, and limits: [story-loop.md](./story-loop.md).

## Verification

```powershell
# unit suites
npx vitest run src/lib/core/__tests__/local-shell.test.ts
npx vitest run src/lib/story
npx tsc --noEmit

# real browser E2E (boots the host, stubs model calls, spends nothing)
node scripts/verify-local-shell-e2e.mjs
```

The browser runner covers the token gate, autosave across reload, Continue with
AI (asserting the chapter tail rides `dynamicContext`), continuity
save/dedupe/load-back, the Doctor's review wording, Settings model population,
and Bible propose→accept/reject. It writes one `PASS`/`FAIL` line per check.
Details: [local-shell-e2e.md](./local-shell-e2e.md).

Recorded results (2026-11-26):

- browser E2E **12/12**, twice on fresh databases, no page/console errors;
- `local-shell` **20/20**; story suite **96/96**; `tsc --noEmit` exit 0;
- 14-story library, 101,678 words, under [stories/](./stories/).

## Security

- Loopback bind only (`127.0.0.1`), never `0.0.0.0`, never TCP outside the host.
- Per-launch owner token; a missing/incorrect bearer fails closed with 401.
  Data routes are bearer-gated; only the three static shell assets are open.
- `GW_LOCAL_TOKEN` is a demo/test convenience, not a provider key. It still has
  to pass the 32-character floor. Unset it for normal use.
- Provider keys live in `.env.local` (or process env), are read once by the
  composition root, and are never serialized into a response, log line, or
  settings file.
- The host is a single-owner tool. It has no user accounts, no rate limiter, and
  no multi-tenant isolation — do not expose the port.

## File map

| Path | Role |
|---|---|
| `src/lib/core/local-host.ts` | transport, route registry, token gate, optional mounts |
| `src/lib/core/local-shell.ts` | the three static assets (HTML/CSS/vanilla JS) |
| `src/lib/core/handlers/` | shared business handlers used by cloud and local |
| `src/lib/core/sqlite-*.ts` | SQLite twins of the pg repositories |
| `src/lib/core/local-provider-adapter.ts` | OpenAI-compatible adapter (OpenCode Go, generic) |
| `src/lib/core/local-anthropic-adapter.ts` | Anthropic adapter with prompt caching |
| `src/lib/core/local-generation-composition.ts` | boot-time provider decision |
| `src/lib/core/local-generation-context.ts` | series/universe/promise context for local generation |
| `src/lib/story/story-doctor.ts` | the two deterministic checks |
| `src/lib/story/continuity-extract.ts` | parse extracted shifts/promises for the Doctor |
| `src/lib/story/loop-guards.ts` | truncation, repetition, artifact scrub, title split |
| `src/lib/story/loop-config.ts` | fail-fast loop configuration |
| `scripts/spawn-local-host.mts` | composition root (`npm run local:host`) |
| `scripts/story-loop.mts` | the resumable book loop (`npm run story:loop`) |
| `scripts/verify-local-shell-e2e.mjs` | real-browser E2E |

## Known limits

- The shell is deliberately thin: no live refresh while the loop writes;
  reload the tab to see new content.
- The loop's continuity extraction is an LLM call. Re-running `--notes` can
  produce different candidate promises; the main loop extracts once per unit.
- Unresolved-promise reports are review prompts, not automatic defects. Broad
  payoffs (forgiving an entire column) may need a writer's read.
- SQLite intentionally omits pgvector columns, so embedding-based retrieval and
  duplicate detection are honestly off in this lane, not faked.
- Provider/settings changes need a host restart; there is no hot reload.
- The browser E2E is Chromium-only and stubs `/ai/generate` and
  `/provider-models`; it proves UI wiring, not model quality.

## Related docs

- [story-loop.md](./story-loop.md) — loop env, guards, notes pass, artifacts
- [local-shell-e2e.md](./local-shell-e2e.md) — what the browser runner covers
- [stories/](./stories/) — the generated library and weakness→fix report
- [architecture.md](./architecture.md) — cloud architecture and the local lane's place in it
