# Subscription System

How tiers work, what each tier unlocks, how Stripe is integrated, and how feature gates are enforced.

---

## Tiers

| Tier | Razorpay plan env vars | Monthly |
|---|---|---|
| `free` | — (no payment) | ₹0 |
| `story_pro` | `RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID` / `RAZORPAY_STORY_PRO_ANNUAL_PLAN_ID` | ₹1,500 |
| `creator_pro` | `RAZORPAY_CREATOR_PRO_MONTHLY_PLAN_ID` / `RAZORPAY_CREATOR_PRO_ANNUAL_PLAN_ID` | ₹1,000 |
| `all_access` | `RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID` / `RAZORPAY_ALL_ACCESS_ANNUAL_PLAN_ID` | ₹2,500 |

Tier names are the values stored in `subscriptions.tier` column. Prices are in Indian Rupees (INR) — GhostWriter is India-first.

---

## What Each Tier Unlocks

### Free Tier
- 10 AI generations per month (routed to Claude Haiku for low cost)
- 7-day Story Pro trial on signup: `users.trialEndAt = now + 7d` (set at registration); while unexpired, `getUserTier()` returns `story_pro` regardless of the underlying `subscriptions` row, so the user gets full Story Pro access (500 gens/month, all library modes, Style DNA, etc.) for 7 days, then drops back to the free limits below
- 1 project · 2 characters
- Core modes only: Brainstorm, Outline, Write
- All 23 library modes blocked (403 → upgrade prompt)
- No Style DNA, no AIisms check, no library modes

### Story Pro (`story_pro`)
- 500 generations/month (Claude Sonnet)
- All 23 library modes (dialogue, combat, atmosphere, etc.)
- Full character intelligence (NVC, language profiles, contextVisibility toggles)
- Style DNA (reference works → style fingerprint)
- Voice fingerprinting (stylometric constraints from your last 5 chapters)
- AIisms check (opt-in — 20 AI fiction tells blocked post-generation)
- Story Memory + Story State tracking
- Character evolution log
- Comic Studio
- Production Studio (shot lists)
- World Bible (full character/location/thread detail)
- Series Bible
- Export: DOCX manuscript, blurb, query letter
- Alt Draft generator
- Quality Review panel
- Arc Heatmap, Tension Curve, Theme Tracker
- Villain POV, Dead Scenes, Scene Validator
- Transportation Check (Green & Brock's narrative transportation)

### Creator Pro (`creator_pro`)
- All creator-specific tools:
  - Trend search (YouTube + Instagram)
  - Dissect Video (Gemini analysis)
  - TikTok Native (hooks + scripts)
  - Hook A/B testing
  - Retention editing
  - Channel autopsy
  - Guest intelligence
  - Creator SEO
  - Thumbnail concepts
  - Virality predictor
  - Content repurposing
  - Research scaffold
  - Content pipeline
  - Series planner

### All Access (`all_access`)
- Unlimited generations
- Everything from Story Pro + Creator Pro
- Priority generation
- YouTube reference video analysis (Gemini 3.5 Flash)
- Higgsfield pipeline (Soul ID training + video generation)

---

## Feature Gate Map

Feature gates are string keys mapped to tiers in `src/types/subscription.ts`:

```typescript
const FEATURE_ACCESS: Record<string, SubscriptionTier[]> = {
  // Story features
  "story_modes_advanced":    ["story_pro", "all_access"],
  "style_dna":               ["story_pro", "all_access"],
  "story_memory":            ["story_pro", "all_access"],
  "comic_studio":            ["story_pro", "all_access"],
  "production_studio":       ["story_pro", "all_access"],
  "export_advanced":         ["story_pro", "all_access"],
  "character_evolution":     ["story_pro", "all_access"],
  "world_bible_advanced":    ["story_pro", "all_access"],
  
  // Creator features
  "creator_tools":           ["creator_pro", "all_access"],
  "creator_tools_advanced":  ["creator_pro", "all_access"],
  "trend_intelligence":      ["creator_pro", "all_access"],
  "video_dissection":        ["creator_pro", "all_access"],
  "virality_tools":          ["creator_pro", "all_access"],
};
```

Every gated API route calls:
```typescript
if (!canAccessFeature(tier, "feature_name")) {
  return NextResponse.json({ error: "upgrade_required", feature: "feature_name" }, { status: 403 });
}
```

The `feature` field in the 403 response is used by the frontend to show the appropriate upgrade prompt.

---

## Tier Lookup: `getUserTier()`

`src/lib/subscription.ts`:

```typescript
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.tier;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),  // all statuses — grace period needs cancelled rows
  });

  let tier: SubscriptionTier = "free";
  if (sub) {
    if (sub.status === "cancelled" && sub.currentPeriodEnd) {
      tier = new Date(sub.currentPeriodEnd) > new Date() ? sub.tier as SubscriptionTier : "free";
    } else if (sub.status === "past_due") {
      tier = "free";  // payment failed — access removed immediately
    } else if (sub.status === "active" || sub.status === "trialing") {
      tier = sub.tier as SubscriptionTier;
    }
  }

  tierCache.set(userId, { tier, expiresAt: Date.now() + 5 * 60 * 1000 });
  return tier;
}
```

**Grace period:** A cancelled subscription keeps the paid tier until `currentPeriodEnd`. This is why the cancellation webhook must NOT set `tier='free'` — it sets `status='cancelled'` and `currentPeriodEnd`, and the logic above handles the rest.

**Why in-process cache?**
Subscription tier is checked on every AI request. Without caching, every generation would hit the DB for a subscription lookup. The 5-minute TTL means a new subscription takes up to 5 minutes to activate — acceptable for this use case.

**Cache invalidation:** Razorpay webhook handlers call `invalidateTierCache(userId)` after updating subscription status. If the cache isn't cleared on webhook, newly subscribed users may need to wait up to 5 minutes.

---

## Razorpay Integration

GhostWriter switched from Stripe to Razorpay (Sprint 24) to support Indian payment methods (UPI, netbanking, wallets).

### Payment Flow

1. User clicks "Upgrade" on `/settings` (or any `UpgradePrompt.tsx` paywall) → `POST /api/subscription` with `{ tier, billingPeriod }` (`'monthly' | 'annual'`)
2. Route creates a Razorpay subscription using the plan ID from `RAZORPAY_PLANS` in `src/types/subscription.ts`:
   ```typescript
   const subscription = await withAuthRetry(() => razorpay.subscriptions.create({
     plan_id: planId,
     customer_notify: 1,
     total_count: period === 'annual' ? 10 : 120,
     notes: { userId: session.user.id, tier, billingPeriod: period },
   }));
   ```
   `withAuthRetry()` (4 attempts, 250ms·i backoff) retries on Razorpay test-mode's intermittent `401 BAD_REQUEST_ERROR` — see [gotchas.md](gotchas.md).
3. Returns `{ subscriptionId, keyId }` to the client
4. Client opens the Razorpay Checkout overlay (no redirect — modal flow)
5. User pays with UPI / card / netbanking / wallet
6. On success, the client immediately calls `POST /api/subscription/verify` with `{ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }` — this is the primary activation path (see "Subscription Activation" below)
7. Razorpay also sends an async webhook to `/api/webhooks/razorpay` (`subscription.activated`/`charged`) as a backup/reconciliation path — same upsert logic, idempotent if verify already activated the row

### Subscription Row Lifecycle

Every user has exactly one `subscriptions` row from the moment their account exists — `subscriptions.userId` is `unique()`, so it's always a valid `onConflictDoUpdate` target:

- **Created at registration**: `POST /api/auth/register` does `db.insert(subscriptions).values({ userId: user.id })` (defaults: `tier: "free"`, `status: "active"`).
- **Created for OAuth signups**: `events.createUser` in `src/lib/auth.ts` does the same insert with `.onConflictDoNothing()`.
- **Backfilled for pre-existing accounts**: `scripts/backfill-subscriptions.js` (one-off, already run in prod).

This closes the original bug where a user could pay successfully but `/api/subscription/verify`'s `UPDATE` matched zero rows and silently no-op'd.

### Subscription Activation — Tier Verification (security-critical)

`POST /api/subscription/verify` is the primary activation path. After validating the HMAC signature (`payment_id|subscription_id` signed with `RAZORPAY_KEY_SECRET`), it fetches the Razorpay subscription and reads the **authoritative tier from `notes`** — never from the client request body:

```typescript
const razorpaySub = await razorpay.subscriptions.fetch(razorpay_subscription_id);

if (razorpaySub.notes?.userId !== session.user.id) {
  return NextResponse.json({ error: "Subscription does not belong to this user" }, { status: 403 });
}
const tier = (razorpaySub.notes?.tier ?? "free") as SubscriptionTier;

await db.insert(subscriptions).values({ userId: session.user.id, tier, status: "active", ... })
  .onConflictDoUpdate({ target: subscriptions.userId, set: { tier, status: "active", ... } });
```

`notes.tier` and `notes.userId` are set server-side at subscription-creation time (`POST /api/subscription`, step 2 above) and cannot be influenced by the client at verify time. A user who tampers the verify request body to claim a higher tier than they paid for is rejected/ignored — the DB always reflects what `notes.tier` says was actually purchased.

### Webhook Events Handled

| Event | Action |
|---|---|
| `subscription.activated` | Create/update `subscriptions` row with `tier` from `notes.tier`; apply referral reward atomically |
| `subscription.charged` | Update `currentPeriodEnd` on renewal |
| `subscription.cancelled` | Set `status='cancelled'`, set `currentPeriodEnd` from `sub.current_end`; **do NOT set `tier='free'`** (grace period preserved) |
| `subscription.completed` | Set `status='cancelled'` (subscription naturally ended) |

All events are verified with Razorpay's HMAC-SHA256 webhook signature before processing:
```typescript
const expectedSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
  .update(body)
  .digest("hex");
if (expectedSignature !== razorpaySignature) return 400;
```

### Referral Reward — Atomic Idempotency

On `subscription.activated`, the referral reward (1 month bonus) is applied via an atomic conditional update:

```typescript
const [updated] = await db.update(referrals)
  .set({ status: "rewarded", rewardApplied: true })
  .where(and(
    eq(referrals.refereeId, userId),
    eq(referrals.rewardApplied, false)  // ← only if not already rewarded
  ))
  .returning();
```

The `rewardApplied: false` condition means the update is a no-op on webhook retry — preventing double-reward.

---

## Free Tier Limits

Free users have a monthly generation cap enforced in `src/lib/subscription.ts`:

```typescript
export const MONTHLY_GENERATION_LIMITS: Record<string, number> = {
  free:        10,   // Haiku-routed — habit-forming, low cost
  story_pro:   500,
  creator_pro: 500,
  all_access:  -1,   // unlimited
};
```

Free users are also routed to `MODELS.fast` (Haiku) to keep inference cost near zero:

```typescript
// In /api/ai/generate/route.ts
const overrideModel = tier === 'free' ? MODELS.fast : undefined;
```

22 of the 23 library modes are hard-blocked for free users via this set regardless of
generation count (the 23rd, `dialogue`, is blocked earlier via the `GATED_MODES`/
`canAccessFeature` check, since it predates this set):

```typescript
if (tier === 'free' && LIBRARY_MODES.has(mode)) {
  return NextResponse.json({ error: 'upgrade_required', feature: 'story_modes_advanced' }, { status: 403 });
}
```

---

## Upgrade Prompt Component

`src/components/upgrade/UpgradePrompt.tsx` renders when a 403 with `upgrade_required` comes back from any route. It:

1. Receives the `feature` string from the 403 response
2. Looks up the feature in `UPGRADE_COPY` from `src/types/subscription.ts`
3. Renders a modal with feature description, price, and "Upgrade" CTA
4. "Upgrade" hits `POST /api/subscription` → creates Razorpay subscription → opens Razorpay Checkout overlay (modal, no redirect)

This means adding a new gated feature requires:
1. Add the feature key to `FEATURE_ACCESS` in `src/types/subscription.ts`
2. Add upgrade copy to `UPGRADE_COPY` in the same file
3. Call `canAccessFeature(tier, "your_feature")` in the route handler

No other changes needed — the upgrade flow is automatic.

## Monthly Reset Logic

Monthly generation counts reset on the first of each calendar month. The reset check in every AI route:

```typescript
const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const isNewMonth = !resetAt || resetAt < firstOfMonth;
```

**Why not `resetAt.getMonth() !== now.getMonth()`?**
That comparison would incorrectly reset when `resetAt` is in a *future* month (e.g., resetAt = June 2027, today = May 2027 → June ≠ May → reset fires). The `resetAt < firstOfMonth` check is monotonically correct.
