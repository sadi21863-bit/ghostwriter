# Pre-Launch Polish: C-3 (Email Verification) + A-MEDIUM-1 (Reader Reaction Scoping) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two items from `ghostwriter-work-order.md`'s "Pre-launch polish block": (1) A-MEDIUM-1 — validate that a reader-session's reaction `chapterId` actually belongs to that session's project before inserting (currently an unauthenticated public endpoint accepts an arbitrary `chapterId`), and (2) C-3 — enforce the long-dead `users.emailVerified` column via a token-based verification flow (mirroring the existing password-reset pattern), with a soft (non-blocking) UI reminder banner + resend button, plus a backfill script that grandfathers existing users so nobody currently in production is affected.

**Architecture:** Task 1 is a small, self-contained fix to `src/app/api/reader/[token]/route.ts` with a new test file. Tasks 2 and 3 add a new `email_verification_tokens` table (mirrors `password_reset_tokens`), a new email template, two new auth routes (`/api/auth/verify-email` GET, `/api/auth/resend-verification` POST), wire token issuance into the existing `/api/auth/register` flow, add a one-off backfill script for existing users, and surface verification status via `/api/subscription` GET into a new dismissible banner in `GhostWriterApp.tsx` (modeled on the existing trial banner).

**Tech Stack:** Next.js 16 App Router route handlers, Drizzle ORM 0.45.x / Neon Postgres, NextAuth (`getRequiredSession()`), Resend (`sendEmail`), Vitest.

---

## Task 1: A-MEDIUM-1 — Scope reader reactions to the session's project

**Files:**
- Modify: `src/app/api/reader/[token]/route.ts`
- Create: `src/app/api/reader/[token]/__tests__/route.test.ts`

**Context:** `src/app/api/reader/[token]/route.ts` is a **public, unauthenticated** endpoint (a reader-session token, not a user session). Its `POST` handler currently inserts a `readerReactions` row using a client-supplied `chapterId` without checking that the chapter belongs to the project the reader-session token was issued for (`session.projectId`). A malicious caller holding a valid (or even expired-but-guessable) reader token could insert reaction rows pointing at chapters from *other* projects. `chapters` and `and`/`eq` are already imported.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/reader/[token]/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstReaderSessions = vi.fn();
const findFirstChapters = vi.fn();
const insertReturning = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      readerSessions: { findFirst: (...args: any[]) => findFirstReaderSessions(...args) },
      chapters: { findFirst: (...args: any[]) => findFirstChapters(...args) },
    },
    insert: () => ({
      values: () => ({
        returning: (...args: any[]) => insertReturning(...args),
      }),
    }),
  },
}));

import { POST } from "../route";

const activeSession = {
  id: "session-1",
  projectId: "project-1",
  token: "tok123",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  createdAt: new Date(),
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/reader/tok123", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/reader/[token]", () => {
  beforeEach(() => {
    findFirstReaderSessions.mockReset();
    findFirstChapters.mockReset();
    insertReturning.mockReset();
  });

  it("returns 404 for an invalid or expired session token", async () => {
    findFirstReaderSessions.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ chapterId: "chapter-1", textOffset: 0, reactionType: "heart" }), {
      params: Promise.resolve({ token: "bad-token" }),
    });

    expect(res.status).toBe(404);
    expect(insertReturning).not.toHaveBeenCalled();
  });

  it("rejects a chapterId that does not belong to the session's project", async () => {
    findFirstReaderSessions.mockResolvedValue(activeSession);
    findFirstChapters.mockResolvedValue(undefined); // chapter not found in this project

    const res = await POST(makeRequest({ chapterId: "other-project-chapter", textOffset: 0, reactionType: "heart" }), {
      params: Promise.resolve({ token: "tok123" }),
    });

    expect(res.status).toBe(400);
    expect(insertReturning).not.toHaveBeenCalled();
  });

  it("inserts a reaction when the chapter belongs to the session's project", async () => {
    findFirstReaderSessions.mockResolvedValue(activeSession);
    findFirstChapters.mockResolvedValue({ id: "chapter-1" });
    insertReturning.mockResolvedValue([{ id: "reaction-1", chapterId: "chapter-1", textOffset: 0, reactionType: "heart" }]);

    const res = await POST(makeRequest({ chapterId: "chapter-1", textOffset: 0, reactionType: "heart" }), {
      params: Promise.resolve({ token: "tok123" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("reaction-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/reader/[token]/__tests__/route.test.ts`
Expected: the second and third tests FAIL (no chapter ownership check exists yet, so `insertReturning` is called even when the chapter doesn't belong to the project, and the 400 status is never returned).

- [ ] **Step 3: Add the chapter ownership check**

In `src/app/api/reader/[token]/route.ts`, replace the `POST` function body:

```ts
export async function POST(req: Request, { params }: Ctx) {
  const session = await getActiveSession((await params).token);
  if (!session) return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });

  const { chapterId, textOffset, reactionType } = await req.json();
  if (!chapterId || textOffset === undefined || !reactionType)
    return NextResponse.json({ error: "chapterId, textOffset, and reactionType required" }, { status: 400 });

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, chapterId), eq(chapters.projectId, session.projectId)),
    columns: { id: true },
  });
  if (!chapter) return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });

  const [reaction] = await db.insert(readerReactions).values({
    sessionId: session.id,
    chapterId,
    textOffset,
    reactionType,
  }).returning();

  return NextResponse.json(reaction);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/reader/[token]/__tests__/route.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: full suite passes (existing 77 tests + 3 new = 80), `tsc` exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/reader/[token]/route.ts "src/app/api/reader/[token]/__tests__/route.test.ts"
git commit -m "fix: scope reader reactions to the session's project (A-MEDIUM-1)"
```

---

## Task 2: C-3 — Email verification: token issuance, verify + resend routes, backfill script

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/lib/email/templates.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/verify-email/route.ts`
- Create: `src/app/api/auth/resend-verification/route.ts`
- Create: `scripts/backfill-email-verified.js`

**Context:** `users.emailVerified timestamp` already exists in the schema (`src/db/schema.ts:13`) but is never set or read anywhere. This task wires it up end-to-end using the **same pattern** as the existing password-reset flow (`passwordResetTokens` table at `src/db/schema.ts:409-416`, `forgot-password`/`reset-password` routes). New registrations get a verification email; existing users are grandfathered via a backfill script so nobody is locked out. (Task 3 adds the UI banner + resend wiring — this task is backend-only.)

- [ ] **Step 1: Add the `email_verification_tokens` table**

In `src/db/schema.ts`, immediately after the `passwordResetTokens` table definition (ends at line 416 with `});`), add:

```ts
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id:        uuid("id").defaultRandom().primaryKey(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt:    timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Push the schema change**

Run (Windows):
```bash
copy .env.local .env
npx drizzle-kit generate
npx drizzle-kit push
```
Expected: a new migration file is generated for `email_verification_tokens`, and `drizzle-kit push` confirms the table exists (the pre-existing false-positive `vector → vector(1536)` warning on `work_packets.embedding` is expected and harmless — see CLAUDE.md).

- [ ] **Step 3: Add the verification email template**

In `src/lib/email/templates.ts`, add (after `passwordResetEmail`, before `trialStartEmail` is fine):

```ts
export function verificationEmail(name: string, verifyUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: "Verify your email — GhostWriter",
    text: `Hi ${name || 'there'},\n\nVerify your email to confirm your GhostWriter account:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— GhostWriter`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 24px;">
        <h2 style="font-size:20px;margin-bottom:16px;">Verify your email</h2>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          Confirm your email address to finish setting up your GhostWriter account.
          This link expires in 24 hours.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;margin-top:20px;padding:12px 28px;
                  background:#4F46E5;color:#fff;text-decoration:none;
                  border-radius:8px;font-size:15px;">
          Verify email →
        </a>
      </div>`,
  };
}
```

- [ ] **Step 4: Issue a verification token on registration**

In `src/app/api/auth/register/route.ts`:

1. Update the schema import (line 5) to add `emailVerificationTokens`:
   ```ts
   import { users, referrals, subscriptions, emailVerificationTokens } from "@/db/schema";
   ```
2. Update the templates import (line 10) to add `verificationEmail`:
   ```ts
   import { welcomeEmail, verificationEmail } from "@/lib/email/templates";
   ```
3. After the existing welcome-email block (the `sendEmail({ to: email, ... }).catch(() => {});` line for `welcomeEmail`), add:
   ```ts
   // Issue an email-verification token (non-blocking — never blocks registration)
   const verifyToken = randomBytes(32).toString('hex');
   const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
   await db.insert(emailVerificationTokens).values({ userId: user.id, token: verifyToken, expiresAt: verifyExpiresAt });
   const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verifyToken}`;
   const verification = verificationEmail(name ?? "", verifyUrl);
   sendEmail({ to: email, subject: verification.subject, html: verification.html, text: verification.text }).catch(() => {});
   ```
   (`randomBytes` is already imported at the top of this file.)

- [ ] **Step 5: Create the verify-email route**

Create `src/app/api/auth/verify-email/route.ts`:

```ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, emailVerificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const dashboardUrl = new URL('/dashboard', req.url);

  if (!token) {
    dashboardUrl.searchParams.set('email_verified', 'error');
    return NextResponse.redirect(dashboardUrl);
  }

  const verificationToken = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.token, token),
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    dashboardUrl.searchParams.set('email_verified', 'error');
    return NextResponse.redirect(dashboardUrl);
  }

  await db.update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, verificationToken.userId));

  await db.update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, verificationToken.id));

  dashboardUrl.searchParams.set('email_verified', '1');
  return NextResponse.redirect(dashboardUrl);
}
```

- [ ] **Step 6: Create the resend-verification route**

Create `src/app/api/auth/resend-verification/route.ts`:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, emailVerificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';
import { verificationEmail } from '@/lib/email/templates';
import { getRequiredSession } from '@/lib/auth-helpers';

export async function POST() {
  const session = await getRequiredSession();

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, name: true, email: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({ userId: user.id, token, expiresAt });

  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
  const { subject, html, text } = verificationEmail(user.name ?? '', verifyUrl);
  await sendEmail({ to: user.email, subject, html, text });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Backfill existing users**

Create `scripts/backfill-email-verified.js` (mirrors `scripts/backfill-subscriptions.js`):

```js
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function backfill() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }
  const sql = neon(dbUrl);

  const unverified = await sql`
    SELECT id, email, created_at
    FROM users
    WHERE email_verified IS NULL
  `;

  console.log(`Found ${unverified.length} user(s) without email_verified set.`);

  let updated = 0;
  for (const user of unverified) {
    await sql`
      UPDATE users SET email_verified = ${user.created_at} WHERE id = ${user.id}
    `;
    console.log(`VERIFIED (grandfathered): ${user.email} (${user.id})`);
    updated++;
  }

  console.log(`\nDone. Grandfathered ${updated} existing user(s) as email-verified.`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
```

Run it once against production (after the schema push in Step 2):
```bash
node scripts/backfill-email-verified.js
```

- [ ] **Step 8: Run full suite + typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: existing suite still passes (these new routes have no dedicated unit tests, matching the existing untested `register`/`forgot-password`/`reset-password` routes — consistent with established convention), `tsc` exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema.ts src/lib/email/templates.ts src/app/api/auth/register/route.ts src/app/api/auth/verify-email/route.ts src/app/api/auth/resend-verification/route.ts scripts/backfill-email-verified.js drizzle/
git commit -m "feat: enforce email verification via token-based flow (C-3)"
```

(Include the new `drizzle/*.sql` migration + `drizzle/meta/*` files generated in Step 2 — see Task 3 of the merged work order's A-MEDIUM-4 about migration tracking; for now just include whatever `drizzle-kit generate` produced for this change.)

---

## Task 3: C-3 — Verification status banner + resend button in the app shell

**Files:**
- Modify: `src/app/api/subscription/route.ts`
- Modify: `src/components/GhostWriterApp.tsx`

**Context:** This task surfaces the `emailVerified` status from Task 2 in the UI as a soft, dismissible reminder banner with a "Resend email" button — never blocking generation or dashboard access (per the work order: "Keep the gate soft enough not to block trial activation"). It is modeled directly on the existing trial banner at `src/components/GhostWriterApp.tsx:199-206`.

- [ ] **Step 1: Add `emailVerified` to `GET /api/subscription`**

In `src/app/api/subscription/route.ts`, replace the entire `GET` function (currently lines 26-58) with:

```ts
// GET — current subscription info (returns tier, status, currentPeriodEnd, emailVerified for settings UI)
export async function GET() {
  const session = await getRequiredSession();
  const { db } = await import('@/db');
  const { subscriptions, users } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
    columns: { tier: true, status: true, currentPeriodEnd: true },
  });

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { trialEndAt: true, emailVerified: true },
  });
  const emailVerified = user?.emailVerified != null;

  const tier = sub?.tier ?? 'free';

  // 7-day Story Pro trial: report story_pro/trialing so the existing trial banner renders.
  if (tier === 'free' && user?.trialEndAt && new Date(user.trialEndAt) > new Date()) {
    return NextResponse.json({
      tier: 'story_pro',
      status: 'trialing',
      currentPeriodEnd: user.trialEndAt.toISOString(),
      emailVerified,
    });
  }

  return NextResponse.json({
    tier,
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    emailVerified,
  });
}
```

- [ ] **Step 2: Extend the `subscription` state type and add banner state**

In `src/components/GhostWriterApp.tsx`, change line 65 from:
```ts
  const [subscription, setSubscription] = useState<{ status: string; currentPeriodEnd: string | null } | null>(null);
```
to:
```ts
  const [subscription, setSubscription] = useState<{ status: string; currentPeriodEnd: string | null; emailVerified?: boolean } | null>(null);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendSent, setResendSent] = useState(false);
```

- [ ] **Step 3: Add the banner JSX**

In `src/components/GhostWriterApp.tsx`, immediately after the trial banner block (the `{trialDaysLeft !== null && ( ... )}` block ending at line 206), add:

```tsx
      {subscription?.emailVerified === false && !verifyBannerDismissed && (
        <div style={{ background: 'rgba(79,70,229,0.1)', borderBottom: '1px solid rgba(79,70,229,0.2)', padding: '7px 16px', fontSize: 12, textAlign: 'center', color: '#4F46E5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span>Verify your email to secure your account.</span>
          <button
            onClick={async () => {
              setResendingVerification(true);
              try {
                await fetch('/api/auth/resend-verification', { method: 'POST' });
                setResendSent(true);
              } finally {
                setResendingVerification(false);
              }
            }}
            disabled={resendingVerification || resendSent}
            style={{ background: 'none', border: '1px solid #4F46E5', color: '#4F46E5', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {resendSent ? 'Sent!' : resendingVerification ? 'Sending…' : 'Resend email'}
          </button>
          <button
            onClick={() => setVerifyBannerDismissed(true)}
            style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
```

- [ ] **Step 4: Run full suite + typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: full suite passes, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/subscription/route.ts src/components/GhostWriterApp.tsx
git commit -m "feat: surface email verification status with resend banner (C-3)"
```
