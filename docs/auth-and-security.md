# Authentication and Security

How users authenticate, how routes stay protected, how rate limiting works, and how sensitive data is stored.

---

## Authentication Stack

- **NextAuth.js v4** — handles session management, OAuth, JWT
- **Database sessions** — sessions stored in `sessions` table (not stateless JWTs)
- **bcryptjs** — password hashing for credential provider
- **Drizzle adapter** — custom adapter connecting NextAuth to the Neon database

### Auth Config: `src/lib/auth.ts`

The NextAuth configuration sets up:

1. **Credentials provider** — email + password
   - Looks up user by email in `users` table
   - `bcrypt.compare(password, user.hashedPassword)`
   - Returns user object if valid, `null` otherwise

2. **Database session strategy** — sessions are rows in the `sessions` table
   - Enables session invalidation (force logout)
   - Required for database adapter

3. **Callbacks** — enriches the session object with `userId` from the database

4. **Custom pages** — `/login`, `/forgot-password`, `/reset-password`

---

## Session Enforcement: `src/lib/auth-helpers.ts`

```typescript
export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export async function getOptionalSession() {
  return getServerSession(authOptions);
}
```

**Why throw instead of return null?**
Every protected route would need to check the return value and early-return a 401 manually. Throwing means the route handler doesn't need any auth boilerplate — the first line is `const session = await getRequiredSession()` and execution never reaches the next line if unauthenticated.

This pattern assumes Next.js App Router — thrown `NextResponse` objects are caught by the framework and sent as responses.

---

## Ownership Enforcement

Every project-scoped route checks ownership before any operation:

```typescript
const project = await db.query.projects.findFirst({
  where: and(
    eq(projects.id, params.projectId),
    eq(projects.userId, session.user.id)
  ),
});
if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

**Why 404 instead of 403?**
Returning 403 would reveal that the project ID exists but belongs to someone else. 404 gives no information about whether the resource exists at all. This is the standard approach for multi-tenant apps where project IDs might be guessable (UUIDs are not, but the pattern is still correct).

**Why application-level checks, not database RLS?**
Row-level security (like Supabase RLS `auth.uid()`) ties authorization logic to the database layer. This project's authorization is intentionally in the application layer:

1. The checks are explicit, readable, and testable
2. They work with any Postgres (Neon, Railway, local) without Supabase-specific features
3. RLS doesn't help when the DB client is a server-side process that already has full access

---

## Rate Limiting: `src/lib/ratelimit.ts`

Rate limiting uses [Upstash Redis](https://upstash.com) — a serverless Redis service with a REST API. The `@upstash/ratelimit` library provides sliding-window rate limiting.

### Four Limiters

```typescript
const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1m"),  // 20 per minute — per userId
  prefix: "gw:ai",
});

const generalRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1m"), // 100 per minute — per userId
  prefix: "gw:general",
});

const freeGenerationLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1d"),  // 10 per day — per userId (free tier)
  prefix: "gw:free",
});

const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1h"),   // 5 per hour — per IP (prevents account enumeration)
  prefix: "gw:auth",
});
```

`authRatelimit` applies to registration and forgot-password endpoints, keyed by IP address (not userId, since no session exists yet).

### Fail-Open Design

```typescript
if (!process.env.UPSTASH_REDIS_REST_URL) {
  return null; // allow — no rate limiting configured
}
```

When Redis is not configured, `checkAiRateLimit()` returns `null` (allow request). This means:
- Development environments work without a Redis instance
- The app does not crash on missing env vars
- Rate limiting is opt-in via environment configuration

In production, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must always be set.

### Response Headers

When rate-limited, the response includes standard headers:
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1717305600
Retry-After: 42
```

---

## Password Security

### Registration (`/api/auth/register`)
```typescript
const hashedPassword = await bcrypt.hash(password, 12); // cost factor 12
```

Cost factor 12 produces ~250ms hash time on modern hardware — enough to be brute-force-resistant, not so slow it impacts UX.

### Password Reset Flow
1. User submits email to `/api/auth/forgot-password`
2. Generates a time-limited token (UUID) stored in `verificationTokens` table with 1-hour expiry
3. Sends email via Resend with reset link containing token
4. User clicks link → `/reset-password?token=xxx`
5. `/api/auth/reset-password` validates token (not expired, not used), hashes new password, invalidates token

Tokens are single-use — once a reset completes, the `verificationTokens` row is deleted.

---

## API Key Encryption

Users can provide their own Higgsfield API key for video generation. These keys are stored encrypted at rest.

**Algorithm:** AES-256-GCM (authenticated encryption)
**Key source:** `ENCRYPTION_KEY` environment variable (64-char hex = 32 bytes = 256-bit key)
**Implementation:** `src/lib/crypto.ts`

### What's stored in the DB

```
users.higgsfield_api_key: "iv:authTag:ciphertext" (all hex-encoded)
```

### What GET routes return

```json
{
  "keySet": true,
  "keyLast4": "4a2f"
}
```

The full key is never returned from any route. The decrypted key is used server-side only for Higgsfield API calls.

---

## Cron Security

The cleanup cron (`/api/cron/cleanup`) is protected by a bearer token:

```typescript
const authHeader = req.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Vercel calls this route on schedule. The `CRON_SECRET` environment variable must match the `Authorization: Bearer` header Vercel sends. This prevents anyone from triggering the cleanup route externally.

---

## IDOR Protection

Insecure Direct Object Reference (IDOR) vulnerabilities occur when a route verifies project ownership but then uses only the child resource ID in the WHERE clause, allowing a logged-in user to mutate another user's characters/locations/plot threads via a cross-project request.

### The Pattern

Every child resource UPDATE and DELETE uses both the child ID **and** the parent project ID in the WHERE clause:

```typescript
// ✅ Correct — both conditions required
await db.update(characters)
  .set({ ...data, updatedAt: new Date() })
  .where(and(
    eq(characters.id, characterId),       // resource ID from URL
    eq(characters.projectId, projectId)   // project ID from URL (ownership already verified above)
  ));

// ❌ Wrong — only child ID — allows cross-project mutation
await db.update(characters)
  .set(data)
  .where(eq(characters.id, characterId));
```

The project-level ownership check (`verifyOwnership()`) confirms `project.userId === session.user.id`. The child-level `projectId` condition on the UPDATE ensures the character actually belongs to the verified project — not just that the project belongs to the user.

### Routes with Double-Guard WHERE Clauses

- `PATCH/DELETE /api/projects/[projectId]/characters/[characterId]`
- `PATCH/DELETE /api/projects/[projectId]/locations/[locationId]`
- `PATCH/DELETE /api/projects/[projectId]/plot-threads/[threadId]`
- `PATCH/DELETE /api/projects/[projectId]/chapters/[chapterId]`
- `GET/PATCH/DELETE /api/projects/[projectId]/production/shots/[shotId]`
- `POST /api/projects/[projectId]/suggest-links` (character/location lookups include projectId)
- `PATCH/DELETE /api/universes/[universeId]` (checks `universes.userId = session.user.id`)

---

## POST Body Injection Protection

Collection POST routes used to spread the raw request body directly into DB inserts:

```typescript
// ❌ Before — client can set any column
const body = await req.json();
await db.insert(characters).values({ projectId, ...body });
```

All collection inserts now use explicit field allowlisting:

```typescript
// ✅ After — only allowed fields reach the DB
const { name, role, age, appearance, personality, ... } = await req.json();
if (!name || typeof name !== "string") return 400;
await db.insert(characters).values({ projectId, name, role, age, appearance, ... });
```

Routes hardened: `/characters` (POST), `/locations` (POST), `/plot-threads` (POST), `/reference-works` (POST).

---

## Email Normalization

Registration normalizes email before inserting to the database:

```typescript
const normalizedEmail = email.toLowerCase().trim();
```

This prevents duplicate accounts from `User@Example.com` vs `user@example.com`.

---

## Content Security

### No Image Data in DB

Image URLs from Segmind and Higgsfield (character portraits, comic panels, video shots) are stored as URLs only. The binary data lives in the provider's storage. If a URL expires or a provider goes down, the image is lost — but the DB stays lean.

### Razorpay Webhook Verification

The Razorpay webhook endpoint (`/api/webhooks/razorpay`) verifies the HMAC-SHA256 signature on every incoming event:

```typescript
const expectedSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
  .update(rawBody)
  .digest("hex");

if (expectedSignature !== razorpaySignature) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
}
```

Unverified events are rejected with 400. This prevents fake subscription activation events from being processed.

---

## Security Headers

Configured in `next.config.js` via the `headers()` function:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; ...
```

The CSP is configured to allow:
- Fonts from `fonts.googleapis.com`
- Anthropic API calls (blocked — they go through the server, not the browser)
- Stripe.js from `js.stripe.com`
- Sentry SDK

---

## What's Never Done

These patterns are explicitly avoided:

- **No Supabase RLS** — authorization is in the application layer, not the DB
- **No client-side Anthropic calls** — API key never reaches the browser
- **No client-side OpenAI calls** — same reason
- **No committing `.env.local`** — gitignored; never included in commits
- **No skipping `getRequiredSession()`** — every protected route calls it as its first line
- **No spreading `req.json()` into DB inserts** — explicit field allowlisting on all collection POST routes
- **No child-resource-only WHERE clauses** — all UPDATE/DELETE include both `childId` and `projectId`
