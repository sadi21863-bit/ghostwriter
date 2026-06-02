# Subscription System

How tiers work, what each tier unlocks, how Stripe is integrated, and how feature gates are enforced.

---

## Tiers

| Tier | Stripe price ID env var | Monthly (INR) |
|---|---|---|
| `free` | — (no Stripe) | ₹0 |
| `story_pro` | `STRIPE_STORY_PRO_PRICE_ID` | ₹799 |
| `creator_pro` | `STRIPE_CREATOR_PRO_PRICE_ID` | ₹399 |
| `all_access` | `STRIPE_ALL_ACCESS_PRICE_ID` | ₹999 |

Tier names are the values stored in `subscriptions.tier` column.

---

## What Each Tier Unlocks

### Free Tier
- 10 AI generations per day
- 1 project
- Core modes only: Brainstorm, Outline, Write
- No Style DNA, no Story Memory, no library modes

### Story Pro (`story_pro`)
- Unlimited generations
- Up to 20 projects
- All 20 library modes (dialogue, combat, atmosphere, etc.)
- Style DNA (reference works → style fingerprint)
- Story Memory + Story State tracking
- Character evolution log
- Comic Studio
- Production Studio (shot lists)
- World Bible (full character/location/thread detail)
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
- Everything from Story Pro + Creator Pro

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
const tierCache = new Map<string, { tier: SubscriptionTier; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const cached = tierCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.tier;
  }
  
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, "active")
    ),
  });
  
  const tier = sub?.tier ?? "free";
  tierCache.set(userId, { tier, ts: Date.now() });
  return tier;
}
```

**Why in-process cache?**
Subscription tier is checked on every AI request. Without caching, every generation would hit the DB for a subscription lookup. The 5-minute TTL means a new subscription takes up to 5 minutes to activate — acceptable for this use case.

**Cache invalidation:** Stripe webhook events (subscription created/updated/deleted) should clear the cache for the affected user. If the cache isn't invalidated on webhook, newly subscribed users may need to wait up to 5 minutes.

---

## Stripe Integration

### Payment Flow

1. User clicks "Upgrade" → `UpgradePrompt.tsx`
2. Frontend calls `POST /api/subscription` with `{ priceId }` and optional coupon
3. Route creates Stripe Checkout Session with:
   - `mode: "subscription"`
   - `success_url` / `cancel_url`
   - Customer ID (created if first purchase via `getOrCreateStripeCustomer()`)
4. User is redirected to Stripe Checkout
5. User completes payment
6. Stripe sends `checkout.session.completed` webhook to `/api/webhooks/stripe`
7. Webhook handler creates/updates `subscriptions` row

### Customer Portal

`POST /api/subscription/portal` creates a Stripe Billing Portal session. Users manage their subscription (cancel, change plan, update payment method) entirely in Stripe's hosted portal — no custom billing UI needed.

### Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Create `subscriptions` row, set tier and status |
| `customer.subscription.updated` | Update `subscriptions` row (tier change, renewal) |
| `customer.subscription.deleted` | Set status to `cancelled` |
| `invoice.payment_failed` | Set status to `past_due` |

All events are verified with `stripe.webhooks.constructEvent()` before processing.

---

## Free Tier Limits

Free users are subject to a daily generation limit enforced by `freeGenerationLimit` in `src/lib/ratelimit.ts`:

```typescript
const freeGenerationLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1d"),
});
```

The check runs in AI generation routes:
```typescript
if (tier === "free") {
  const rl = await checkFreeGenerationLimit(session.user.id);
  if (rl) return rl; // 429 with upgrade hint
}
```

The 429 response includes:
```json
{
  "error": "daily_limit_reached",
  "feature": "ai_generation",
  "limit": 10,
  "upgradeRequired": true
}
```

---

## Upgrade Prompt Component

`src/components/upgrade/UpgradePrompt.tsx` renders when a 403 with `upgrade_required` comes back from any route. It:

1. Receives the `feature` string from the 403 response
2. Looks up the feature in `UPGRADE_COPY` from `src/types/subscription.ts`
3. Renders a modal with feature description, price, and "Upgrade" CTA
4. "Upgrade" hits `POST /api/subscription` → redirects to Stripe Checkout

This means adding a new gated feature requires:
1. Add the feature key to `FEATURE_ACCESS` in `src/types/subscription.ts`
2. Add upgrade copy to `UPGRADE_COPY` in the same file
3. Call `canAccessFeature(tier, "your_feature")` in the route handler

No other changes needed — the upgrade flow is automatic.
