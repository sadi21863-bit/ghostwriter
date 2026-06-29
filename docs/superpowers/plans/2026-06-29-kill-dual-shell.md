# Kill the Dual-Shell Architecture Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Executed inline in-session with verification after each task.

**Goal:** Commit fully to the WritingRoom shell. Hard-delete the legacy toolbar-driven shell (the `else` branch of `GhostWriterApp.tsx`'s `writingRoomEnabled` switch), the legacy `panels/ChapterEditor.tsx`, the `writingRoomShell` flag, and the legacy-only CSS — leaving exactly one render path.

**Architecture:** `GhostWriterApp.tsx` currently branches on `useFeatureIsOn(FLAGS.writingRoomShell)`: the `true` path renders `WritingRoom` (+ ToolbarPanel reused inside an Actions drawer, + StoryBible + EntitySuggestionsChip), the `false` path renders the always-visible ToolbarPanel layout + legacy `panels/ChapterEditor`. `writingRoomShell` has been ON in production since 2026-06-15 and feature-parity work (Add Chapter, Comic Studio, Audio Novel, Series Bible) was completed 2026-06-17. So this is a deletion + flag-removal + regression-test job, not a feature migration.

**Tech Stack:** Next.js 16, React, GrowthBook (`@growthbook/growthbook-react`), vitest (node env — no browser e2e tooling in this repo).

## Global Constraints

- **ToolbarPanel survives.** It is NOT legacy-only — `GhostWriterApp.tsx:554` renders it as the WritingRoom Actions-drawer content. Only the *always-visible legacy layout* around it (the `else` branch) is deleted.
- **`editor/ChapterEditor` survives.** The modern editor (`@/components/editor/ChapterEditor`, used by WritingRoom/SprintMode/WritePanel/SceneView) stays. Only the legacy `@/components/panels/ChapterEditor` (imported solely by `GhostWriterApp.tsx:8`) is deleted.
- After deletion there must be exactly one render path — no `writingRoomEnabled` conditional anywhere.
- `tsc --noEmit` exit 0 + full `vitest run` green + `next build` success are the completion bar.
- Real browser e2e is not runnable in this environment (no Playwright/Cypress/testing-library/jsdom). The regression coverage is the existing static `live-shell-reachability.test.ts` pattern, extended; plus unit tests on the flow's testable building blocks. A real Playwright suite is a separate, later infra task — flagged, not faked.
- Test-mock convention: never `vi.fn(impl)` with a zero-arg implementation later called via spread (breaks `tsc`); use `vi.fn()` + `.mockResolvedValue()`.

---

### Task 1: Turn the reachability test into a legacy-gone regression guard

**Files:**
- Modify: `src/components/__tests__/live-shell-reachability.test.ts`

The existing test asserts must-be-reachable feature components are imported in the live shell. Add a second `describe` that asserts the legacy shell is GONE — this is the regression guard requested ("ensure all kept features reachable; legacy not resurrected").

- [ ] **Step 1:** Add assertions that, after deletion, will hold (they will FAIL until Tasks 2-4 are done — that's the TDD red state):
  - `GhostWriterApp.tsx` source contains no `writingRoomEnabled`, no `FLAGS.writingRoomShell`, and no `import ... from "@/components/panels/ChapterEditor"`.
  - The `MUST_BE_REACHABLE` list still passes (kept features remain wired).
- [ ] **Step 2:** Run `npx vitest run src/components/__tests__/live-shell-reachability.test.ts` — expect the new assertions FAIL (legacy still present), the existing ones PASS.

---

### Task 2: Delete the legacy branch from GhostWriterApp + simplify

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

- [ ] **Step 1:** Remove `import ChapterEditor from "@/components/panels/ChapterEditor";` (line 8).
- [ ] **Step 2:** Remove `const writingRoomEnabled = useFeatureIsOn(FLAGS.writingRoomShell);` and the now-unused `mobileToolbarOpen`/`setMobileToolbarOpen` state.
- [ ] **Step 3:** Simplify the derived values that referenced the flag:
  - `effectiveMode`: `const effectiveMode = actionsOpen ? mode : "write";`
  - `effectivePrompt`: `const effectivePrompt = effectiveMode === "write" ? (prompt.trim() || guideAction?.run.prompt || "Continue this scene.") : prompt;`
  - The `useEffect(() => { if (writingRoomEnabled) setLeftCollapsed(true); }, [...])` → `useEffect(() => { setLeftCollapsed(true); }, []);`
- [ ] **Step 4:** Replace the `writingRoomEnabled ? (<>…</>) : (<>…legacy…</>)` render block (lines ~511-596) with just the WritingRoom branch contents (drop the legacy `else`). Remove the `writingRoomEnabled &&` guards on the StoryBible and EntitySuggestionsChip blocks (they become unconditional).
- [ ] **Step 5:** Remove the `writingRoomEnabled` prop passed into `useAIActions` (handled in Task 4).
- [ ] **Step 6:** `npx tsc --noEmit` — fix any references until clean.

---

### Task 3: Delete legacy `panels/ChapterEditor.tsx` + sweep orphans

**Files:**
- Delete: `src/components/panels/ChapterEditor.tsx`

- [ ] **Step 1:** Confirm zero remaining importers: `grep -rn "panels/ChapterEditor" src` returns nothing.
- [ ] **Step 2:** Delete the file.
- [ ] **Step 3:** Check whether anything it uniquely imported is now orphaned (sub-components imported nowhere else). Leave shared components (e.g. `AudioNovelPanel`, used by WritingRoom too) alone. Delete only files that are now imported nowhere AND were legacy-sidebar-only.
- [ ] **Step 4:** `npx tsc --noEmit` — clean.

---

### Task 4: Remove the flag + debug log + hook param

**Files:**
- Modify: `src/lib/growthbook.ts` (remove `writingRoomShell` from `FLAGS`)
- Modify: `src/components/GrowthBookClientProvider.tsx` (remove the `writing_room_shell` debug `console.log`)
- Modify: `src/hooks/useAIActions.ts` (+ `src/hooks/ai-shared.ts` / `useGeneration` if the param threads down) — remove the now-always-true `writingRoomEnabled` param
- Modify: `src/lib/growthbook-server.ts` comment if it names the flag (cosmetic)

- [ ] **Step 1:** Remove `writingRoomShell: "writing_room_shell",` from `FLAGS`.
- [ ] **Step 2:** Remove the debug log line referencing `writing_room_shell` in `GrowthBookClientProvider.tsx`.
- [ ] **Step 3:** Trace `writingRoomEnabled` through `useAIActions`; remove the param and any branch that consumed it (it was always true in prod, so keep the true-path behavior). If it only gated prompt/mode shaping already handled in GhostWriterApp, this may be a no-op removal.
- [ ] **Step 4:** `npx tsc --noEmit` — clean. `grep -rn "writingRoomShell\|writing_room_shell\|writingRoomEnabled" src` — only comments/test-guard remain.

---

### Task 5: Clean legacy CSS

**Files:**
- Modify: `src/app/globals.css` (the `.gw-toolbar-panel` + `.mobile-toolbar-toggle` rules, ~lines 148-167)

- [ ] **Step 1:** Remove the `.gw-toolbar-panel`, `.gw-toolbar-panel.mobile-open`, and `.mobile-toolbar-toggle` rules (only used by the deleted legacy layout). Leave everything else.
- [ ] **Step 2:** `grep -rn "gw-toolbar-panel\|mobile-toolbar-toggle" src` — nothing remains.

---

### Task 6: Flow building-block tests

**Files:**
- Verify/extend existing test for `src/lib/guide/next-action.ts` (the Idea→Structure→Draft→Polish→Export ladder)
- Verify existing coverage for the reader-share route

- [ ] **Step 1:** Confirm `nextAction()`/`currentStage()` has a test asserting stage progression (new project → Idea; outline present → Structure; drafting → Draft; etc.). If absent, add one — this is the unit-level stand-in for the "New project → Idea → Outline → Draft" e2e leg.
- [ ] **Step 2:** Confirm the reader-share token route has a test (token creation + `/reader/[token]` resolution) — the "Share reader link" leg. Add if missing.
- [ ] **Step 3:** Run the new/affected tests green.

---

### Task 7: Whole-change verification

- [ ] `npx tsc --noEmit` → exit 0.
- [ ] `npx vitest run` → all files green, including the extended reachability guard now PASSING (legacy gone).
- [ ] `npx next build` → succeeds (catches any SSR/import breakage the unit tests miss).
- [ ] Commit.
