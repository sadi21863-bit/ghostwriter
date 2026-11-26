# Local shell browser E2E

`scripts/verify-local-shell-e2e.mjs` boots the real loopback host on a fresh
temp SQLite db and drives the thin shell in headless Chromium. It exists because
a `vm.Script` compile pin proves the served `app.js` parses, but not that any
listener actually runs — and a real parse bug once shipped while asset-string
tests stayed green.

## What it covers

| Check | Observable assertion |
|---|---|
| Owner-token gate | token opens the Write view; `#app` becomes visible |
| Project + chapters | selecting the project paints the editor and both tabs |
| Autosave | typed text reads back after a full reload (and via the API) |
| Continue with AI | posts `mode: "write"` + the chapter tail as `dynamicContext`; response is inserted and saved |
| Continuity save | one note for the chapter, correct `chapterIndex`, all three structured fields |
| Continuity dedupe | re-saving replaces the note instead of stacking duplicates |
| Continuity load-back | chapter switch clears the panel, returning prefills the saved lines |
| Doctor | unresolved promises render the "decide whether that is intentional" review wording |
| Bible accept | propose → diff → Accept writes the field through the transaction path |
| Bible reject | Reject leaves the canonical row unchanged |
| Settings picker | selecting `opencode` populates the model list and fills the model id |
| Browser health | no `pageerror` and no unexpected console error |

`/ai/generate` and `/provider-models/*` are fulfilled by Playwright route stubs,
and the host boots with generation OFF. The runner therefore proves **UI
wiring**, not model quality, and cannot spend tokens. A missed stub fails
closed (the host would answer 501) instead of reaching a provider.

The runner generates a random owner token in-process and passes it as
`GW_LOCAL_TOKEN`, so it never parses credentials out of a log. Normal hosts
still mint a fresh per-launch token when that variable is unset.

## Run it

```powershell
node scripts/verify-local-shell-e2e.mjs
```

It prints one `PASS`/`FAIL` line per check and exits non-zero on any failure.
Artifacts (`host.err`, `host.out` — these contain the per-launch owner token, do
not paste them — `result.json`, and the temp db) land under
`%TEMP%\gw-e2e\<timestamp>\`. The host is killed in `finally`; the token is
never printed by the runner.

## The bug this found

The first run failed every interactive check: the gate was `hidden` after a
successful login yet still intercepted pointer events. Root cause: author CSS
`.gate { display: flex }` (and `.view`, `.proposal`, `.doctor`) overrides the
User-Agent `[hidden] { display: none }` rule, so the `hidden` attribute did
nothing on any classed element. The token overlay kept covering the app, and all
three views rendered stacked.

Fixed with one load-bearing rule in `SHELL_CSS`:

```css
[hidden] { display: none !important; }
```

and pinned in `local-shell.test.ts` against the served `app.css`. The compile
pin was green throughout — this class of bug is only visible by executing the UI.

## Known limits

- Chromium only (the installed Playwright browser); no Firefox/WebKit pass.
- Stubbed generation and model lists: wiring coverage, not provider behavior.
- The entity **create** action is direct (the shell has no create proposal), so
  the reject check covers a field edit on an existing row, not create/delete.
- The runner seeds a second chapter directly through `node:sqlite` because the
  loopback host exposes no chapter-create route.
- Timing relies on the shell's own state text (`saved`, `inserted`, `saving…`)
  with generous timeouts; this box is slow, so timeouts are 20 s, not 2 s.
