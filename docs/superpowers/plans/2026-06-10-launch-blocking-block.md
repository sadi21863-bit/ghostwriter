# Launch-Blocking Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close both launch-blocking security holes — every user gets a `subscriptions` row from day one, and subscription tier is verified server-side from Razorpay rather than trusted from the client — ship the 7-day Story Pro trial backend, make AI rate limiting fail closed in production, and fully remove the dead Stripe integration. This is the gate: nothing else in Sprint 25 ships until every task here passes.

**Architecture:** Every place a user account can be created (manual registration today, the NextAuth adapter for future OAuth providers) now also inserts a `subscriptions` row using the schema defaults (`tier: "free"`, `status: "active"`). The Razorpay verify route and webhook switch from `UPDATE ... WHERE userId = ...` to `INSERT ... ON CONFLICT (userId) DO UPDATE`, so they self-heal even if a row is somehow missing, and both now derive `tier` exclusively from the Razorpay subscription's `notes` (set server-side at subscription creation in `POST /api/subscription`), never from the client request body. A new `users.trial_end_at` column drives a 7-day Story Pro trial: `getUserTier()` and `GET /api/subscription` both treat an unexpired trial as `tier: "story_pro"` / `status: "trialing"`, which the existing trial countdown banner (`GhostWriterApp.tsx`) and settings badge already render — this is a backend-only change. `checkAiRateLimit` fails closed (503) in production if Upstash is unreachable or unconfigured, instead of silently allowing unlimited Opus/Sonnet requests. Finally, the abandoned Stripe integration (routes, types, deps, env vars, UI/legal copy) is removed now that Razorpay is the sole payment provider (Sprint 24).

**Tech Stack:** Next.js 16 (App Router route handlers), Drizzle ORM 0.45.x + Neon Postgres, NextAuth 4 (JWT strategy, Drizzle adapter), Razorpay Node SDK, Upstash Ratelimit/Redis, Vitest. Windows PowerShell for shell commands; all commands run from the `ghostwriter/` project root (the git repo root).

---

## File Structure

| File | Change |
|---|---|
| `src/db/schema.ts` | Add `trialEndAt` column to `users` table |
| `src/app/api/auth/register/route.ts` | Seed `subscriptions` row + set `trialEndAt` on registration |
| `src/lib/auth.ts` | `events.createUser` seeds `subscriptions` row (OAuth future-proofing) |
| `src/app/api/subscription/verify/route.ts` | Derive `tier` from Razorpay `notes` (not client body), reject mismatched `userId`, upsert `subscriptions` |
| `src/app/api/webhooks/razorpay/route.ts` | Upsert `subscriptions` in `activateSubscription` |
| `scripts/backfill-subscriptions.js` | New — backfill `subscriptions` rows for existing users |
| `src/lib/subscription.ts` | `getUserTier()` grants `story_pro` during an active trial |
| `src/app/api/subscription/route.ts` | `GET` returns `status: "trialing"` + trial end date during trial |
| `src/lib/ratelimit.ts` | `checkAiRateLimit` fails closed (503) in production |
| `src/lib/env-check.ts` | Add `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` to required vars |
| `src/app/api/subscription/portal/route.ts` | Delete (Stripe billing portal, dead) |
| `src/app/api/webhooks/stripe/route.ts` | Delete (Stripe webhook, dead) |
| `src/types/subscription.ts` | Remove `STRIPE_PRICES` |
| `src/app/api/ai/__tests__/subscription.test.ts` | Replace `STRIPE_PRICES` test block with `RAZORPAY_PLANS` |
| `package.json` | Remove `stripe` and `@stripe/stripe-js` deps |
| `.env.local.example` | Remove Stripe env var block |
| `src/components/upgrade/UpgradePrompt.tsx` | "Stripe" → "Razorpay" in fine print |
| `src/app/privacy/page.tsx` | "Stripe" → "Razorpay" in privacy copy |
| `src/app/terms/page.tsx` | "Stripe" → "Razorpay" in terms copy |

---

## Task Order Rationale

Task 1 adds the `trialEndAt` column and pushes it to the database — this must land first because Task 2 (registration) and Task 7 (`getUserTier`/`GET /api/subscription`) both read/write that column, at compile time (TypeScript) and at runtime (Postgres). Tasks 2–6 are CRITICAL 1 (subscription-row seeding) and CRITICAL 2 (server-side tier verification), grouped by file. Task 7 is the trial logic (C-2). Task 8 is the manual Razorpay test-mode walkthrough that exercises Tasks 2–7 end to end. Task 9 is the rate-limiter fail-closed fix (A-HIGH 3), independent of the subscription work. Tasks 10–12 are the Stripe removal (C-1), done last since they only delete dead code and copy — nothing else depends on them.

---

### Task 1: Add `trialEndAt` column to `users` and push the migration

**Files:**
- Modify: `src/db/schema.ts:13`

- [ ] **Step 1: Add the column to the `users` table definition**

`src/db/schema.ts` line 13 is a single-line `pgTable` definition. Add `trialEndAt: timestamp("trial_end_at")` immediately before `createdAt`:

```typescript
export const users = pgTable("users", { id: uuid("id").defaultRandom().primaryKey(), name: text("name"), email: text("email").notNull().unique(), emailVerified: timestamp("email_verified", { mode: "date" }), image: text("image"), hashedPassword: text("hashed_password"), higgsfieldApiKey: text("higgsfield_api_key").default(""), higgsfieldApiSecret: text("higgsfield_api_secret").default(""), openaiApiKey: text("openai_api_key").default(""), imageProviderId: text("image_provider_id").default("segmind_soul"), trendIntelligenceKey: text("trend_intelligence_key").default(""), referralCode: varchar("referral_code", { length: 12 }), monthlyGenerations: integer("monthly_generations").default(0), monthlyGenerationsResetAt: timestamp("monthly_generations_reset_at"), trialEndAt: timestamp("trial_end_at"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 3: Push the schema change to the database**

From the `ghostwriter/` directory (Windows PowerShell):

```powershell
Copy-Item .env.local .env -Force
npx drizzle-kit push
```

Expected: drizzle-kit reports adding column `trial_end_at` (timestamp, nullable) to table `users`. This is a purely additive nullable column — no data loss warning, no rename-vs-create prompt should appear. If a prompt does appear asking whether this is a new column vs. a rename, choose "create column".

- [ ] **Step 4: Re-run the index script as an idempotent sanity check**

```powershell
node scripts/add-indexes.js
```

Expected: the script reports all indexes already exist (no-op). This confirms the DB connection from `.env` works and prior schema work is intact before building on top of it.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "schema: add users.trial_end_at for 7-day trial"
```

---

### Task 2: Seed `subscriptions` row and set `trialEndAt` on registration (CRITICAL 1a + C-2)

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

This is the manual registration flow (`/api/auth/register`, used by the credentials sign-up form). Today it inserts a `users` row but never inserts a matching `subscriptions` row, so `getUserTier()` only "works" by accident (it falls back to `"free"` when no row exists). This task gives every new user an explicit `subscriptions` row (`tier: "free"`, `status: "active"` — both schema defaults) and starts their 7-day trial clock.

- [ ] **Step 1: Import `subscriptions`**

In `src/app/api/auth/register/route.ts`, change line 5:

```typescript
import { users, referrals } from "@/db/schema";
```

to:

```typescript
import { users, referrals, subscriptions } from "@/db/schema";
```

- [ ] **Step 2: Set `trialEndAt` on the new user and seed the subscription row**

Replace this block (current lines 32–38):

```typescript
  const hashedPassword = await bcrypt.hash(password, 12);
  const referralCode = randomBytes(6).toString("hex").toUpperCase();
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: name?.trim() || null, hashedPassword, referralCode })
    .returning({ id: users.id, email: users.email, name: users.name });

  // Link referrer if a valid ref code was provided
```

with:

```typescript
  const hashedPassword = await bcrypt.hash(password, 12);
  const referralCode = randomBytes(6).toString("hex").toUpperCase();
  const trialEndAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: name?.trim() || null, hashedPassword, referralCode, trialEndAt })
    .returning({ id: users.id, email: users.email, name: users.name });

  await db.insert(subscriptions).values({ userId: user.id });

  // Link referrer if a valid ref code was provided
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 4: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass (no existing test covers `/api/auth/register`, so this just confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "fix: seed subscriptions row and start 7-day trial on registration"
```

---

### Task 3: Seed `subscriptions` row via NextAuth `events.createUser` (CRITICAL 1b)

**Files:**
- Modify: `src/lib/auth.ts`

`src/app/api/auth/register/route.ts` (Task 2) handles the credentials sign-up flow, which inserts `users` rows directly — NextAuth's adapter `createUser` is never called for it. But `authOptions` uses `DrizzleAdapter`, which means if an OAuth provider is ever added (Google, GitHub, etc.), the adapter will call its own `createUser` and bypass the register route entirely. `events.createUser` is the one hook that fires for *every* adapter-created user regardless of provider, so it's the correct place to guarantee a `subscriptions` row exists for those future users too. `onConflictDoNothing()` makes this safe even if a row already exists.

- [ ] **Step 1: Import `subscriptions`**

In `src/lib/auth.ts`, change line 8:

```typescript
import { users } from "@/db/schema";
```

to:

```typescript
import { users, subscriptions } from "@/db/schema";
```

- [ ] **Step 2: Add the `events.createUser` hook**

Replace the end of the `authOptions` object (current lines 36–46):

```typescript
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },
};
```

with:

```typescript
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      await db.insert(subscriptions).values({ userId: user.id }).onConflictDoNothing();
    },
  },
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 4: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "fix: seed subscriptions row via NextAuth events.createUser for future OAuth users"
```

---

### Task 4: Verify route — derive tier from Razorpay `notes`, reject mismatched user, upsert (CRITICAL 1c + CRITICAL 2)

**Files:**
- Modify: `src/app/api/subscription/verify/route.ts`

This is the most important fix in the plan. Today, `POST /api/subscription/verify` trusts a `tier` field sent by the client and `UPDATE`s the `subscriptions` row for `session.user.id` — a malicious client could send `{ tier: "all_access", ... }` with a *valid* signature for a *cheap* subscription and get upgraded to the most expensive tier for free, as long as the signature itself (computed from `payment_id|subscription_id`) checks out. The fix: ignore the client-supplied `tier` entirely. Fetch the Razorpay subscription server-side and read `tier` from its `notes`, which were set server-side in `POST /api/subscription` (`notes: { userId, tier, billingPeriod }`) and cannot be edited by the client. Also reject the request with 403 if `notes.userId` doesn't match the logged-in user — otherwise a user could replay someone else's `subscription_id`/`payment_id`/`signature` (all of which are visible in their own browser network tab during checkout) against their own session... no wait, the signature is keyed to that specific `payment_id|subscription_id` pair, so a replay would need the *victim's* signature too — but checking `notes.userId` is a cheap, defense-in-depth guard against any future loosening of that constraint, and is explicitly required by CRITICAL 2.

The `UPDATE ... WHERE userId = ...` becomes `INSERT ... ON CONFLICT (userId) DO UPDATE` so this route also self-heals if Tasks 2/3 somehow didn't run for this user (e.g., an account created before this deploy and not yet backfilled — see Task 6).

- [ ] **Step 1: Remove the client-supplied `tier` from the request body**

Replace this block (current lines 29–39):

```typescript
  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    tier,
  } = await req.json() as {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
    tier: SubscriptionTier;
  };
```

with:

```typescript
  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
  } = await req.json() as {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  };
```

- [ ] **Step 2: Validate `notes.userId` and derive `tier` from `notes.tier`, then upsert**

Replace this block (current lines 60–69):

```typescript
  const razorpaySub = await razorpay.subscriptions.fetch(razorpay_subscription_id);

  await db.update(subscriptions).set({
    razorpaySubscriptionId: razorpay_subscription_id,
    razorpayPaymentId: razorpay_payment_id,
    tier,
    status: "active",
    currentPeriodEnd: razorpaySub.current_end ? new Date(razorpaySub.current_end * 1000) : null,
    updatedAt: new Date(),
  }).where(eq(subscriptions.userId, session.user.id));
```

with:

```typescript
  const razorpaySub = await razorpay.subscriptions.fetch(razorpay_subscription_id);

  // CRITICAL: tier comes from the Razorpay subscription's notes (set server-side at
  // creation in POST /api/subscription), never from the client request body.
  if (razorpaySub.notes?.userId !== session.user.id) {
    return NextResponse.json({ error: "Subscription does not belong to this user" }, { status: 403 });
  }
  const tier = (razorpaySub.notes?.tier ?? "free") as SubscriptionTier;

  await db.insert(subscriptions).values({
    userId: session.user.id,
    razorpaySubscriptionId: razorpay_subscription_id,
    razorpayPaymentId: razorpay_payment_id,
    tier,
    status: "active",
    currentPeriodEnd: razorpaySub.current_end ? new Date(razorpaySub.current_end * 1000) : null,
  }).onConflictDoUpdate({
    target: subscriptions.userId,
    set: {
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpayPaymentId: razorpay_payment_id,
      tier,
      status: "active",
      currentPeriodEnd: razorpaySub.current_end ? new Date(razorpaySub.current_end * 1000) : null,
      updatedAt: new Date(),
    },
  });
```

The rest of the function (`invalidateTierCache`, `track(...)`, confirmation email, referral reward block, final `NextResponse.json({ success: true, tier })`) is unchanged — `tier` is now a `const` derived from Razorpay instead of from the request body, but it's the same name and type (`SubscriptionTier`), so every downstream reference still compiles.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors. (`razorpaySub.notes` is typed `IMap<string | number> | undefined` by the Razorpay SDK; `notes?.tier ?? "free"` is `string | number`, and `SubscriptionTier` is a subtype of `string`, so the `as SubscriptionTier` cast is valid. `notes?.userId` is `string | number | undefined`, which overlaps with `session.user.id: string`, so the `!==` comparison is valid.)

- [ ] **Step 4: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/subscription/verify/route.ts
git commit -m "fix: verify route derives tier from Razorpay notes, not client body (CRITICAL)"
```

---

### Task 5: Webhook route — upsert `subscriptions` in `activateSubscription` (CRITICAL 1c)

**Files:**
- Modify: `src/app/api/webhooks/razorpay/route.ts`

`activateSubscription()` handles the `subscription.activated` webhook event and already reads `tier` from `sub.notes?.tier` (this part is correct, per the audit). It currently does `UPDATE ... WHERE userId = ...`, which silently no-ops if the `subscriptions` row doesn't exist yet (e.g., a pre-existing user who hasn't been backfilled — Task 6 — and whose `subscription.activated` webhook arrives before the verify route runs). Converting to upsert makes this handler self-healing, matching Task 4's fix to the verify route.

- [ ] **Step 1: Convert the update to an upsert**

Replace this block (current lines 43–49):

```typescript
  await db.update(subscriptions).set({
    razorpaySubscriptionId: sub.id,
    tier,
    status: "active",
    currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
    updatedAt: new Date(),
  }).where(eq(subscriptions.userId, userId));
```

with:

```typescript
  await db.insert(subscriptions).values({
    userId,
    razorpaySubscriptionId: sub.id,
    tier,
    status: "active",
    currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
  }).onConflictDoUpdate({
    target: subscriptions.userId,
    set: {
      razorpaySubscriptionId: sub.id,
      tier,
      status: "active",
      currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
      updatedAt: new Date(),
    },
  });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 3: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/razorpay/route.ts
git commit -m "fix: razorpay webhook upserts subscriptions row instead of update-only"
```

---

### Task 6: Backfill `subscriptions` rows for existing users (CRITICAL 1d)

**Files:**
- Create: `scripts/backfill-subscriptions.js`

Tasks 2–5 ensure every *new* row (new user, or any user who completes a Razorpay checkout / webhook) gets a `subscriptions` row. This script is the one-time catch-up for users who registered *before* this deploy and have never touched the subscription flow — they currently have zero rows in `subscriptions`. Without this, `getUserTier()` still returns `"free"` for them (the existing `if (sub)` guard falls through to the `"free"` default), so there's no user-facing breakage — but leaving them rowless means analytics/admin queries that join or count `subscriptions` will silently exclude them, and Task 7's trial check (a separate query against `users.trialEndAt`, which will be `NULL` for these pre-existing accounts) correctly gives them no trial either way.

This follows the existing standalone-script convention (`scripts/seed-work-packets.js`, `scripts/add-indexes.js`): plain `.js`, `dotenv` loads `.env.local`, raw SQL via `@neondatabase/serverless`, idempotent, prints a summary, exits 1 on failure.

- [ ] **Step 1: Create the script**

Create `scripts/backfill-subscriptions.js`:

```javascript
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function backfill() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }
  const sql = neon(dbUrl);

  const usersWithoutSub = await sql`
    SELECT u.id, u.email
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE s.id IS NULL
  `;

  console.log(`Found ${usersWithoutSub.length} user(s) without a subscriptions row.`);

  let inserted = 0;
  for (const user of usersWithoutSub) {
    await sql`
      INSERT INTO subscriptions (user_id, tier, status)
      VALUES (${user.id}, 'free', 'active')
      ON CONFLICT (user_id) DO NOTHING
    `;
    console.log(`INSERT: ${user.email} (${user.id})`);
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted} subscription row(s), 0 skipped.`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

```powershell
node scripts/backfill-subscriptions.js
```

Expected: prints the count of users found (likely matches your current production user count, since CRITICAL 1 only just started seeding rows), one `INSERT:` line per user, then a `Done.` summary. Re-running it immediately after should print "Found 0 user(s) without a subscriptions row." and `Done. Inserted 0 subscription row(s), 0 skipped.` — confirms idempotency.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-subscriptions.js
git commit -m "chore: add backfill script for users missing a subscriptions row"
```

---

### Task 7: 7-day Story Pro trial — `getUserTier` and `GET /api/subscription` (C-2)

**Files:**
- Modify: `src/lib/subscription.ts`
- Modify: `src/app/api/subscription/route.ts`

Task 1 added `users.trialEndAt` and Task 2 sets it to `now + 7 days` for new registrations. This task makes that column actually grant access: a free-tier user (the only state a brand-new user is ever in, per Task 2's seeded `subscriptions` row) with an unexpired `trialEndAt` is treated as `tier: "story_pro"`.

`MONTHLY_GENERATION_LIMITS.story_pro` is already `500` (vs. `10` for `free`), and `getUserTier()` is the single source of truth that `GATED_MODES`/`canAccessFeature` and the monthly-generation cap in `src/app/api/ai/generate/route.ts` both read from — so once `getUserTier()` returns `"story_pro"` during the trial, the 500/month limit and all `story_pro`-gated modes (dialogue, combat, composition, etc.) automatically unlock for trialing users with no further changes.

`GET /api/subscription` is what the frontend polls (`GhostWriterApp.tsx` and `src/app/settings/page.tsx`), and both already branch on `status === 'trialing'` plus `currentPeriodEnd` to render the trial countdown banner and "Trial active" badge — so reporting `{ tier: 'story_pro', status: 'trialing', currentPeriodEnd: trialEndAt }` during the trial window is enough to light up that existing UI with zero frontend changes.

- [ ] **Step 1: Import `users` in `src/lib/subscription.ts`**

Change line 5:

```typescript
import { subscriptions } from "@/db/schema";
```

to:

```typescript
import { subscriptions, users } from "@/db/schema";
```

- [ ] **Step 2: Add the trial check to `getUserTier`**

Replace the function (current lines 28–50):

```typescript
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.tier;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  let tier: SubscriptionTier = "free";

  if (sub) {
    if (sub.status === "cancelled" && sub.currentPeriodEnd) {
      tier = new Date(sub.currentPeriodEnd) > new Date() ? sub.tier as SubscriptionTier : "free";
    } else if (sub.status === "past_due") {
      tier = "free";
    } else if (sub.status === "active" || sub.status === "trialing") {
      tier = sub.tier as SubscriptionTier;
    }
  }

  tierCache.set(userId, { tier, expiresAt: Date.now() + 5 * 60 * 1000 });
  return tier;
}
```

with:

```typescript
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.tier;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  let tier: SubscriptionTier = "free";

  if (sub) {
    if (sub.status === "cancelled" && sub.currentPeriodEnd) {
      tier = new Date(sub.currentPeriodEnd) > new Date() ? sub.tier as SubscriptionTier : "free";
    } else if (sub.status === "past_due") {
      tier = "free";
    } else if (sub.status === "active" || sub.status === "trialing") {
      tier = sub.tier as SubscriptionTier;
    }
  }

  // 7-day Story Pro trial: a free-tier user with an unexpired trial gets story_pro access.
  if (tier === "free") {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { trialEndAt: true },
    });
    if (user?.trialEndAt && new Date(user.trialEndAt) > new Date()) {
      tier = "story_pro";
    }
  }

  tierCache.set(userId, { tier, expiresAt: Date.now() + 5 * 60 * 1000 });
  return tier;
}
```

- [ ] **Step 3: Make `GET /api/subscription` report the trial as `story_pro`/`trialing`**

In `src/app/api/subscription/route.ts`, replace the `GET` function (current lines 25–42):

```typescript
// GET — current subscription info (returns tier, status, currentPeriodEnd for settings UI)
export async function GET() {
  const session = await getRequiredSession();
  const { db } = await import('@/db');
  const { subscriptions } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
    columns: { tier: true, status: true, currentPeriodEnd: true },
  });

  return NextResponse.json({
    tier: sub?.tier ?? 'free',
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
  });
}
```

with:

```typescript
// GET — current subscription info (returns tier, status, currentPeriodEnd for settings UI)
export async function GET() {
  const session = await getRequiredSession();
  const { db } = await import('@/db');
  const { subscriptions, users } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
    columns: { tier: true, status: true, currentPeriodEnd: true },
  });

  const tier = sub?.tier ?? 'free';

  // 7-day Story Pro trial: report story_pro/trialing so the existing trial banner renders.
  if (tier === 'free') {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { trialEndAt: true },
    });
    if (user?.trialEndAt && new Date(user.trialEndAt) > new Date()) {
      return NextResponse.json({
        tier: 'story_pro',
        status: 'trialing',
        currentPeriodEnd: user.trialEndAt.toISOString(),
      });
    }
  }

  return NextResponse.json({
    tier,
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 5: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/subscription.ts src/app/api/subscription/route.ts
git commit -m "feat: 7-day story_pro trial via users.trial_end_at"
```

---

### Task 8: Manual end-to-end test on Razorpay test mode

**Files:** none (verification only)

This is the work order's required manual checkpoint before anything past the launch-blocking block ships. It exercises Tasks 2–7 together against a real (test-mode) Razorpay account. Run the dev server first:

```powershell
npm run dev
```

(runs on port 3001 per `CLAUDE.md`)

- [ ] **Step 1: New registration seeds a subscription row and starts the trial**

Register a brand-new account at `http://localhost:3001/register` with a fresh email. Then check the database:

```powershell
npx drizzle-kit studio
```

Open the Drizzle Studio URL it prints, and inspect the `subscriptions` and `users` tables.

Expected: a new `subscriptions` row exists for this user with `tier = 'free'`, `status = 'active'`, `stripe_customer_id = ''`. The new user's `users.trial_end_at` is set to roughly 7 days from now.

- [ ] **Step 2: Trial banner renders**

Log in as the new user and open the app shell (`http://localhost:3001/`). Confirm the trial countdown banner is visible (driven by `GhostWriterApp.tsx`'s `trialDaysLeft`, which reads `subscription.status === 'trialing'`). Open `/settings` and confirm the "Trial active" badge renders in the Plan/Subscription section.

Expected: both UI elements show, with a countdown of approximately 7 days, with **zero frontend code changes** — confirming `GET /api/subscription` (Task 7) returns `{ tier: 'story_pro', status: 'trialing', currentPeriodEnd: <~7 days from now> }` for this account.

- [ ] **Step 3: Real Razorpay checkout activates the correct tier**

With `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_*_PLAN_ID` set to **test-mode** values in `.env.local`, trigger an upgrade (e.g. via the `UpgradePrompt` "Upgrade to Story Pro" CTA, or `POST /api/subscription` with `{ "tier": "story_pro", "billingPeriod": "monthly" }`). Complete the checkout using a [Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/).

Expected: the checkout overlay completes, `POST /api/subscription/verify` runs, and:
- The `subscriptions` row for this user now has `tier = 'story_pro'`, `status = 'active'`, `razorpay_subscription_id` and `razorpay_payment_id` populated, `current_period_end` set.
- `GET /api/subscription` now returns `{ tier: 'story_pro', status: 'active', currentPeriodEnd: <date> }` (no longer `trialing` — the real subscription takes over).
- A subscription-confirmation email is attempted (check server logs for the `sendEmail` call; it's fire-and-forget so a Resend failure won't block the response).

- [ ] **Step 4: CRITICAL 2 — tampering with `tier` in the verify request is ignored**

Repeat Step 3 for a **second** test user, but this time intercept the `POST /api/subscription/verify` request (browser DevTools → Network → Edit and Resend, or replay with `curl`/Postman using the captured `razorpay_payment_id` / `razorpay_subscription_id` / `razorpay_signature`) and add `"tier": "all_access"` to the JSON body even though the actual Razorpay subscription was created for `story_pro`.

Expected: the response still reports `{ "success": true, "tier": "story_pro" }` (or whatever tier was actually purchased) — the injected `"tier": "all_access"` in the request body has **no effect**, because Task 4 removed it from the destructured body entirely and the server now reads `tier` from `razorpaySub.notes.tier`.

- [ ] **Step 5: CRITICAL 2 — mismatched `userId` in `notes` is rejected**

This is harder to trigger via the UI (the `notes.userId` is always the current session's user at subscription-creation time). As a code-level sanity check instead: confirm by reading `src/app/api/subscription/verify/route.ts` that the `if (razorpaySub.notes?.userId !== session.user.id)` check (Task 4, Step 2) is present and returns 403 — this guards against any future client-side change that lets a `subscription_id` belonging to user A be submitted while logged in as user B.

- [ ] **Step 6: Webhook upsert (CRITICAL 1c)**

If a Razorpay webhook endpoint is reachable from your test environment (e.g. via `ngrok` pointed at `http://localhost:3001/api/webhooks/razorpay`, configured in the Razorpay test dashboard), trigger a `subscription.charged` test event from the Razorpay dashboard for the subscription created in Step 3. Expected: `subscriptions.current_period_end` advances and `subscriptions.status` remains `"active"`. If a webhook tunnel isn't available in this environment, skip this step and note it as not exercised — Task 5's code change (`UPDATE` → upsert) is covered by Step 5/6's typecheck and existing test suite, but the live webhook delivery itself is untested in that case.

- [ ] **Step 7: Record the result**

Note in your task tracker / PR description which of Steps 1–6 passed, and which (if any) were skipped and why (e.g. "Step 6 skipped — no ngrok tunnel in this environment"). Do not proceed to Task 9 if Steps 1–5 did not all pass.

---

### Task 9: AI rate limiter fails closed in production (A-HIGH 3)

**Files:**
- Modify: `src/lib/ratelimit.ts`
- Modify: `src/lib/env-check.ts`

Today, `checkAiRateLimit` returns `null` (i.e., "request allowed") whenever `aiRatelimit` is `null` — which happens both in development without Upstash configured (intentional, documented "fail open if env vars missing") *and* in production if `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are missing or Upstash is down. The latter case turns the 20-requests-per-minute-per-user AI rate limit into an uncapped faucet for every Claude model (including Opus) for every user, with no warning. This task makes the production case fail closed (503) while leaving the development-without-Upstash case unchanged (fail open, so local dev doesn't require an Upstash account). It also wraps the actual `.limit()` call in `try`/`catch` so a transient Upstash outage in production returns 503 instead of throwing an unhandled error (or worse, silently allowing the request if the throw is swallowed upstream).

- [ ] **Step 1: Make `checkAiRateLimit` fail closed in production**

In `src/lib/ratelimit.ts`, replace the function (current lines 53–74):

```typescript
/**
 * Returns a 429 NextResponse if the user is rate-limited, or null if they're allowed.
 * Call immediately after getRequiredSession() in every AI route.
 */
export async function checkAiRateLimit(userId: string): Promise<NextResponse | null> {
  if (!aiRatelimit) return null;
  const { success, limit, remaining, reset } = await aiRatelimit.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 AI requests per minute." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }
  return null;
}
```

with:

```typescript
/**
 * Returns a 429 NextResponse if the user is rate-limited, or null if they're allowed.
 * Call immediately after getRequiredSession() in every AI route.
 *
 * Fails CLOSED in production: if Upstash isn't configured, or the rate-limit check
 * itself throws, AI routes return 503 rather than allowing unlimited requests.
 * Fails OPEN in development without Upstash configured (returns null).
 */
export async function checkAiRateLimit(userId: string): Promise<NextResponse | null> {
  if (!aiRatelimit) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Rate limiting is not configured. Please try again later." },
        { status: 503 }
      );
    }
    return null;
  }

  try {
    const { success, limit, remaining, reset } = await aiRatelimit.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 20 AI requests per minute." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { error: "Rate limiting service unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 2: Add the Upstash vars to `REQUIRED_ENV_VARS`**

In `src/lib/env-check.ts`, replace the array (current lines 18–31):

```typescript
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'ANTHROPIC_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID',
  'RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'ADMIN_SECRET',
];
```

with:

```typescript
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'ANTHROPIC_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID',
  'RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'ADMIN_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 4: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Verify the production fail-closed path manually**

This can't be exercised by `npm run dev` (which runs with `NODE_ENV=development`). Instead, confirm the logic by inspection: with `UPSTASH_REDIS_REST_URL` unset, `redis` (line 6–11) is `null`, so `aiRatelimit` (line 14–21) is `null`. In `checkAiRateLimit`, `!aiRatelimit` is `true`, and `process.env.NODE_ENV === "production"` will be `true` for any `next start` / Vercel production build — so the function returns the 503 `NextResponse` before ever calling `.limit()`. In `npm run dev`, `NODE_ENV` is `"development"`, so the same missing-Upstash state returns `null` (unchanged behavior — confirm `npm run dev` still allows AI generation requests locally without Upstash configured, e.g. by using the Brainstorm or Outline panel).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ratelimit.ts src/lib/env-check.ts
git commit -m "fix: AI rate limiter fails closed in production when Upstash is unavailable"
```

---

### Task 10: Delete dead Stripe routes and replace the `STRIPE_PRICES` test (C-1, part 1)

**Files:**
- Delete: `src/app/api/subscription/portal/route.ts`
- Delete: `src/app/api/webhooks/stripe/route.ts`
- Modify: `src/types/subscription.ts`
- Modify: `src/app/api/ai/__tests__/subscription.test.ts`

GhostWriter switched from Stripe to Razorpay in Sprint 24 (`/api/webhooks/razorpay` is the live webhook). `src/app/api/subscription/portal/route.ts` (Stripe billing portal) and `src/app/api/webhooks/stripe/route.ts` (Stripe webhook handler) are both dead — neither is referenced by any UI (there is no "Manage billing" button anywhere in the app; `UpgradePrompt.tsx` posts to `/api/subscription`, not `/api/subscription/portal`) and Razorpay's webhook has fully replaced Stripe's. `STRIPE_PRICES` in `src/types/subscription.ts` is the only other code reference to Stripe-specific env vars and is exercised solely by the test file being fixed here.

This task is done TDD-style: delete the dead code and the export first, watch the test suite fail on the now-missing `STRIPE_PRICES` import, then fix the test.

- [ ] **Step 1: Delete the two dead route files**

```bash
git rm src/app/api/subscription/portal/route.ts src/app/api/webhooks/stripe/route.ts
```

- [ ] **Step 2: Remove `STRIPE_PRICES` from `src/types/subscription.ts`**

Delete this block (current lines 74–86, including the trailing blank line):

```typescript
// ── Stripe price IDs (replace with real IDs from Stripe dashboard) ─────────

export const STRIPE_PRICES = {
  // Monthly
  story_pro:          process.env.STRIPE_STORY_PRO_PRICE_ID          ?? "",
  creator_pro:        process.env.STRIPE_CREATOR_PRO_PRICE_ID         ?? "",
  all_access:         process.env.STRIPE_ALL_ACCESS_PRICE_ID          ?? "",
  // Annual (20% discount — create in Stripe dashboard)
  story_pro_annual:   process.env.STRIPE_STORY_PRO_ANNUAL_PRICE_ID   ?? "",
  creator_pro_annual: process.env.STRIPE_CREATOR_PRO_ANNUAL_PRICE_ID ?? "",
  all_access_annual:  process.env.STRIPE_ALL_ACCESS_ANNUAL_PRICE_ID  ?? "",
} as const;

```

so that the `// ── Razorpay plan IDs (created manually in Razorpay dashboard) ─────────` comment that follows is immediately preceded by the `GATED_MODES` block above, with one blank line in between (matching the existing spacing convention between sections in this file).

- [ ] **Step 3: Run the test suite and confirm it fails**

Run: `npm run test`
Expected: FAIL — `src/app/api/ai/__tests__/subscription.test.ts` fails because `STRIPE_PRICES` is no longer exported from `@/types/subscription` (either a TS error surfaced through Vitest, or `STRIPE_PRICES` is `undefined` and `STRIPE_PRICES.story_pro` throws).

- [ ] **Step 4: Fix the test — replace `STRIPE_PRICES` with `RAZORPAY_PLANS`**

In `src/app/api/ai/__tests__/subscription.test.ts`, change the import block (current lines 14–19):

```typescript
import {
  FEATURE_ACCESS,
  GATED_MODES,
  FREE_TIER_LIMITS,
  STRIPE_PRICES,
} from "@/types/subscription";
```

to:

```typescript
import {
  FEATURE_ACCESS,
  GATED_MODES,
  FREE_TIER_LIMITS,
  RAZORPAY_PLANS,
} from "@/types/subscription";
```

Then replace the `"Stripe price IDs configured"` describe block (current lines 107–119):

```typescript
describe("Stripe price IDs configured", () => {
  it("story_pro price ID is set", () => {
    expect(typeof STRIPE_PRICES.story_pro).toBe("string");
  });

  it("creator_pro price ID is set", () => {
    expect(typeof STRIPE_PRICES.creator_pro).toBe("string");
  });

  it("all_access price ID is set", () => {
    expect(typeof STRIPE_PRICES.all_access).toBe("string");
  });
});
```

with:

```typescript
describe("Razorpay plan IDs configured", () => {
  it("story_pro monthly plan ID is set", () => {
    expect(typeof RAZORPAY_PLANS.story_pro.monthly).toBe("string");
  });

  it("creator_pro monthly plan ID is set", () => {
    expect(typeof RAZORPAY_PLANS.creator_pro.monthly).toBe("string");
  });

  it("all_access monthly plan ID is set", () => {
    expect(typeof RAZORPAY_PLANS.all_access.monthly).toBe("string");
  });
});
```

- [ ] **Step 5: Run the test suite and confirm it passes**

Run: `npm run test`
Expected: PASS — all tests, including the new `"Razorpay plan IDs configured"` block, pass. (`RAZORPAY_PLANS.story_pro.monthly` is `process.env.RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID ?? ''`, which is always a `string` — `typeof` is `"string"` regardless of whether the env var is set, so this assertion holds in any environment.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors. This also confirms nothing else in the codebase imports `STRIPE_PRICES` or the two deleted route files (a leftover import would surface as a TS module-resolution error).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead Stripe portal/webhook routes and STRIPE_PRICES export"
```

---

### Task 11: Remove Stripe dependencies from `package.json` (C-1, part 2)

**Files:**
- Modify: `package.json`

With Task 10 done, nothing in `src/` imports `stripe` or `@stripe/stripe-js` anymore. Remove both packages and update the lockfile.

- [ ] **Step 1: Remove the two Stripe dependencies**

In `package.json`, delete this line from `dependencies` (alphabetically near the top):

```json
    "@stripe/stripe-js": "^9.7.0",
```

and this line (alphabetically near the bottom):

```json
    "stripe": "^22.2.0",
```

- [ ] **Step 2: Update the lockfile**

```powershell
npm install
```

Expected: `package-lock.json` updates to remove `@stripe/stripe-js`, `stripe`, and any of their now-unused transitive dependencies. No new packages are added.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 4: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove stripe and @stripe/stripe-js dependencies"
```

---

### Task 12: Remove Stripe from env example, UI copy, and legal pages (C-1, part 3)

**Files:**
- Modify: `.env.local.example`
- Modify: `src/components/upgrade/UpgradePrompt.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/terms/page.tsx`

The last remnants of Stripe are documentation/copy: a block of `STRIPE_*` env vars in `.env.local.example` that no longer correspond to any code (Task 10 removed the only reader, `STRIPE_PRICES`), the checkout modal's fine print ("Secure payment via Stripe"), and two legal pages that tell users their payments are processed by Stripe — which would now be inaccurate, since Razorpay has been the only payment processor since Sprint 24.

- [ ] **Step 1: Remove the Stripe block from `.env.local.example`**

Replace (current lines 18–27):

```
# Cron job security — generate with: openssl rand -base64 32
CRON_SECRET=generate-with-openssl-rand-base64-32

# Stripe — create account at stripe.com, get keys from Dashboard > Developers
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STORY_PRO_PRICE_ID=price_...
STRIPE_CREATOR_PRO_PRICE_ID=price_...
STRIPE_ALL_ACCESS_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

with:

```
# Cron job security — generate with: openssl rand -base64 32
CRON_SECRET=generate-with-openssl-rand-base64-32
```

- [ ] **Step 2: Fix `UpgradePrompt.tsx` fine print**

In `src/components/upgrade/UpgradePrompt.tsx`, change line 109:

```typescript
          Cancel anytime · Secure payment via Stripe · No hidden fees
```

to:

```typescript
          Cancel anytime · Secure payment via Razorpay · No hidden fees
```

- [ ] **Step 3: Fix `src/app/privacy/page.tsx`**

Change line 21:

```typescript
        <p style={pStyle}>We do not collect payment card details (handled by Stripe). We do not track you across other websites. We do not sell your data. We do not use your stories to train AI models.</p>
```

to:

```typescript
        <p style={pStyle}>We do not collect payment card details (handled by Razorpay). We do not track you across other websites. We do not sell your data. We do not use your stories to train AI models.</p>
```

Change line 31:

```typescript
        <p style={pStyle}>We use Anthropic's API for AI generation (your prompts are sent to their servers), Neon for database hosting, Vercel for application hosting, Stripe for payment processing, Sentry for error monitoring (anonymized), and Resend for transactional email. Each provider's privacy policy governs their handling of your data.</p>
```

to:

```typescript
        <p style={pStyle}>We use Anthropic's API for AI generation (your prompts are sent to their servers), Neon for database hosting, Vercel for application hosting, Razorpay for payment processing, Sentry for error monitoring (anonymized), and Resend for transactional email. Each provider's privacy policy governs their handling of your data.</p>
```

- [ ] **Step 4: Fix `src/app/terms/page.tsx`**

Change line 41:

```typescript
        <p style={pStyle}>Paid subscriptions are processed via Stripe. You may cancel anytime — cancellation takes effect at the end of the current billing period. Refunds are evaluated case by case for technical failures.</p>
```

to:

```typescript
        <p style={pStyle}>Paid subscriptions are processed via Razorpay. You may cancel anytime — cancellation takes effect at the end of the current billing period. Refunds are evaluated case by case for technical failures.</p>
```

- [ ] **Step 5: Confirm no Stripe references remain in `src/`**

```powershell
Select-String -Path src -Pattern 'stripe' -Recurse -CaseSensitive:$false
```

Expected: the only matches are in `src/db/schema.ts` (`stripeCustomerId`/`stripeSubscriptionId` columns — left in place; removing these DB columns requires a migration and is out of scope for this plan, per the audit's "low priority, not required" note on these fields). If any other file matches, fix it before continuing.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 7: Run the existing test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add .env.local.example src/components/upgrade/UpgradePrompt.tsx src/app/privacy/page.tsx src/app/terms/page.tsx
git commit -m "chore: replace remaining Stripe references with Razorpay in env example and copy"
```

---

## Done

After Task 12, the launch-blocking block (work order steps 1–7) is complete: every user has a `subscriptions` row from the moment their account exists, subscription tier is verified server-side from Razorpay and can't be tampered with by the client, the 7-day Story Pro trial is live end-to-end, AI rate limiting can no longer silently fail open in production, and the dead Stripe integration is fully removed. Per the work order, this unblocks Sprint 25's context/cost work (B-0 remainder, B-1, B-2, B-3) and the pre-launch polish block (C-5, C-3, A-HIGH 2/4, A-MEDIUM 1/3/4) as separate plans.

