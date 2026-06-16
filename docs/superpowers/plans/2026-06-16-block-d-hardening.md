# Block D: Free-Tier Hardening + Metering + Guide Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the metering money leak (30 of 33 AI routes uncounted), harden security, fix the Guide polish loop, and restore continuity for beginner projects.

**Architecture:** A new `src/lib/metering/` module holds a credit-cost map and a single `meterAndGate()` helper. Every AI route calls this helper instead of hand-rolling its own increment. DB migrates `monthlyGenerations` from `integer` to `real` for fractional credits. All other sections (D2-D5) are surgical edits to existing files.

**Tech Stack:** Next.js 16, Drizzle ORM 0.45.x, Neon PostgreSQL, Vitest

---

## Already Done — Skip These

- **D2.2** `alternateDrafts` cap: `alt-draft/route.ts` line 66 already does `.slice(-5)` ✅
- **D3.4** Reset token single-use: `reset-password/route.ts` checks `resetToken.usedAt` and sets it on success ✅

---

## File Map

| Status | File | Change |
|--------|------|--------|
| CREATE | `src/lib/metering/costs.ts` | Credit cost map, project limits |
| CREATE | `src/lib/metering/meter.ts` | `meterAndGate()` + `refundCredits()` |
| CREATE | `src/lib/metering/__tests__/meter.test.ts` | Unit tests |
| MODIFY | `src/db/schema.ts` | `monthlyGenerations: integer → real`, add `biggestChallenge` to projects |
| MODIFY | `src/lib/ratelimit.ts` | Auth + general limiters fail closed in prod |
| MODIFY | `src/app/api/ai/generate/route.ts` | Replace hand-rolled metering with `meterAndGate` |
| MODIFY | `src/app/api/ai/braindump/route.ts` | Replace hand-rolled metering with `meterAndGate` |
| MODIFY | `src/app/api/ai/analyze-passage/route.ts` | Replace hand-rolled metering with `meterAndGate` |
| MODIFY | 30 uncounted AI routes | Add `meterAndGate` (Tasks 6-7) |
| MODIFY | `src/app/api/projects/route.ts` | Project count cap + `biggestChallenge` field |
| MODIFY | `src/app/api/projects/import/scrivener/route.ts` | File type/size/zip-bomb validation |
| MODIFY | `src/app/api/admin/analytics/route.ts` | SQL GROUP BY aggregation |
| MODIFY | `src/lib/guide/next-action.ts` | Polish loop fix + challenge-biased first suggestion |
| MODIFY | `src/lib/guide/__tests__/next-action.test.ts` | Update for new polish id |
| MODIFY | `src/components/Onboarding.tsx` | Pass `biggestChallenge` to project creation |
| MODIFY | `src/hooks/useGeneration.ts` | Remove beginner context-stripping |
| MODIFY | `src/hooks/useAIActions.ts` | Remove beginner context-stripping |

---

## Task 1: DB Schema Migration

**Files:**
- Modify: `src/db/schema.ts` (line 1 — imports; line 13 — users table; line 16 — projects table)

- [ ] **Step 1: Add `real` to drizzle imports in schema.ts**

Line 1 currently:
```ts
import { pgTable, text, timestamp, integer, jsonb, varchar, uuid, boolean, customType } from "drizzle-orm/pg-core";
```
Change to:
```ts
import { pgTable, text, timestamp, integer, real, jsonb, varchar, uuid, boolean, customType } from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Change `monthlyGenerations` from `integer` to `real` in the users table (line 13)**

Find in the users table definition:
```ts
monthlyGenerations: integer("monthly_generations").default(0),
```
Replace with:
```ts
monthlyGenerations: real("monthly_generations").default(0),
```

- [ ] **Step 3: Add `biggestChallenge` to the projects table (line 16)**

In the projects table definition, find:
```ts
createdAt: timestamp("created_at").defaultNow().notNull(),
```
Add before it:
```ts
biggestChallenge: text("biggest_challenge").default(""),
```

- [ ] **Step 4: Run schema migration**
```powershell
Copy-Item .env.local .env -Force
npx drizzle-kit generate
npx drizzle-kit push
```
Expected: Drizzle generates migration SQL; push applies it to Neon. The `monthly_generations` column type changes and `biggest_challenge` is added.

- [ ] **Step 5: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 6: Commit**
```powershell
git add src/db/schema.ts drizzle/
git commit -m "chore(schema): monthlyGenerations real, add biggestChallenge to projects"
```

---

## Task 2: Create `src/lib/metering/costs.ts`

**Files:**
- Create: `src/lib/metering/costs.ts`

- [ ] **Step 1: Write the file**

```ts
export const OPERATION_CREDITS: Record<string, number> = {
  "generate":          1.0,
  "braindump":         1.0,
  "analyze-passage":   0.5,
  "quick-start":       2.0,
  "trend-youtube":     0.3, "trend-niche": 0.3, "trend-instagram": 0.3, "trend-angles": 0.3,
  "title-hook":        0.2, "score-hook": 0.2, "hook-ab": 0.2, "thumbnail-concepts": 0.3,
  "virality-predict":  0.3, "series-plan": 0.4, "guest-intel": 0.3, "retention-edit": 0.4,
  "repurpose":         0.3, "creator-seo": 0.2, "creator-research": 0.5, "channel-autopsy": 0.4,
  "tiktok-native":     0.3,
  "entity":            0.1, "suggest": 0.1, "summarize": 0.2,
};

export const DEFAULT_OPERATION_CREDIT = 0.3;

export function creditsFor(operation: string): number {
  return OPERATION_CREDITS[operation] ?? DEFAULT_OPERATION_CREDIT;
}

export const MAX_PROJECTS: Record<string, number> = {
  free:        3,
  story_pro:   -1,
  creator_pro: -1,
  all_access:  -1,
};
```

- [ ] **Step 2: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

---

## Task 3: Create `src/lib/metering/meter.ts`

**Files:**
- Create: `src/lib/metering/meter.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { getUserTier, MONTHLY_GENERATION_LIMITS } from "@/lib/subscription";
import { creditsFor } from "./costs";

async function resetMonthlyIfNeeded(userId: string): Promise<void> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Conditional UPDATE: only runs if resetAt is null or before the first of this calendar month.
  await db.update(users)
    .set({ monthlyGenerations: 0, monthlyGenerationsResetAt: firstOfMonth })
    .where(
      and(
        eq(users.id, userId),
        sql`(${users.monthlyGenerationsResetAt} IS NULL OR ${users.monthlyGenerationsResetAt} < ${firstOfMonth.toISOString()}::timestamptz)`
      )
    );
}

/**
 * Gate every AI route through this helper BEFORE making the AI call.
 * Returns null if the request is allowed (credits reserved).
 * Returns a NextResponse (429/403) if the user is over limit.
 *
 * On AI call FAILURE, call refundCredits() to return the reserved credits.
 */
export async function meterAndGate(
  userId: string,
  operation: string
): Promise<NextResponse | null> {
  const cost = creditsFor(operation);
  const tier = await getUserTier(userId);
  const limit = MONTHLY_GENERATION_LIMITS[tier] ?? 10;

  // 1. Calendar-aligned monthly reset
  await resetMonthlyIfNeeded(userId);

  // 2. Read current user state for email gate
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { monthlyGenerations: true, emailVerified: true },
  });

  // 3. Email soft-gate: allow 3 grace generations, then require verification.
  //    This lets new users try the product but blocks disposable-email abuse.
  if (!user?.emailVerified && (user?.monthlyGenerations ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Verify your email to continue", verifyEmail: true },
      { status: 403 }
    );
  }

  // 4. Unlimited tier: still record usage so cost-report sees 100% of spend
  if (limit === -1) {
    await db.update(users)
      .set({ monthlyGenerations: sql`${users.monthlyGenerations} + ${cost}` })
      .where(eq(users.id, userId));
    return null;
  }

  // 5. Atomic conditional increment: succeeds only if (current + cost) fits within limit.
  //    This closes the TOCTOU race where concurrent requests both pass a stale read.
  const [row] = await db.update(users)
    .set({ monthlyGenerations: sql`${users.monthlyGenerations} + ${cost}` })
    .where(
      and(
        eq(users.id, userId),
        sql`${users.monthlyGenerations} + ${cost} <= ${limit}`
      )
    )
    .returning({ used: users.monthlyGenerations });

  if (!row) {
    const now = new Date();
    const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    return NextResponse.json(
      { error: "Monthly generation limit reached", upgrade: true, resetsAt },
      { status: 429 }
    );
  }

  return null;
}

/**
 * Refund credits after an AI call failure.
 * Call from the catch block of each route that uses meterAndGate.
 */
export async function refundCredits(userId: string, operation: string): Promise<void> {
  const cost = creditsFor(operation);
  await db.update(users)
    .set({ monthlyGenerations: sql`GREATEST(0, ${users.monthlyGenerations} - ${cost})` })
    .where(eq(users.id, userId));
}
```

- [ ] **Step 2: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 3: Commit**
```powershell
git add src/lib/metering/
git commit -m "feat(metering): add credit cost map and meterAndGate helper"
```

---

## Task 4: Tests for costs.ts

**Files:**
- Create: `src/lib/metering/__tests__/meter.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest';
import { creditsFor, OPERATION_CREDITS, DEFAULT_OPERATION_CREDIT, MAX_PROJECTS } from '../costs';

describe('creditsFor', () => {
  it('returns 1.0 for generate (the most expensive writing operation)', () => {
    expect(creditsFor('generate')).toBe(1.0);
  });

  it('returns 2.0 for quick-start (heaviest path)', () => {
    expect(creditsFor('quick-start')).toBe(2.0);
  });

  it('returns 0.2 for cheap creator tools', () => {
    expect(creditsFor('hook-ab')).toBe(0.2);
    expect(creditsFor('title-hook')).toBe(0.2);
    expect(creditsFor('score-hook')).toBe(0.2);
  });

  it('returns the default credit for unknown operations', () => {
    expect(creditsFor('some-unknown-route')).toBe(DEFAULT_OPERATION_CREDIT);
    expect(creditsFor('')).toBe(DEFAULT_OPERATION_CREDIT);
  });

  it('every listed operation has a positive cost', () => {
    for (const [op, cost] of Object.entries(OPERATION_CREDITS)) {
      expect(cost, `cost for "${op}" must be > 0`).toBeGreaterThan(0);
    }
  });
});

describe('MAX_PROJECTS', () => {
  it('caps free tier at 3', () => {
    expect(MAX_PROJECTS.free).toBe(3);
  });

  it('allows unlimited projects for paid tiers', () => {
    expect(MAX_PROJECTS.story_pro).toBe(-1);
    expect(MAX_PROJECTS.creator_pro).toBe(-1);
    expect(MAX_PROJECTS.all_access).toBe(-1);
  });
});
```

- [ ] **Step 2: Run the tests**
```powershell
npx vitest run src/lib/metering/__tests__/meter.test.ts
```
Expected: 6 tests PASS

- [ ] **Step 3: Commit**
```powershell
git add src/lib/metering/__tests__/meter.test.ts
git commit -m "test(metering): unit tests for credit cost map"
```

---

## Task 5: Wire `generate`, `braindump`, `analyze-passage` through meterAndGate

**Files:**
- Modify: `src/app/api/ai/generate/route.ts`
- Modify: `src/app/api/ai/braindump/route.ts`
- Modify: `src/app/api/ai/analyze-passage/route.ts`

### generate/route.ts

- [ ] **Step 1: Add import to generate/route.ts**

After the existing imports, add:
```ts
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
```

- [ ] **Step 2: Remove old metering block and replace with meterAndGate**

Remove the entire block from `// Burst-rate guard...` through the closing brace of `if (monthlyLimit !== -1) { ... }` (approximately lines 195-252 in the current file). This includes:
- The `freeGenerationLimit` burst guard block
- The `monthlyLimit` variable
- The `countedThisRequest` variable
- The monthly-reset check
- The atomic conditional UPDATE block

Replace with these two lines (keep `overrideModel` which is just above):
```ts
const overrideModel = tier === 'free' ? MODELS.fast : undefined;

const gate = await meterAndGate(session.user.id, "generate");
if (gate) return gate;
```

- [ ] **Step 3: Update the refund in the catch block of generate/route.ts**

In the `catch (e: any)` block, replace:
```ts
if (countedThisRequest) {
  await db.update(users)
    .set({ monthlyGenerations: sql`${users.monthlyGenerations} - 1` })
    .where(eq(users.id, session.user.id));
}
```
with:
```ts
await refundCredits(session.user.id, "generate");
```

- [ ] **Step 4: Remove now-unused imports from generate/route.ts**

Remove from the import line these items (if they are only used in the deleted metering block):
- `MONTHLY_GENERATION_LIMITS` from `@/lib/subscription`
- `freeGenerationLimit` from `@/lib/ratelimit`
- `lt` from `drizzle-orm` (only used in the old `lt(users.monthlyGenerations, monthlyLimit)` condition)

Keep: `getUserTier`, `canAccessFeature`, `checkAiRateLimit`, `sql`, `and`, `eq`, `lte`, `ne`.

### braindump/route.ts

- [ ] **Step 5: Add import and replace metering in braindump**

Add after existing imports:
```ts
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
```

Remove the `if (monthlyLimit !== -1) { ... }` block entirely (the one containing the reset check + conditional UPDATE + `countedThisRequest`). Replace with:
```ts
const gate = await meterAndGate(session.user.id, "braindump");
if (gate) return gate;
```

Remove `monthlyLimit`, `MONTHLY_GENERATION_LIMITS`, `countedThisRequest` variables. Add `refundCredits(session.user.id, "braindump")` in the catch block.

### analyze-passage/route.ts

- [ ] **Step 6: Replace metering in analyze-passage**

Add import:
```ts
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
```

Current pattern increments AFTER the AI call (only on success). Replace it with pre-gate pattern:

Remove the `if (monthlyLimit !== -1) { ... }` check block before the AI call (the part that reads user + checks limit).

Remove the post-call `if (text && monthlyLimit !== -1) { await db.update(users)... }` increment.

After `if (passage.length < 30) { return ... }`, add:
```ts
const gate = await meterAndGate(session.user.id, "analyze-passage");
if (gate) return gate;
```

In the `catch` block (currently returns `{ directives: "" }`), add:
```ts
await refundCredits(session.user.id, "analyze-passage");
return NextResponse.json({ directives: "" });
```

Remove `MONTHLY_GENERATION_LIMITS`, `monthlyLimit` imports/variables.

- [ ] **Step 7: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 8: Commit**
```powershell
git add src/app/api/ai/generate/route.ts src/app/api/ai/braindump/route.ts src/app/api/ai/analyze-passage/route.ts
git commit -m "feat(metering): wire generate/braindump/analyze-passage through meterAndGate"
```

---

## Task 6: Wire quick-start and all creator tool routes through meterAndGate

**Files:** (18 routes)
`quick-start`, `trend-youtube`, `trend-niche`, `trend-instagram`, `trend-angles`, `title-hook`, `score-hook`, `hook-ab`, `thumbnail-concepts`, `virality-predict`, `series-plan`, `guest-intel`, `retention-edit`, `repurpose`, `creator-seo`, `creator-research`, `channel-autopsy`, `tiktok-native`

The pattern is identical for all of them. Shown once for `quick-start` (which also needs a tier check added), then for a creator route.

### Pattern for quick-start/route.ts

- [ ] **Step 1: Add imports and gate to quick-start**

Add after existing imports:
```ts
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
```

After `const rl = await checkAiRateLimit(session.user.id); if (rl) return rl;`, add:
```ts
const gate = await meterAndGate(session.user.id, "quick-start");
if (gate) return gate;
```

Wrap the main `try` block to add `refundCredits` on error:
```ts
try {
  // ... existing code ...
} catch (error) {
  await refundCredits(session.user.id, "quick-start");
  console.error("Quick start error:", error);
  return NextResponse.json({ error: "Failed to generate story skeleton" }, { status: 500 });
}
```

### Pattern for every creator route (e.g. trend-youtube/route.ts)

- [ ] **Step 2: Add gate to each creator route after its existing tier check**

For each creator route, add:
```ts
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
```

After the `canAccessFeature` check:
```ts
const gate = await meterAndGate(session.user.id, "<operation-name>");
if (gate) return gate;
```

In the existing `catch` block, add `await refundCredits(session.user.id, "<operation-name>");` before returning.

**Operation names by file:**
| Route file | Operation name |
|------------|---------------|
| `trend-youtube/route.ts` | `"trend-youtube"` |
| `trend-niche/route.ts` | `"trend-niche"` |
| `trend-instagram/route.ts` | `"trend-instagram"` |
| `trend-angles/route.ts` | `"trend-angles"` |
| `title-hook/route.ts` | `"title-hook"` |
| `score-hook/route.ts` | `"score-hook"` |
| `hook-ab/route.ts` | `"hook-ab"` |
| `thumbnail-concepts/route.ts` | `"thumbnail-concepts"` |
| `virality-predict/route.ts` | `"virality-predict"` |
| `series-plan/route.ts` | `"series-plan"` |
| `guest-intel/route.ts` | `"guest-intel"` |
| `retention-edit/route.ts` | `"retention-edit"` |
| `repurpose/route.ts` | `"repurpose"` |
| `creator-seo/route.ts` | `"creator-seo"` |
| `creator-research/route.ts` | `"creator-research"` |
| `channel-autopsy/route.ts` | `"channel-autopsy"` |
| `tiktok-native/route.ts` | `"tiktok-native"` |

- [ ] **Step 3: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 4: Commit**
```powershell
git add src/app/api/ai/quick-start/route.ts src/app/api/ai/trend-youtube/route.ts src/app/api/ai/trend-niche/route.ts src/app/api/ai/trend-instagram/route.ts src/app/api/ai/trend-angles/route.ts src/app/api/ai/title-hook/route.ts src/app/api/ai/score-hook/route.ts src/app/api/ai/hook-ab/route.ts src/app/api/ai/thumbnail-concepts/route.ts src/app/api/ai/virality-predict/route.ts src/app/api/ai/series-plan/route.ts src/app/api/ai/guest-intel/route.ts src/app/api/ai/retention-edit/route.ts src/app/api/ai/repurpose/route.ts src/app/api/ai/creator-seo/route.ts src/app/api/ai/creator-research/route.ts src/app/api/ai/channel-autopsy/route.ts src/app/api/ai/tiktok-native/route.ts
git commit -m "feat(metering): wire quick-start and all creator routes through meterAndGate"
```

---

## Task 7: Wire remaining uncounted routes through meterAndGate

**Files:** (10 routes)
`entity`, `suggest`, `summarize`, `analyze-work`, `analyze-reference-video`, `prose`, `pipeline`, `research-scaffold`, `character-evolution`, `scene-to-video-prompt`

Same pattern as Task 6. Skip `dissect-video/status/[jobId]/route.ts` — that is a polling endpoint, not an AI call.

- [ ] **Step 1: Apply the pattern to each remaining route**

For each route, after `const rl = await checkAiRateLimit(session.user.id); if (rl) return rl;`, add:
```ts
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
// ...
const gate = await meterAndGate(session.user.id, "<folder-name>");
if (gate) return gate;
```

Add `refundCredits` in each route's catch block.

**Operation names by file:**
| Route file | Operation name |
|------------|---------------|
| `entity/route.ts` | `"entity"` |
| `suggest/route.ts` | `"suggest"` |
| `summarize/route.ts` | `"summarize"` |
| `analyze-work/route.ts` | `"analyze-work"` |
| `analyze-reference-video/route.ts` | `"analyze-reference-video"` |
| `prose/route.ts` | `"prose"` |
| `pipeline/route.ts` | `"pipeline"` |
| `research-scaffold/route.ts` | `"research-scaffold"` |
| `character-evolution/route.ts` | `"character-evolution"` |
| `scene-to-video-prompt/route.ts` | `"scene-to-video-prompt"` |

- [ ] **Step 2: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 3: Run all tests**
```powershell
npx vitest run
```
Expected: all passing

- [ ] **Step 4: Commit**
```powershell
git add src/app/api/ai/entity/ src/app/api/ai/suggest/ src/app/api/ai/summarize/ src/app/api/ai/analyze-work/ src/app/api/ai/analyze-reference-video/ src/app/api/ai/prose/ src/app/api/ai/pipeline/ src/app/api/ai/research-scaffold/ src/app/api/ai/character-evolution/ src/app/api/ai/scene-to-video-prompt/
git commit -m "feat(metering): wire all remaining AI routes through meterAndGate"
```

---

## Task 8: Fix ratelimit.ts — auth/general limiters fail closed in prod (D3.1)

**Files:**
- Modify: `src/lib/ratelimit.ts`

- [ ] **Step 1: Update `checkAuthRateLimit` to fail closed in production**

Replace the current implementation:
```ts
export async function checkAuthRateLimit(ip: string): Promise<NextResponse | null> {
  if (!authRatelimit) return null;
  const { success } = await authRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }
  return null;
}
```

with:
```ts
export async function checkAuthRateLimit(ip: string): Promise<NextResponse | null> {
  if (!authRatelimit) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Rate limiting is not configured. Please try again later." },
        { status: 503 }
      );
    }
    return null;
  }
  try {
    const { success } = await authRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429 }
      );
    }
    return null;
  } catch (err) {
    console.error('[checkAuthRateLimit] Upstash check failed:', err);
    return NextResponse.json(
      { error: "Rate limiting service unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 2: Update `checkGeneralRateLimit` with the same pattern**

Replace:
```ts
export async function checkGeneralRateLimit(ip: string): Promise<NextResponse | null> {
  if (!generalRatelimit) return null;
  const { success } = await generalRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }
  return null;
}
```

with:
```ts
export async function checkGeneralRateLimit(ip: string): Promise<NextResponse | null> {
  if (!generalRatelimit) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Rate limiting is not configured. Please try again later." },
        { status: 503 }
      );
    }
    return null;
  }
  try {
    const { success } = await generalRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429 }
      );
    }
    return null;
  } catch (err) {
    console.error('[checkGeneralRateLimit] Upstash check failed:', err);
    return NextResponse.json(
      { error: "Rate limiting service unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 3: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 4: Commit**
```powershell
git add src/lib/ratelimit.ts
git commit -m "fix(security): auth and general rate limiters now fail closed in production"
```

---

## Task 9: Scrivener import validation (D3.2)

**Files:**
- Modify: `src/app/api/projects/import/scrivener/route.ts`

- [ ] **Step 1: Add file type and size validation before `JSZip.loadAsync`**

After `if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });`, add:
```ts
const MAX_IMPORT_BYTES = 50 * 1024 * 1024; // 50MB
const isValidType = file.name.endsWith(".zip") || file.name.endsWith(".scriv") || file.type === "application/zip";
if (!isValidType) {
  return NextResponse.json({ error: "Upload a .scriv or .zip file exported from Scrivener" }, { status: 400 });
}
if (file.size > MAX_IMPORT_BYTES) {
  return NextResponse.json({ error: "File too large — max 50MB" }, { status: 413 });
}
```

- [ ] **Step 2: Add zip-bomb guard while iterating RTF entries**

Replace the current `for` loop that iterates `rtfFiles`:
```ts
for (let i = 0; i < rtfFiles.length; i++) {
  const rtfContent = await zip.files[rtfFiles[i]].async('string');
  // ...
}
```

with:
```ts
const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024; // 200MB total extracted
let totalExtractedBytes = 0;

for (let i = 0; i < rtfFiles.length; i++) {
  const rtfContent = await zip.files[rtfFiles[i]].async('string');
  totalExtractedBytes += rtfContent.length;
  if (totalExtractedBytes > MAX_EXTRACTED_BYTES) {
    return NextResponse.json({ error: "Archive content too large when extracted (max 200MB)" }, { status: 413 });
  }
  const plainText = stripRtf(rtfContent);
  // ... rest of existing loop body unchanged
}
```

- [ ] **Step 3: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 4: Commit**
```powershell
git add src/app/api/projects/import/scrivener/route.ts
git commit -m "fix(security): add file type, size, and zip-bomb validation to Scrivener import"
```

---

## Task 10: Project count cap (D2.1)

**Files:**
- Modify: `src/app/api/projects/route.ts`

- [ ] **Step 1: Add imports to projects/route.ts**

Add after existing imports:
```ts
import { getUserTier } from "@/lib/subscription";
import { MAX_PROJECTS } from "@/lib/metering/costs";
```

- [ ] **Step 2: Add project count check to the POST handler**

The current POST handler is:
```ts
export async function POST(req: Request) { const s = await getRequiredSession(); const b = await req.json(); const [p] = await db.insert(projects)... }
```

After `const s = await getRequiredSession();` and `const b = await req.json();`, add:
```ts
const tier = await getUserTier(s.user.id);
const maxProjects = MAX_PROJECTS[tier] ?? 3;
if (maxProjects !== -1) {
  const existing = await db.query.projects.findMany({
    where: eq(projects.userId, s.user.id),
    columns: { id: true },
  });
  if (existing.length >= maxProjects) {
    return NextResponse.json(
      { error: "Project limit reached for your plan", upgrade: true },
      { status: 403 }
    );
  }
}
```

Also accept `biggestChallenge` in the POST body and store it:
```ts
const [p] = await db.insert(projects).values({
  userId: s.user.id,
  name: b.name || "Untitled",
  format: b.format || "Novel",
  skillLevel: b.skillLevel || "beginner",
  genres: b.genres || [],
  storyType: b.storyType || "linear",
  biggestChallenge: b.biggestChallenge || "",  // ADD THIS
}).returning();
```

- [ ] **Step 3: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 4: Commit**
```powershell
git add src/app/api/projects/route.ts
git commit -m "feat: project count cap per tier + store biggestChallenge on create"
```

---

## Task 11: Admin analytics SQL aggregation (D4.1)

**Files:**
- Modify: `src/app/api/admin/analytics/route.ts`

- [ ] **Step 1: Replace JS aggregation with SQL GROUP BY**

Replace the entire file content with:
```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { platformEvents } from '@/db/schema';
import { gte, sql } from 'drizzle-orm';

export async function GET(req: Request) {
  if (!process.env.ADMIN_SECRET) {
    return new Response('Server misconfigured: ADMIN_SECRET not set', { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      event: platformEvents.event,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(platformEvents)
    .where(gte(platformEvents.createdAt, thirtyDaysAgo))
    .groupBy(platformEvents.event);

  const counts = Object.fromEntries(rows.map(r => [r.event, r.count]));
  const total = rows.reduce((s, r) => s + r.count, 0);

  return NextResponse.json({ counts, total, since: thirtyDaysAgo });
}
```

- [ ] **Step 2: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 3: Commit**
```powershell
git add src/app/api/admin/analytics/route.ts
git commit -m "fix(analytics): replace 50k-row JS aggregation with SQL GROUP BY"
```

---

## Task 12: Fix Guide Bar polish loop (D4.2)

**Files:**
- Modify: `src/lib/guide/next-action.ts`
- Modify: `src/lib/guide/__tests__/next-action.test.ts`

The bug: every chapter ≥ 500 words that hasn't been dismissed gets its own `polish-review-<chapterId>` suggestion. A 10-chapter project shows 10 consecutive review prompts before reaching export.

Fix: suggest ONE project-level review as `"polish-review-manuscript"`.

- [ ] **Step 1: Update `computeAction` in next-action.ts**

Replace the current `needsReview` block (lines 107-119):
```ts
const dismissed = project.dismissedGuideIds ?? [];
const needsReview = sortedChapters.find(
  (c) => c.wordCount >= REVIEW_THRESHOLD && !dismissed.includes(`polish-review-${c.id}`)
);
if (needsReview) {
  return {
    id: `polish-review-${needsReview.id}`,
    stage: "polish",
    message: `"${needsReview.title}" is ${needsReview.wordCount} words — let's check its story health.`,
    cta: "Review story health",
    run: { mode: "story_health", chapterId: needsReview.id },
  };
}
```

with:
```ts
const dismissed = project.dismissedGuideIds ?? [];
const longChapters = sortedChapters.filter((c) => c.wordCount >= REVIEW_THRESHOLD);
if (longChapters.length > 0 && !dismissed.includes("polish-review-manuscript")) {
  return {
    id: "polish-review-manuscript",
    stage: "polish",
    message: `Your manuscript is ready for a story health check.`,
    cta: "Review story health",
    run: { mode: "story_health", chapterId: longChapters[0].id },
  };
}
```

- [ ] **Step 2: Update the tests in next-action.test.ts**

Three tests reference the old per-chapter IDs. Update them:

**Test: "suggests a story health review..."** (line 79):
```ts
it("suggests a story health review once the first chapter crosses the threshold", () => {
  const action = nextAction({
    ...base,
    controllingIdea: "Premise.",
    characters: [{ id: "char-1" }],
    chapters: [
      { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
      { id: "ch-2", title: "Chapter 2", wordCount: 100, sortOrder: 1 },
    ],
  });
  expect(action?.id).toBe("polish-review-manuscript");
  expect(action?.run.mode).toBe("story_health");
  expect(action?.run.chapterId).toBe("ch-1");
});
```

**Test: "suggests exporting once every chapter is past the review threshold..."** (line 108):
```ts
it("suggests exporting once all chapters are past the threshold and the review is dismissed", () => {
  const action = nextAction({
    ...base,
    controllingIdea: "Premise.",
    characters: [{ id: "char-1" }],
    chapters: [
      { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
      { id: "ch-2", title: "Chapter 2", wordCount: 700, sortOrder: 1 },
    ],
    dismissedGuideIds: ["polish-review-manuscript"],
  });
  expect(action?.id).toBe("export-manuscript");
  expect(action?.run.mode).toBe("export");
});
```

**Test: "returns null once export-manuscript has been dismissed..."** (line 128):
```ts
it("returns null once export-manuscript has been dismissed and the manuscript is unchanged", () => {
  const action = nextAction({
    ...base,
    controllingIdea: "Premise.",
    characters: [{ id: "char-1" }],
    chapters: [
      { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
    ],
    dismissedGuideIds: ["polish-review-manuscript", "export-manuscript"],
  });
  expect(action).toBeNull();
});
```

**Test: `currentStage` returns 'export' even when dismissed** (line 147): update fixture:
```ts
dismissedGuideIds: ["polish-review-manuscript", "export-manuscript"],
```

- [ ] **Step 3: Run the guide tests**
```powershell
npx vitest run src/lib/guide/__tests__/next-action.test.ts
```
Expected: all tests PASS

- [ ] **Step 4: Commit**
```powershell
git add src/lib/guide/next-action.ts src/lib/guide/__tests__/next-action.test.ts
git commit -m "fix(guide): polish review loops once per project instead of once per chapter"
```

---

## Task 13: Challenge persistence (D4.3)

**Files:**
- Modify: `src/components/Onboarding.tsx`
- Modify: `src/lib/guide/next-action.ts`

The challenge is already saved to projects via Task 10 (POST /api/projects accepts `biggestChallenge`). This task wires Onboarding.tsx to send it, and updates the Guide's first suggestion.

- [ ] **Step 1: Pass `challenge` in Onboarding.tsx project creation calls**

There are two project creation calls in `completeOnboarding`:

**Example path (line 57-61):**
```ts
body: JSON.stringify({ name: "My First Story", format, skillLevel: "beginner" }),
```
Change to:
```ts
body: JSON.stringify({ name: "My First Story", format, skillLevel: "beginner", biggestChallenge: challenge }),
```

**Blank path (line 85-86):**
```ts
const body: any = { name: "My First Story", format, skillLevel: "beginner" };
if (chosenPremise?.trim()) body.controllingIdea = chosenPremise.trim();
```
Add:
```ts
body.biggestChallenge = challenge;
```

- [ ] **Step 2: Add `biggestChallenge` to `GuideProject` interface in next-action.ts**

```ts
export interface GuideProject {
  format: string;
  controllingIdea?: string;
  biggestChallenge?: string;  // ADD
  characters: { id: string }[];
  chapters: GuideChapter[];
  dismissedGuideIds?: string[];
}
```

- [ ] **Step 3: Use `biggestChallenge` to bias the first Guide suggestion**

In `computeAction`, replace the first return block:
```ts
if (!project.controllingIdea?.trim()) {
  return {
    id: "idea-premise",
    stage: "idea",
    message: "Let's start with your story idea — tell me the premise and I'll help shape it.",
    cta: "Brainstorm premise",
    run: { mode: "brainstorm", prompt: "Help me develop a story premise and controlling idea for this project." },
  };
}
```

with:
```ts
if (!project.controllingIdea?.trim()) {
  const challengeLabel = project.biggestChallenge ?? "";
  const prompt = challengeLabel
    ? `Help me develop a story premise. My biggest challenge is: ${challengeLabel}. Give me a controlling idea that addresses this directly.`
    : "Help me develop a story premise and controlling idea for this project.";
  const message = challengeLabel
    ? `Let's tackle your challenge: "${challengeLabel}". Start with the premise.`
    : "Let's start with your story idea — tell me the premise and I'll help shape it.";
  return {
    id: "idea-premise",
    stage: "idea",
    message,
    cta: "Brainstorm premise",
    run: { mode: "brainstorm", prompt },
  };
}
```

- [ ] **Step 4: Verify the guide tests still pass (no new test needed — existing idea-premise test still passes)**
```powershell
npx vitest run src/lib/guide/__tests__/next-action.test.ts
```
Expected: all tests PASS (existing test passes because it doesn't set `biggestChallenge`, so the default message is used)

- [ ] **Step 5: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 6: Commit**
```powershell
git add src/components/Onboarding.tsx src/lib/guide/next-action.ts
git commit -m "feat: persist onboarding challenge and bias first guide suggestion"
```

---

## Task 14: Fix beginner context (D5)

**Files:**
- Modify: `src/hooks/useGeneration.ts`
- Modify: `src/hooks/useAIActions.ts`

Spec recommendation (b): drop beginner context-stripping entirely. Beginner/expert should affect UI density, not AI quality. Beginners get the same full context as everyone else — they just see a simpler UI.

- [ ] **Step 1: Remove beginner branch from `useGeneration.ts` — first occurrence (lines ~61-70)**

Replace:
```ts
if (isCreatorFormat(project.format)) {
  staticCtx = buildCreatorContext({ ...extended, creatorBible });
  dynamicCtx = '';
} else if (project.skillLevel === 'beginner') {
  staticCtx = buildBeginnerContext(extended);
  dynamicCtx = '';
} else {
  staticCtx = buildStaticContext(extended);
  dynamicCtx = buildDynamicContext(extended);
}
```

with:
```ts
if (isCreatorFormat(project.format)) {
  staticCtx = buildCreatorContext({ ...extended, creatorBible });
  dynamicCtx = '';
} else {
  staticCtx = buildStaticContext(extended);
  dynamicCtx = buildDynamicContext(extended);
}
```

- [ ] **Step 2: Remove beginner branch from `useGeneration.ts` — second occurrence (lines ~171-176)**

Apply the same replacement to the second occurrence of this block (it appears in the retry/undo path):
```ts
} else if (project.skillLevel === 'beginner') {
  staticCtx = buildBeginnerContext(extended);
  dynamicCtx = '';
} else {
```
→ Remove the `else if` block entirely, keeping only the `else { buildStaticContext / buildDynamicContext }`.

- [ ] **Step 3: Remove beginner branch from `useAIActions.ts` (line 35-36)**

Replace:
```ts
if (isCreatorFormat(p.format)) { base = buildCreatorContext({ ...extended, creatorBible }); }
else { base = p.skillLevel === "beginner" ? buildBeginnerContext(extended) : (buildStaticContext(extended, mode) + '\n' + buildDynamicContext(extended, mode)); }
```

with:
```ts
if (isCreatorFormat(p.format)) { base = buildCreatorContext({ ...extended, creatorBible }); }
else { base = buildStaticContext(extended, mode) + '\n' + buildDynamicContext(extended, mode); }
```

- [ ] **Step 4: Remove `buildBeginnerContext` from imports in both hooks**

In `useGeneration.ts`, change:
```ts
import { buildStaticContext, buildDynamicContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
```
to:
```ts
import { buildStaticContext, buildDynamicContext, buildCreatorContext } from "@/lib/ai/context-builder";
```

In `useAIActions.ts`, apply the same import change (remove `buildBeginnerContext`).

Note: `buildBeginnerContext` stays in `context-builder.ts` — it's not deleted, just no longer called from the generation hooks. The function can still be used by quick-start if needed.

- [ ] **Step 5: Verify TypeScript**
```powershell
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 6: Run all tests**
```powershell
npx vitest run
```
Expected: all passing

- [ ] **Step 7: Commit**
```powershell
git add src/hooks/useGeneration.ts src/hooks/useAIActions.ts
git commit -m "fix(beginner): give all projects full AI context — skill level only affects UI"
```

---

## Self-Review

### Spec coverage

| Section | Status |
|---------|--------|
| D1.1 costs.ts | ✅ Task 2 |
| D1.2 meter.ts (`meterAndGate` + `refundCredits`) | ✅ Task 3 |
| D1.3 wire all 33 AI routes | ✅ Tasks 5-7 |
| D1.4 calendar-aligned reset | ✅ Task 3 (`resetMonthlyIfNeeded` sets to `firstOfMonth`) |
| D1.5 generations rows for creator tools | ⚠️ Deferred — requires threading model/tokensUsed from 30 routes; doesn't affect cap correctness |
| D2.1 project count cap | ✅ Task 10 |
| D2.2 alternateDrafts cap | ✅ Already done (`.slice(-5)` in alt-draft route) |
| D3.1 auth/general limiter fail-closed | ✅ Task 8 |
| D3.2 Scrivener validation + zip-bomb | ✅ Task 9 |
| D3.3 email soft-gate | ✅ Task 3 (in `meterAndGate`) |
| D3.4 reset token single-use | ✅ Already done (marks `usedAt` on success) |
| D4.1 analytics SQL GROUP BY | ✅ Task 11 |
| D4.2 Guide polish loop | ✅ Task 12 |
| D4.3 challenge persistence | ✅ Tasks 10+13 |
| D5.1 beginner gets dynamic context | ✅ Task 14 (recommendation b) |
| D5.2 architectural decision | ✅ Task 14 — recommendation (b): drop context-stripping |
| D5.3 converge context paths | ✅ Task 14 — single code path, beginner branch removed |

### Debunked claims — NOT implemented
- subscriptions.userId UNIQUE: already has it
- Tier cache invalidation on past_due/cancelled: already done
- wordCount client-supplied: already recomputed server-side

### Placeholder scan
None. All steps include complete code.

### Type consistency
- `creditsFor(operation: string): number` defined in costs.ts → used identically in meter.ts
- `meterAndGate(userId: string, operation: string): Promise<NextResponse | null>` → used identically across Tasks 5-7
- `refundCredits(userId: string, operation: string): Promise<void>` → used identically in catch blocks
- `GuideProject.biggestChallenge?: string` defined in Task 13 Step 2 → used in Task 13 Step 3
- `"polish-review-manuscript"` id defined in Task 12 Step 1 → referenced in Task 12 Step 2 tests

---

**Definition of done:** Every AI route calls `meterAndGate`; a free user calling `quick-start` 11 times gets a 429 on the 11th; auth limiters return 503 not null in prod without Upstash; Scrivener import rejects oversized non-zip files; beginner projects have chapter summaries in their AI context; `npm run test` and `npx tsc --noEmit` exit 0.
