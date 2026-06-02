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
model: text("model").default("claude-sonnet-4-20250514")
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

## Stripe Webhook Must Use Live Signing Secret for Production

If you configure the Stripe webhook endpoint and then switch from test mode to live mode, the `STRIPE_WEBHOOK_SECRET` changes. The test signing secret and live signing secret are different strings.

Symptoms of using the wrong secret:
- Webhooks arrive but return 400
- `stripe.webhooks.constructEvent()` throws a signature verification error
- Subscriptions appear in Stripe but don't activate in your database

Fix: Copy the signing secret from the **live** webhook endpoint configuration, not the test endpoint.

---

## `getUserTier()` Caches for 5 Minutes

After a user upgrades, there is up to a 5-minute delay before new features unlock. This is because `getUserTier()` caches subscription tier lookups in memory.

If you need immediate tier invalidation (e.g., after a Stripe webhook), clear the cache:

```typescript
// In the webhook handler, after updating the subscription
tierCache.delete(userId);
```

Without this, a user who just paid might see "upgrade required" for up to 5 minutes after their payment completes.

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
