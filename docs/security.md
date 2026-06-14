# Security Reference

A consolidated reference for all security patterns, protections, and invariants in GhostWriter. See also [auth-and-security.md](auth-and-security.md) for authentication-specific details.

---

## Threat Model

GhostWriter is a multi-tenant SaaS where each user's projects, characters, and content must be strictly isolated. The primary threats are:

1. **Horizontal escalation (IDOR)** — Authenticated user A accesses or mutates user B's resources
2. **Vertical escalation** — Free-tier user accesses paid features
3. **Abuse / scraping** — Automated requests exhausting AI generation budgets
4. **Injection** — Client-supplied data corrupting DB schema or executing unintended operations
5. **Account enumeration** — Probing registration/forgot-password to discover existing emails

---

## Defense in Depth

### Layer 1 — Session Enforcement

Every protected route handler starts with:

```typescript
const session = await getRequiredSession();
```

`getRequiredSession()` in `src/lib/auth-helpers.ts` throws a `NextResponse` with status 401 if no valid session exists. The route handler never reaches the next line.

### Layer 2 — Ownership Verification (Project Level)

Project-scoped routes verify that the requesting user owns the project before any DB operation:

```typescript
const project = await db.query.projects.findFirst({
  where: and(
    eq(projects.id, projectId),
    eq(projects.userId, session.user.id)
  ),
});
if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

Returns 404 (not 403) — does not reveal whether the project ID exists.

### Layer 3 — Child Resource WHERE Guards (IDOR Prevention)

UPDATE and DELETE on child resources include `projectId` in the WHERE clause even though project ownership was already verified:

```typescript
await db.update(characters)
  .set({ ...data, updatedAt: new Date() })
  .where(and(
    eq(characters.id, characterId),
    eq(characters.projectId, projectId)   // ← prevents cross-project mutation
  ));
```

Without this second condition, an attacker could send `PATCH /api/projects/MY_PROJECT/characters/VICTIM_CHARACTER` and mutate a character in another project, because the project ownership check only validates `MY_PROJECT` is theirs.

**Routes with double guards:**
- `/api/projects/[projectId]/characters/[characterId]` — PATCH, DELETE
- `/api/projects/[projectId]/locations/[locationId]` — PATCH, DELETE
- `/api/projects/[projectId]/plot-threads/[threadId]` — PATCH, DELETE
- `/api/projects/[projectId]/chapters/[chapterId]` — PATCH, DELETE
- `/api/projects/[projectId]/production/shots/[shotId]` — GET, PATCH, DELETE, POST (generate-video)
- `/api/projects/[projectId]/suggest-links` — character/location lookups include `projectId`
- `/api/universes/[universeId]` — PATCH, DELETE check `universes.userId = session.user.id`

### Layer 4 — POST Body Allowlisting

Collection POST routes (`/characters`, `/locations`, `/plot-threads`, `/reference-works`) explicitly destructure only allowed fields:

```typescript
// ❌ Before — client can inject any column including userId, projectId, id
const body = await req.json();
await db.insert(characters).values({ projectId, ...body });

// ✅ After — explicit allowlist
const { name, role, age, appearance, personality, ... } = await req.json();
if (!name || typeof name !== "string") return 400;
await db.insert(characters).values({ projectId, name, role, age, ... });
```

This prevents clients from overriding server-assigned fields (`id`, `projectId`, `createdAt`) or injecting columns they should not control.

### Layer 5b — Public Endpoint Foreign-Key Scoping

`/api/reader/[token]` is unauthenticated (readers access via a share token, not a session). Its POST handler validates the token but must also confirm any client-supplied foreign key belongs to that token's project before writing:

```typescript
const chapter = await db.query.chapters.findFirst({
  where: and(eq(chapters.id, chapterId), eq(chapters.projectId, session.projectId)),
  columns: { id: true },
});
if (!chapter) return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
```

Without this, a reaction POST with an arbitrary `chapterId` would write a reaction record against any project's chapter, not just the one the reader token grants access to.

### Layer 5 — Feature Gate Enforcement

All paid features are gated at the API level, not just the UI level:

```typescript
const tier = await getUserTier(session.user.id);
if (!canAccessFeature(tier, "story_modes_advanced")) {
  return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
}
```

Feature gates in `src/types/subscription.ts` map feature names to required tiers. The frontend upgrade prompts are triggered by 403 responses — they are UX conveniences, not security controls.

---

## Rate Limiting

Four sliding-window limiters via Upstash Redis (`src/lib/ratelimit.ts`):

| Limiter | Window | Limit | Key | Applied to |
|---|---|---|---|---|
| `aiRatelimit` | 1 minute | 20 requests | userId | All `/api/ai/*` routes |
| `generalRatelimit` | 1 minute | 100 requests | userId | General API routes |
| `freeGenerationLimit` | 1 day | 10 requests | userId | Free-tier generation |
| `authRatelimit` | 1 hour | 5 requests | IP address | `/api/auth/register`, `/api/auth/forgot-password` |

**`aiRatelimit` fails CLOSED in production** (`checkAiRateLimit` in `src/lib/ratelimit.ts`): if `UPSTASH_REDIS_REST_URL`/`TOKEN` are missing, or the Upstash call itself throws, AI routes return `503` rather than allowing unlimited requests. In development without Upstash configured it fails open (returns `null`). The other limiters (`generalRatelimit`, `authRatelimit`, `freeGenerationLimit`) remain fail-open if Upstash is unconfigured — acceptable since they aren't the primary cost-control surface.

`freeGenerationLimit` (10/24h, fixed window) and `MONTHLY_GENERATION_LIMITS.free` (10/month, in `src/lib/subscription.ts`) are two separate caps with the same numeric value. The monthly cap is the advertised user-facing quota; the daily limiter is a defense-in-depth burst guard and never becomes the binding constraint for normal usage. All user-facing copy and 429/403 messages use "per month" framing — see [subscription.md](subscription.md#free-tier-limits).

When rate-limited, responses include standard headers:
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
Retry-After: 42
```

---

## Webhook Signature Verification

### Razorpay (`/api/webhooks/razorpay`)

```typescript
const expectedSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
  .update(rawBody)           // raw body bytes, not parsed JSON
  .digest("hex");

if (expectedSignature !== razorpaySignature) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
}
```

The raw body must be read before parsing — parsing first changes the byte representation and invalidates the signature.

### Webhook Idempotency

The `subscription.activated` handler applies referral rewards via an atomic conditional update that uses `rewardApplied: false` as a guard:

```typescript
const [updated] = await db.update(referrals)
  .set({ status: "rewarded", rewardApplied: true })
  .where(and(
    eq(referrals.refereeId, userId),
    eq(referrals.rewardApplied, false)   // no-op if already rewarded
  ))
  .returning();
```

If the webhook fires twice (Razorpay retries on timeout), the second call is a safe no-op.

---

## Subscription Tier Integrity

`POST /api/subscription/verify` activates a user's paid tier after Razorpay checkout. The HMAC signature only proves `payment_id|subscription_id` are authentic — it says nothing about *which tier* was purchased. The route therefore:

1. Fetches the Razorpay subscription server-side: `razorpay.subscriptions.fetch(razorpay_subscription_id)`.
2. Rejects (403) if `razorpaySub.notes.userId !== session.user.id` — the subscription must have been created by this same session (`POST /api/subscription` stamps `notes.userId` server-side).
3. Reads `tier = razorpaySub.notes.tier` and writes **that** tier to the DB — the client-supplied `tier` field (if any) in the verify request body is never trusted.

The `/api/webhooks/razorpay` handler follows the same `notes.tier`/`notes.userId` pattern. This closes a self-serve tier-escalation hole where a user could buy `story_pro` and tamper the verify request to claim `all_access`.

## Sensitive Data Handling

### Higgsfield API Keys

User-supplied Higgsfield API keys are encrypted with AES-256-GCM before storage:

- **Key:** `ENCRYPTION_KEY` env var (64-char hex = 32-byte key)
- **Algorithm:** AES-256-GCM (authenticated encryption — detects tampering)
- **Storage format:** `iv:authTag:ciphertext` (all hex-encoded, colon-separated)
- **Read endpoints return:** `{ keySet: boolean, keyLast4: string }` — never the full key

Implementation: `src/lib/crypto.ts`. The decrypted key is only materialized server-side for Higgsfield API calls.

### Passwords

bcrypt with cost factor 12 (≈250ms on modern hardware). No plaintext passwords are stored or logged.

### Email Normalization

Emails are lowercased and trimmed before storage and lookup:
```typescript
const normalizedEmail = email.toLowerCase().trim();
```

Prevents duplicate accounts from `User@Example.com` vs `user@example.com`.

### Password Reset Tokens

Single-use UUIDs stored in `verificationTokens` table with 1-hour expiry. Tokens are deleted immediately after successful use.

### Email Verification Tokens

Single-use random tokens (32-byte hex) stored in `email_verification_tokens` with 24-hour expiry, issued at registration. `/api/auth/verify-email?token=...` sets `users.emailVerified = now()`. Verification is non-blocking (registration and login both succeed unverified) — `GET /api/subscription` returns `emailVerified` so the UI can show a resend banner.

---

## Security Headers

Configured in `next.config.js` via `headers()`:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Invariants to Maintain

When adding new routes, these invariants must always hold:

1. **Every protected route calls `getRequiredSession()` as the first line.**
2. **Every project-scoped route verifies `project.userId === session.user.id` before any operation.**
3. **Every child-resource UPDATE/DELETE includes `childTable.projectId = projectId` in the WHERE.**
4. **Every collection POST uses explicit field allowlisting — no spreading `req.json()`.**
5. **Every gated feature calls `canAccessFeature(tier, featureName)` before the operation.**
6. **Webhook handlers verify signatures before processing any payload.**
7. **Unauthenticated/token-scoped endpoints verify any client-supplied foreign key belongs to that token's own scope before writing (see Layer 5b).**
8. **Subscription tier written to the DB always comes from Razorpay `notes`, never from a client request body (see Subscription Tier Integrity).**
