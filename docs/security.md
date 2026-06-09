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

All limiters are **fail-open**: if `UPSTASH_REDIS_REST_URL` is not configured, requests pass through. In production, both Upstash env vars must be set.

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
