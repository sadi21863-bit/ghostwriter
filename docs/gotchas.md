# Gotchas

Known quirks, Windows-specific steps, decisions that look wrong but aren't, and things that will bite you if you don't know them.

---

## Windows: Always Copy `.env.local` to `.env` Before DB Commands

```powershell
Copy-Item .env.local .env -Force
npx drizzle-kit push
```

**Why:** `drizzle-kit` uses the `dotenv` package, which reads `.env` — not `.env.local`. Next.js reads `.env.local`. These are two different files. If you run `npx drizzle-kit push` without copying first, drizzle-kit picks up whatever is in `.env` (possibly stale or empty), connects to the wrong database, and silently does nothing or fails with a cryptic connection error.

This is the single most common local development footgun on Windows.

---

## LSP Warnings: "Props must be serializable"

You will see TypeScript/LSP warnings like:

```
Functions are not serializable as props. Remove the `onClick` prop or move it to a Client Component.
```

These are **false positives**. The warnings appear when the TypeScript LSP plugin's `'use client'` boundary detection incorrectly flags function props being passed between two client components (not across a server→client boundary, which would be a real error).

**Ground truth:** Run `npx tsc --noEmit`. If exit code is 0, the code is correct. The app compiles and runs correctly regardless of these warnings.

Do not "fix" these warnings by adding `'use client'` everywhere or removing function props — that changes behavior without fixing a real bug.

---

## The `schema.ts` Model Column Exception

The `generations` table has:

```typescript
model: varchar("model", { length: 100 }).default("claude-sonnet-5")
```

This is a **literal string hardcoded in the DB schema**, not a `MODELS.default` reference. This is intentional and correct.

The `model` column is a historical audit column — it records which model was actually used for each generation. It is not an active model selection. The default value is a historical string that will remain even as active model selections change. Changing it to `MODELS.default` would break the schema (you can't reference TypeScript constants in Drizzle column defaults at runtime).

---

## Rate Limiter is Fail-Open

If `UPSTASH_REDIS_REST_URL` is not set, `checkAiRateLimit()` returns `null` and allows all requests through. This is by design for development.

In production, always verify both Upstash variables are set:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without them, your production app has no rate limiting. A single user can make unlimited AI calls.

---

## No Supabase RLS — Do Not Add It

Authorization is done at the application layer:

```typescript
const project = await db.query.projects.findFirst({
  where: and(
    eq(projects.id, params.projectId),
    eq(projects.userId, session.user.id)  // ← ownership here
  ),
});
```

If you're coming from a Supabase background, do not add `auth.uid()` RLS policies. The app uses Neon PostgreSQL with a server-side Drizzle client — the database doesn't know about user sessions. RLS would need the session JWT passed as a postgres setting per connection, which doesn't work cleanly with a connection-pooled serverless client.

The application-level ownership check covers every route. If you add a new project-scoped route, you must add the `eq(projects.userId, session.user.id)` check yourself — there is no database-level fallback.

---

## `ENCRYPTION_KEY` Must Never Be Lost

The `ENCRYPTION_KEY` is used to AES-256-GCM encrypt Higgsfield API keys stored by users. If you lose this key:

- Existing encrypted values in the database cannot be decrypted
- Users will need to re-enter their API keys
- There is no recovery path

Store `ENCRYPTION_KEY` in a password manager and in Vercel's environment variables. Never commit it to git.

---

## pgvector Extension Must Be Enabled Before Schema Push

If you push the Drizzle schema to a new Neon database without enabling the `pgvector` extension first:

```
ERROR: type "vector" does not exist
```

Run this first in Neon SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then push the schema. If you already pushed and got the error, enable the extension and push again — Drizzle will retry the failed column creation.

---

## `NEXTAUTH_URL` Must Match the Actual Domain

If `NEXTAUTH_URL` is `http://localhost:3001` but you're running on Vercel, OAuth callbacks fail silently and sessions don't persist. The redirect goes to localhost instead of your production URL.

In Vercel, always set:
```
NEXTAUTH_URL=https://your-actual-domain.com
NEXT_PUBLIC_APP_URL=https://your-actual-domain.com
```

These must match the domain Vercel is serving the app on.

---

## Video Dissection Requires Three GitHub Secrets

The Dissect Video feature dispatches a GitHub Actions workflow. For this to work:

1. `GITHUB_PAT` — a Personal Access Token with `repo` scope
2. `GITHUB_REPO_OWNER` — the GitHub username that owns the workflow repo
3. `GITHUB_REPO_NAME` — the repo containing the `dissect-video.yml` workflow file

Without all three, the "Dissect Video" button will silently create a job that never progresses.

The workflow itself also needs `GEMINI_API_KEY` configured as a GitHub repository secret (not Vercel env var) — the video analysis runs inside GitHub Actions, not on Vercel.

---

## Razorpay Webhook Must Use the Correct Signing Secret

Razorpay test mode and live mode have separate webhook signing secrets. Symptoms of using the wrong secret:
- Webhooks arrive at `/api/webhooks/razorpay` but return 400
- HMAC-SHA256 verification fails
- Subscriptions appear active in Razorpay dashboard but don't activate in your database

Fix: Copy the signing secret from the **correct mode's** webhook configuration in Razorpay Dashboard → Settings → Webhooks.

---

## `getUserTier()` Caches for 5 Minutes

After a user upgrades, there is up to a 5-minute delay before new features unlock. This is because `getUserTier()` caches subscription tier lookups in memory.

The Razorpay webhook handler clears the cache via `invalidateTierCache(userId)` after updating the subscription. But if you add a new subscription-mutating route and forget to call `invalidateTierCache`, the user's old tier persists until cache expiry.

---

## TipTap Auto-Save Writes Every Keystroke (Debounced)

The chapter editor saves content to the database on every keystroke, debounced to 1000ms. This means:

- High-frequency DB writes during active typing
- If the user types for 60 minutes without pausing for 1 second, the last save happens when they stop
- If the browser crashes mid-typing, up to 1 second of content can be lost

The debounce is intentionally short (1s) because writers panic if they think their work isn't being saved. If DB write latency is a concern, increase the debounce to 2-3s.

---

## Composition Mode Uses `MODELS.quality` — It's Expensive

`composition` mode (multi-layer mode mixing) uses Opus, which costs approximately 3-5× more per token than Sonnet. If users frequently use composition mode, monitor Anthropic API costs closely.

A single composition generation can cost $0.05-0.15 in API fees for a long chapter. Consider adding a separate rate limit for composition mode if cost becomes a concern.

---

## Alt Draft Does Not Modify the Original Chapter

Alt draft generates an alternative version in a separate `chapters` row with `parentChapterId` set. The original chapter is never modified. The UI shows both the original and the alt draft side-by-side.

If you delete a parent chapter, child alt-draft chapters are not automatically deleted — they become orphaned rows. The cleanup cron handles some of this, but be aware of the cascade behavior when deleting chapters.

---

## `alwaysInContext` Character Toggle Is Critical for Long Projects

For projects with 10+ characters, setting less important characters to `alwaysInContext: false` is essential. Full detail injection for 10 characters can add 2000+ tokens to every prompt, which:

1. Increases cost
2. Pushes the actual writing prompt further down in context
3. Can cause the model to focus on character exposition instead of the scene at hand

The compressed format is: `CharacterName: one-line description.` — enough for the model to remember the character exists without drowning the prompt in detail.

Users should be advised to set minor characters to compressed context once their role is established.

---

## The Dev Server Runs on Port 3001, Not 3000

```
npm run dev → http://localhost:3001
```

Port 3001 is configured in `package.json` (`"dev": "next dev -p 3001"`). If you expect the app at localhost:3000, it won't be there. The `NEXTAUTH_URL` for local dev should be `http://localhost:3001`.

---

## Build Errors Are Suppressed in Production Builds

`next.config.js` has:

```javascript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

This means TypeScript errors do not fail Vercel builds. The build will deploy even if there are type errors. This is intentional — it prevents minor LSP false positives from blocking deployments.

**Do not rely on the Vercel build to catch type errors.** Run `npx tsc --noEmit` locally before pushing.

---

## PowerShell Heredoc Syntax for Git Commits

PowerShell does **not** support Bash-style heredocs (`cat <<'EOF'`). Using Bash syntax in PowerShell for multi-line git commit messages causes a parse error:

```powershell
# ❌ Does NOT work in PowerShell
git commit -m "$(cat <<'EOF'
Message here
EOF
)"
```

**Correct approaches in PowerShell:**

```powershell
# Option 1: Write to temp file
"Commit message here.`n`nCo-Authored-By: ..." | Out-File -FilePath commit_msg.txt -Encoding utf8
git commit -F commit_msg.txt
Remove-Item commit_msg.txt

# Option 2: Single-quoted here-string (PowerShell native)
git commit -m @'
Commit message here.

Co-Authored-By: ...
'@
```

---

## Claude Returns JSON Wrapped in Code Fences

Claude often wraps JSON responses in markdown code fences:

```
```json
{ "key": "value" }
```
```

Calling `JSON.parse()` directly on this string throws. Use `safeParseJson()` from `src/lib/ai/engine.ts` instead, which strips code fences before parsing:

```typescript
// ❌ Fails when Claude wraps JSON in ```json ... ```
const result = JSON.parse(raw);

// ✅ Handles fenced and unfenced JSON
const result = safeParseJson(raw);
```

Routes that call Claude and expect JSON (`generateQuickStory`, `generateBeginnerCharacters`, `braindump`) must use `safeParseJson`. The `braindump` route strips fences inline with `.replace(/```json\n?|```/g, '')` which works, but using `safeParseJson` is cleaner.

---

## `analyze-passage` Rate Limit Returns 429, Not Silent 200

When a user hits the monthly generation limit in `POST /api/ai/analyze-passage`, the route returns:

```json
{ "error": "monthly_limit_reached", "directives": "" }
```

with status **429** (not 200). Client code must check the response status — a `directives: ""` response on 200 is a legitimate "no directives found" result; a 429 means the limit was hit.

---

## Format-Specific Behavior Is Real for Generation, Not for Export

`src/lib/ai/engine.ts`'s `FORMAT_RULES`/`STORY_FORMAT_RULES` (accessed via the exported `getFormatRules(format)`) genuinely change the system prompt per `project.format` (Screenplay gets proper INT./EXT. slugline + centered-cue instructions, YouTube/TikTok/Podcast get hook timing + on-screen-text markers, etc.) — this is real, not cosmetic. Found 2026-06-17: TikTok Native had no entry in either rules map and was generated as plain unstructured text, unlike every other format. Fixed 2026-06-18: added a `FORMAT_RULES["TikTok Native"]` entry (deliberately the inverse of TikTok Script's structure — no `[TEXT ON SCREEN]` markers, no scripted-feeling beats, written to read as unscripted talking-to-camera). `engine.test.ts` now asserts every format in `FORMATS` (`src/lib/formats.ts`) gets a non-empty result from `getFormatRules()`, so a new format added without a rules entry fails the test instead of silently generating unstructured text.

Separately, `src/app/api/projects/[projectId]/export/manuscript/route.ts` (DOCX export) used to be **completely format-agnostic** — always Times New Roman, always generic prose paragraph styling, regardless of `project.format`. A Screenplay project's AI-generated content has correct screenplay structure in the editor (sluglines, character cues), but exporting it to DOCX discarded that structure entirely. Found 2026-06-17, fixed 2026-06-18: the route now detects `project.format === 'Screenplay'` and switches to Courier New, single-spacing, no first-line indent, plus line-level pattern detection (`SCENE_HEADING_RE`, `isCharacterCue()`, `PARENTHETICAL_RE`, all exported for testing) that bolds scene headings, centers character cues, and italicizes/centers parentheticals. This is regex-based best-effort detection against plain text (the chapter content has no structured screenplay markup — it's prose that *looks* like a screenplay per `engine.ts`'s SCREENPLAY FORMAT RULES), not a true structured screenplay parser, so unusual formatting in AI output can still slip through uncategorized as plain action/dialogue text. Novel and Web Series projects are unaffected — they still get the original Times New Roman / double-spaced / indented prose styling.

---

## Every Mode Now Passes `projectId` — Don't Reintroduce a Bare `fetch("/api/ai/generate")`

Until 2026-06-18, `dialogue`, `interrogation`, `chase`, `combat`, `emotional`, `atmosphere`, and `tension` modes (`src/hooks/useGeneration.ts`) built their own client-side context and posted to `/api/ai/generate` without `projectId`. Since the server-side Series Bible (`buildSeriesBibleContext`) and cross-book/universe context (`buildSeriesUniverseContext`) are both gated on `projectId` being present in the request body, those 7 modes silently never got that context — only `write`/`outline`/`brainstorm` and the other 19 library modes did.

Fixed by always including `projectId`/`chapterId` in every call (the `runLibraryGeneration` helper no longer has an `includeIds` opt-out). If you add a new generation mode, route it through `runLibraryGeneration` or include `projectId`/`chapterId` directly — there's no longer a sanctioned way to skip it.

---

## The Stage-Ladder Review Threshold Is Format-Aware — Don't Hardcode 500 Again

`src/lib/guide/next-action.ts`'s Polish/Export stage transition used to gate on a single flat `REVIEW_THRESHOLD = 500` words, regardless of format. Short-form creator formats (TikTok Script/Native, Instagram Reel, YouTube Short) target ~150-220 words per `FORMAT_RULES` — they could never cross 500 words and would sit in Draft/Script forever, never reaching Retention edit/Publish pack via the stage ladder. Documented as a known, deliberately-deferred limitation in `docs/superpowers/plans/2026-06-14-redesign-phase3-plan4-creator-variant.md`, fixed 2026-06-18.

Fixed via `getReviewThreshold(format)`, which returns `CREATOR_REVIEW_THRESHOLD = 100` for any `isCreatorFormat(format)` and `REVIEW_THRESHOLD = 500` otherwise. If you add a new format, check whether it needs its own threshold rather than assuming the creator-format bucket fits — YouTube Long-form and Podcast Episode are both `isCreatorFormat` but target 1000+ words, so they'll now get nudged toward Polish earlier than their full length; that's an intentional tradeoff (early-but-dismissible nudge) over the previous bug (never advancing at all), not a perfectly-tuned threshold per format.

---

## Query Letter / Back-Cover Blurb Are Story-Format-Only — Don't Show Them for Creator Formats

`ExportPanel.tsx`'s "Query Letter" and "Back-Cover Blurb" tabs used to render for **every** `project.format`, including all 6 creator formats (YouTube, TikTok, Podcast, etc.) — and the underlying `/api/projects/[id]/export/blurb` and `/export/query-letter` routes hardcoded "novel" in their AI prompts regardless of actual format. A YouTube Long-form or TikTok Native project reaching the Export/"Publish pack" stage could generate a literary back-cover blurb or a query letter to a literary agent for a video script.

Fixed 2026-06-18: both tabs are now gated behind `isStoryFormat(projectFormat)` in `ExportPanel.tsx` (only Novel/Screenplay/Web Series get them — "Manuscript" stays available for every format). The two API routes now use `getFormatNoun(project.format)` (`src/lib/formats.ts`) to say "screenplay"/"web series"/"novel" in the prompt instead of always "novel". If you add a new story format, add it to `getFormatNoun`'s map or it'll silently fall back to calling it a "novel".

---

## Continuous-Drafting Momentum: Dismissing "Ready to Export?" No Longer Dead-Ends

`src/lib/guide/next-action.ts`'s `computeAction()` returned `{ id: "export-manuscript", ... }` unconditionally once every chapter crossed the review threshold — unlike the `polish-review-manuscript` branch right above it, this branch wasn't dismissal-aware internally. Since `nextAction()`'s outer wrapper nulls out any action whose `id` is already in `dismissedGuideIds`, and `computeAction()` kept recomputing the exact same `"export-manuscript"` id on every call, dismissing "ready to export?" meant `nextAction()` returned `null` **forever** — a genuine dead end for long-form writers who aren't done yet (`GuideBar` disappears, `WritingRoom`'s stage pill stays frozen on "Export" with nothing to do).

Fixed 2026-06-18: the condition is now `allLongEnough && !dismissed.includes("export-manuscript")`, so once dismissed it falls through to the existing `keep-writing-<last-chapter-id>` fallback instead of going null. `currentStage()` correctly moves back to `"draft"` too (it used to stay pinned on `"export"` even with no actual suggestion). Two existing tests in `next-action.test.ts` had this dead-end encoded as their expected behavior — they were intentionally updated, not just made to pass.

Separately, `WritingRoom.tsx` now shows a "Continue → Start next {ChapterLabel}" banner in the footer whenever the active chapter is the last one by `sortOrder` and has `wordCount > 0` — it calls the exact same `addChapter()`/`handleAddChapter` the header's "+ Add Chapter" button already used, just surfaced contextually right where a writer finishing a chapter is actually looking, instead of requiring them to notice the header button.

---

## Dashboard Import Is a Tab Inside "New Project", Not a Separate Modal

`dashboard/page.tsx` used to have a standalone "Scrivener Import" modal (`showImport` state) entirely separate from the "+ New Project" modal. As of 2026-06-18, the Scrivener import flow (file upload, project name, `handleScrivenerImport`) lives as a third `creationMode` tab ("📄 Import manuscript") inside the unified New Project modal, alongside `structured`/`braindump`. The `showImport` state and its modal were deleted entirely — if you're looking for "the import modal," it's `creationMode === 'import'` inside the New Project modal now, not a separate `{showImport && (...)}` block.

The dashboard header's small "Import existing manuscript" link (renamed from "Import from Scrivener") opens the New Project modal pre-set to this tab via `setCreationMode('import'); setShowCreate(true);` rather than its own state. Only Scrivener `.zip` exports are actually supported server-side (`/api/projects/import/scrivener`) — the modal copy says so explicitly ("Word/.docx and plain-text import are planned but not yet available") rather than offering non-functional format options, even though the broader rename implies more formats are coming.

---

## Format Display Label vs. Internal Format Key

`getFormatDisplayLabel(format)` (`src/lib/formats.ts`) renders "Screenplay" as "Screenplay (Film / Movie script)" in format pickers — the internal format key stored on `project.format` is still the bare string `"Screenplay"`, unchanged everywhere else (FORMAT_RULES lookups, `isStoryFormat`, chapter labels, etc.). Don't add a value to that map without also setting an explicit `value={f}` on the `<option>` — the dashboard's two format `<select>`s used to rely on the option's text content as its implicit value, which would have silently broken format matching the moment the display text diverged from the stored key. `FORMAT_HELPER_TEXT[format]` is a one-line helper shown only for formats explicitly listed there (currently only Screenplay) — it's deliberately not populated for every format.

---

## `MAX_PROJECTS` Is Unreachable on Any Route Already Gated by `canAccessFeature(tier, "export")`

`FEATURE_ACCESS.export` (`src/types/subscription.ts`) is `["story_pro", "all_access"]`. `MAX_PROJECTS` (`src/lib/metering/costs.ts`) is `{ free: 3, story_pro: -1, creator_pro: -1, all_access: -1 }`. Every tier that can pass the `export` feature gate already has an uncapped project limit — so a route that checks `canAccessFeature(tier, "export")` first never needs a separate `MAX_PROJECTS` check afterward; it can't trigger. Found while building `/api/projects/[id]/adapt/route.ts` (2026-06-18): an initial draft copied the project-limit check from `POST /api/projects` (which has no tier gate, so the check IS reachable there — free-tier users hit it directly) without noticing the new route's earlier `export` gate made it dead code. Removed before shipping. If you add a new project-creating route, check whether it's tier-gated before assuming it also needs the `MAX_PROJECTS` check.

---

## Dashboard Has Its Own Brand Palette — `src/lib/dashboard-theme.ts`, Not `co`/`panel`

`co`/`panel` (`src/lib/styles.ts`) are the in-editor design tokens (`co.accent` is purple, `#5b4ccc`). The dashboard (`src/app/dashboard/page.tsx`) uses an intentionally different gold/cream "Studio" brand with serif headings (`GW_GOLD = "#c9a84c"`) — this is a deliberate visual distinction, not an oversight, so don't "fix" it by reusing `co.accent` there.

---

## "Open Export →" Used To Run the Guide Ladder's Suggestion, Not Export

A live-browser bug report (2026-06-20) claimed `GhostWriterApp.tsx` didn't own the export modal correctly — it does (`handleGuideRun` checks `runMode === "export"` and calls `setShowExport(true)` *before* the generic `setMode(runMode)` fallback, same file, lines ~247-249). The real bug was in `ExportStageView.tsx`: its "Open Export →" button computed its `action` via `nextAction({...}) ?? { run: { mode: "export" } }` — the same ladder-driven suggestion engine the `GuideBar` uses, with the literal export action only as a fallback for when the ladder returns `null`. Since the ladder almost always has *some* earlier rung to suggest (an under-threshold chapter → `story_health`; an undrafted/short chapter → `keep-writing-<id>` with a *different* chapter's `chapterId`, which `handleGuideRun` then uses to switch `activeChapter`), clicking the button ran whatever THAT suggestion was — explaining all three reported symptoms (Story Health opening, jumping to another chapter, or doing nothing) without ever opening export. Fixed by making the button's action a fixed `EXPORT_ACTION` constant that never calls `nextAction()` — this is the one button in the app whose job is "always do this one thing," not "follow the guide's current suggestion." Regression test: `src/components/stages/__tests__/export-stage-action.test.ts`.

---

## Story Bible Status Dropdown ("Simmering") Didn't Match the Server's Zod Enum — and Wasn't the Reported Root Cause

The same bug report claimed locations/plot-thread PATCH routes used `.strict()` Zod schemas that 400 on any extra client-sent field (e.g. `id`/`createdAt` from a whole-object PATCH body). Verified false by direct test: neither `LocationPatch` nor `PlotThreadPatch` ever called `.strict()` — Zod's default behavior silently strips unrecognized keys, confirmed empirically (`LocationPatch.safeParse({...fullRow, name: "edited"})` → `success: true`). A separate null-vs-undefined theory (pre-migration rows having `NULL` `sortOrder`/`linkedCharacterIds`, which `.optional()` rejects since it only allows `undefined`) was also checked and ruled out — `sort_order`/`linked_character_ids` have had DB-level `DEFAULT` clauses since the very first migration (`0000_square_rage.sql`), and Drizzle's insert builder confirmed (via `.toSQL()` inspection) that omitted/`undefined` values compile to the literal `default` SQL keyword, never `NULL`.

The actual confirmed bug: `StoryBible.tsx` and `WorldBiblePanel.tsx`'s plot-thread status `<select>` both only ever offer `"Active" / "Simmering" / "Resolved"`, but `PlotThreadPatch`'s enum was `["Active", "Resolved", "Dormant"]` — "Dormant" is never sent by any UI, and "Simmering" (the value both UIs actually send) wasn't accepted. Since Zod validates a *known* field's value strictly (only *unknown* keys get stripped), selecting "Simmering" failed `safeParse` for the **whole request body**, silently 400ing any simultaneous edit (e.g. a name change) on that thread. Fixed by adding `"Simmering"` to the enum (kept `"Dormant"` in case any row already has it stored). Separately hardened against this *class* of bug regardless of which field trips it: `StoryBible.tsx`'s `handleSave`/`handleAdd` and `WorldBiblePanel.tsx`'s `saveLoc`/`savePlot`/`saveChar` never checked `res.ok` before treating the response body as the updated row — a 400's `{error: "..."}` body would get written straight into `updateProject()`'s state, silently discarding the edit with no toast, no console error, nothing. All five now check `res.ok` and call `toast.error(...)` on failure, leaving the in-progress edit (and its "Save" button) intact for retry instead of silently reverting. Also added an in-flight guard to `StoryBible.tsx`'s "+ Add" button (previously unguarded — rapid clicking created N duplicate "New location"/"New thread" rows, which is the likely source of the "my edit reverted" perception when a user later edits the wrong duplicate). Regression test: `src/app/api/projects/[projectId]/plot-threads/[threadId]/__tests__/route.test.ts`.

---

## Audio Novel Generation Had No `maxDuration`, Risking a Silent Platform Kill Mid-Run

`src/app/api/audio/generate/route.ts` loops `openai.audio.speech.create()` sequentially over every parsed segment of a chapter with no `export const maxDuration`, unlike every other long-running AI route in this codebase (`production/shots/.../animate`, `generate-video`, `preview`, `preview-all`, `comics` — all `maxDuration = 300`). A long chapter's segment loop can run past Vercel's default function timeout and get killed mid-request with no response ever reaching the client, leaving the "Generate Audio" button stuck on "Generating…" indefinitely. Fixed by adding the same `maxDuration = 300` convention already used by the other AI-generation routes, plus a client-side `AbortController` in `AudioNovelPanel.tsx` (300s timeout matching the server budget) so the button always recovers with a visible "timed out" message instead of waiting indefinitely if something does still go wrong. Deliberately did not parallelize the per-segment TTS loop or move to an async job/polling table in this pass — `maxDuration` + a bounded client timeout directly fixes the freeze; parallelizing is a separate wall-clock optimization, not required to fix the hang itself.

Before 2026-06-18, `GW_GOLD`/`GW_DARK`/`GW_CREAM`/`GW_BORDER` were declared as page-local consts, and `GW_DARK` specifically had drifted: the constant existed but only 3 of its 15 actual color usages referenced it — the other 12 hardcoded the literal `"#0d0d10"` directly. Same story for `#1a1a1a`/`#888`/`#aaa`/`#f5f4f0`, which were never named at all (22/20/12/8 raw occurrences respectively). Moved all seven into `src/lib/dashboard-theme.ts` (`GW_GOLD`, `GW_DARK`, `GW_CREAM`, `GW_BORDER`, `GW_TEXT`, `GW_MUTED`, `GW_MUTED_LIGHT`, `GW_SURFACE_ALT`) and replaced every literal-hex occurrence with the named import — same visible colors, single source of truth. If you add a new repeated color to the dashboard, add it here rather than inlining the hex again.

---

## Node's Built-in `fetch` Has Its Own ~5-Minute Timeout — Independent of Your `AbortController`

Found 2026-06-24 while debugging why every long-running Segmind video/lipsync call in `src/lib/higgsfield/client.ts` kept failing with `UND_ERR_HEADERS_TIMEOUT` regardless of how large a timeout value was passed to `fetchWithTimeout()`. Node's built-in `fetch` is backed by a bundled `undici` that enforces its own internal `headersTimeout`/`bodyTimeout` (~5 minutes by default) — this fires **independently of and can override** any `AbortController` `signal` you pass to `fetch()`. Passing `{ signal: ctrl.signal }` with a 10-minute `setTimeout(() => ctrl.abort(), ...)` does not help; the connection still dies around the 5-minute mark with a different error than your own abort logic produces.

**Fix**: import `fetch` and `Agent` directly from the `undici` npm package (`npm install undici`) instead of relying on Node's global `fetch`, and pass a custom `Agent` with `headersTimeout: 0, bodyTimeout: 0` as the `dispatcher` option:

```typescript
import { fetch as undiciFetch, Agent } from "undici";
const longRunningDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
// ...
await undiciFetch(url, { ...opts, signal: ctrl.signal, dispatcher: longRunningDispatcher });
```

**A second trap**: do not mix Node's *global* `fetch` with a `dispatcher` built from a *separately-installed* `undici` package — Node's bundled internal undici version and the npm package's version can mismatch, producing a different error (`UND_ERR_INVALID_ARG`, "invalid onRequestStart method") when the global fetch tries to use an Agent built by a different undici version's internals. Source `fetch` and `Agent` from the same package import to guarantee compatibility.

## Turbopack Dev Server Can 404 Every Route Under a Recently-Edited Folder for Minutes, Then Keep 404ing Until You Clear `.next`

Found 2026-07-10 (item 70) while running a real-money test against a route (`generate-video`) whose file had just been edited. Every request under `scenes/[sceneNumber]/` — including sibling routes that hadn't been touched — returned a genuine Next.js HTML 404 page (not this codebase's own JSON 404), and the *first* request took 3.6 real minutes before failing. The dev server's own log showed the actual cause: `⚠ Slow filesystem detected. The benchmark took 18431ms` — this project directory lives under a OneDrive-synced path, and Turbopack's route-manifest compile can stall badly on it after edits, landing the dev server in a state where it never resolves the new/changed route segment and just keeps serving its built-in not-found page for every request under that folder, indefinitely — not just during the slow first compile.

**Fix**: stop the dev server (find the PID via `Get-NetTCPConnection -LocalPort 3000` / `netstat -ano | grep :3000`, then `Stop-Process -Force`), delete the `.next` directory entirely, and restart. A plain restart without clearing `.next` does not reliably fix it — the stale manifest survives a restart.

**When this bites**: prefer not fighting it at all for one-off verification scripts. If the function under test is a plain exported `async function` (most of this codebase's Higgsfield/Segmind/DB logic is), call it directly via `npx tsx` instead of going over HTTP — same real product code path, zero Turbopack/routing risk. `tsx` doesn't auto-load `.env.local` the way Next.js does, though: read and set `process.env` from it manually at the top of the script before any module that reads env vars at import time (this codebase's own `db` client reads `DATABASE_URL` lazily on first query, not at import, so plain `import { db } from "../src/db"` is safe as long as the env-loading block runs before the first actual query).

## `src/lib/higgsfield/models.ts`'s Metadata Can Silently Drift From What The Endpoint Actually Does

Found 2026-07-10 (item 70): the `wan` model entry was labeled "WAN 2.5 · Talking heads · Lip-sync · Avatars" while its `segmindEndpoint` was the much older `wan2.1-t2v`, a plain text-to-video endpoint with no lipsync/avatar capability at all — real audio lipsync is a fully separate, already-working feature (`generateLipsync()` → the dedicated `/hallo` endpoint). The wrong label had sat there long enough to accumulate a *second* wrong artifact: a code comment above it blaming "`generateLipsync()` sends params with no basis in Wan's contract," which was also false — that function never touches Wan at all. Neither piece of misinformation was caught by tests, because `models.test.ts` only checks structural invariants (every model has an endpoint, deprecated models are excluded from auto-select), never that `label`/`note`/`bestFor` actually describe the endpoint's real behavior — there's no test that could catch this class of drift. If you add or touch a `VIDEO_MODELS` entry, verify the label against the provider's own current docs (as the `segmindEndpoint` comments already do), not against what a neighboring comment claims.
