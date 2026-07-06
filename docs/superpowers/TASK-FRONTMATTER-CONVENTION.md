# Task frontmatter convention for SDD plans

Pattern extracted (not copied) from `automazeio/ccpm` — see `docs/2026-07-06-repo-research-findings.md`. CCPM decomposes work as PRD → epic → tasks, where each task carries `depends_on`/`parallel`/`conflicts_with` frontmatter and executes via git-worktree-isolated parallel subagents. This repo already runs Subagent-Driven Development (every file under `docs/superpowers/plans/` and `docs/superpowers/specs/`) but the dependency structure between tasks has always been *implicit* — task order in the doc *is* the dependency order, and whether two tasks could safely run in parallel was a judgment call made fresh each time, not written down.

## The convention

Every `### Task N: <title>` header in a plan file gets a one-line frontmatter comment directly beneath it:

```markdown
### Task 4: `StageRoleRail` — direct-click routing for the 3 new action types
<!-- depends_on: [1, 2] · parallel: false · conflicts_with: [] -->
```

| Field | Meaning |
|---|---|
| `depends_on` | Task numbers that must be **complete and merged** before this one starts. `[]` means it can start immediately. |
| `parallel` | `true` if this task has no file-overlap with any other task at the same dependency depth and could run in an isolated worktree alongside them. `false` if it touches shared state/files another concurrent task also touches. |
| `conflicts_with` | Task numbers this one must **not** run concurrently with, even if `depends_on` would otherwise allow it — e.g. two tasks that both edit the same file, even if neither depends on the other's output. |

## When to use it

Add frontmatter when a plan has **4 or more tasks** and at least two of them are plausibly independent (e.g. one edits a backend route, another edits an unrelated UI component). For a short, purely sequential plan (each task strictly builds on the last), the frontmatter is redundant — skip it; every task implicitly `depends_on` the previous one and `parallel: false`.

## What it changes in practice

When planning a multi-task SDD pass, group tasks by dependency depth (`depends_on` satisfied) and check `parallel`/`conflicts_with` before deciding whether to dispatch that depth's tasks as concurrent subagents (Agent tool, `isolation: "worktree"` when they'd otherwise conflict on the same files) or run them one at a time in the same session. This makes the parallelization decision an explicit, written-down judgment call instead of something re-derived from scratch on every plan.

## Worked example

```markdown
### Task 1: Add `densityLevel` column to `projects` table
<!-- depends_on: [] · parallel: false · conflicts_with: [] -->

### Task 2: `useDensity()` hook — project-scoped mode
<!-- depends_on: [1] · parallel: true · conflicts_with: [] -->

### Task 3: PATCH route allowlist entry for `densityLevel`
<!-- depends_on: [1] · parallel: true · conflicts_with: [] -->

### Task 4: `ToolbarPanel` wiring (consumes both Task 2 and Task 3)
<!-- depends_on: [2, 3] · parallel: false · conflicts_with: [] -->
```

Tasks 2 and 3 both depend only on Task 1, touch different files (`src/hooks/useDensity.ts` vs. the PATCH route), and don't conflict — they can be dispatched as two concurrent subagents once Task 1 lands. Task 4 must wait for both.
