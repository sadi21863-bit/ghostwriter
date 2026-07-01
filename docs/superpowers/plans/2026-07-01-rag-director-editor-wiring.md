# RAG Director/Editor Context Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire voice-fingerprint and story-promise context into the three Editor-role tools and two Director-role tools that currently call Anthropic with no retrieval context.

**Architecture:** Three independent additions: (1) a new `"preserve"` mode on `buildPromiseLedger` with a different instruction header, (2) synchronous voice-fingerprint + async promise-ledger appended to the system prompts of `refine`, `prose-fix`, and `surgical-edit`, (3) `buildPromiseLedger` + `buildVoiceExemplars` appended to `villain-pov` and `buildPromiseLedger` folded into the `generate-package` user prompt. All helpers are already fail-open; the additions degrade silently to today's behavior when they return `""`.

**Tech Stack:** TypeScript, Next.js App Router routes, Anthropic SDK, Drizzle ORM, Vitest.

## Global Constraints

- All helpers (`buildPromiseLedger`, `buildVoiceExemplars`, `extractVoiceFingerprint`, `fingerprintToConstraints`) MUST continue to fail-open — a helper returning `""` must leave the system/user prompt unchanged from today's behavior.
- `buildPromiseLedger` default parameter `mode = "generate"` — the existing call in `generate/route.ts:340` must be unaffected with zero changes to that file.
- `"preserve"` mode header: `"OPEN STORY PROMISES (do NOT delete, contradict, or accidentally resolve any of these while editing — if your edit touches a sentence connected to one of these, preserve its substance):"` — copy verbatim.
- `"generate"` mode header (unchanged): `"OPEN STORY PROMISES (honor these threads — advance or deepen them; do NOT resolve prematurely or let them vanish):"` — must still match existing tests.
- No new DB tables, no schema migrations, no UI changes.
- `refine`, `prose-fix`, `surgical-edit`, `villain-pov` stay gated behind `story_modes_advanced`. `generate-package` remains ungated — no tier gate added.
- Voice fingerprint is computed from the passage already in the request body (pure sync, zero added network calls). Minimum threshold: `extractVoiceFingerprint` already returns `null` when text is under 500 chars or under 10 sentences — no new guard needed.
- TDD: failing test first for every changed unit. Run `npx vitest run <test-file>` to verify fail then pass.

---

### Task 1: `buildPromiseLedger` preserve mode

**Files:**
- Modify: `src/lib/ai/promise-ledger.ts`
- Test: `src/lib/ai/__tests__/promise-ledger.test.ts`

**Interfaces:**
- Consumes: nothing new — same Drizzle query inside the existing function.
- Produces: `buildPromiseLedger(projectId: string, mode?: "generate" | "preserve"): Promise<string>` — Tasks 2–5 call this with the new signature.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/ai/__tests__/promise-ledger.test.ts` (append after the existing `describe` block):

```ts
describe('buildPromiseLedger — preserve mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the preserve-mode header when mode is 'preserve'", async () => {
    findMany.mockResolvedValue([
      { chapterIndex: 0, structuredData: { openPromisesCreated: ["the missing letter"], openPromisesResolved: [] } },
    ]);
    const result = await buildPromiseLedger("proj-1", "preserve");
    expect(result).toContain("do NOT delete, contradict, or accidentally resolve");
    expect(result).not.toContain("advance or deepen them");
    expect(result).toContain("the missing letter");
  });

  it("defaults to generate mode when mode param is omitted (regression check)", async () => {
    findMany.mockResolvedValue([
      { chapterIndex: 0, structuredData: { openPromisesCreated: ["the missing letter"], openPromisesResolved: [] } },
    ]);
    const result = await buildPromiseLedger("proj-1");
    expect(result).toContain("advance or deepen them");
    expect(result).not.toContain("do NOT delete");
  });

  it("fails open in preserve mode (returns empty string when DB throws)", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    const result = await buildPromiseLedger("proj-1", "preserve");
    expect(result).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/lib/ai/__tests__/promise-ledger.test.ts
```
Expected: 3 new tests FAIL with `"preserve"` not a valid argument / wrong header.

- [ ] **Step 3: Implement preserve mode**

Replace the entire `buildPromiseLedger` function in `src/lib/ai/promise-ledger.ts`:

```ts
export async function buildPromiseLedger(
  projectId: string,
  mode: "generate" | "preserve" = "generate",
): Promise<string> {
  try {
    const memories = await db.query.storyMemories.findMany({
      where: eq(storyMemories.projectId, projectId),
      orderBy: (m, { asc }) => [asc(m.chapterIndex)],
    });
    const created: string[] = [];
    const resolved: string[] = [];
    for (const m of memories) {
      const sd = (m as any).structuredData || {};
      (sd.openPromisesCreated || []).forEach((p: string) => { if (p?.trim()) created.push(p.trim()); });
      (sd.openPromisesResolved || []).forEach((p: string) => { if (p?.trim()) resolved.push(p.trim()); });
    }
    const open = created.filter(
      (p) => !resolved.some((r) => r && (r.includes(p) || p.includes(r))),
    );
    const uniq = [...new Set(open)].slice(-8);
    if (!uniq.length) return "";
    const header =
      mode === "preserve"
        ? "OPEN STORY PROMISES (do NOT delete, contradict, or accidentally resolve any of these while editing — if your edit touches a sentence connected to one of these, preserve its substance):"
        : "OPEN STORY PROMISES (honor these threads — advance or deepen them; do NOT resolve prematurely or let them vanish):";
    return header + "\n" + uniq.map((p) => `- ${p}`).join("\n");
  } catch {
    return "";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/lib/ai/__tests__/promise-ledger.test.ts
```
Expected: all tests PASS (including the 4 original tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/promise-ledger.ts src/lib/ai/__tests__/promise-ledger.test.ts
git commit -m "feat: add preserve mode to buildPromiseLedger"
```

---

### Task 2: `refine` route — voice fingerprint + preserve ledger

**Files:**
- Modify: `src/lib/ai/engine.ts` (add `extraContext` param to `refinePassage`)
- Modify: `src/app/api/ai/refine/route.ts`
- Test: `src/app/api/ai/refine/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `buildPromiseLedger(projectId, "preserve")` from Task 1; `extractVoiceFingerprint`, `fingerprintToConstraints` from `@/lib/ai/voice-fingerprint` (existing exports).
- Produces: `refinePassage(text: string, format: string, extraContext?: string)` — the third param is optional so all other callers are unaffected.

- [ ] **Step 1: Write failing tests**

Append to `src/app/api/ai/refine/__tests__/route.test.ts` (after the existing mock setup block, before `describe`):

```ts
// New mocks for context helpers
const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args),
}));

const extractVoiceFingerprint = vi.fn();
const fingerprintToConstraints = vi.fn();
vi.mock("@/lib/ai/voice-fingerprint", () => ({
  extractVoiceFingerprint: (...args: any[]) => extractVoiceFingerprint(...args),
  fingerprintToConstraints: (...args: any[]) => fingerprintToConstraints(...args),
}));
```

Then append inside the existing `describe("POST /api/ai/refine", ...)` block:

```ts
  it("passes voice constraints to refinePassage when fingerprint succeeds", async () => {
    refinePassage.mockResolvedValue({ text: "polished", tokensUsed: 10, model: "claude" });
    extractVoiceFingerprint.mockReturnValue({ avgSentenceLength: 12 });
    fingerprintToConstraints.mockReturnValue("BINDING VOICE CONSTRAINTS");
    buildPromiseLedger.mockResolvedValue("");
    await POST(makeRequest({ text: "a passage long enough to pass the minimum length check", format: "Novel", projectId: "proj-1" }));
    expect(refinePassage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.stringContaining("BINDING VOICE CONSTRAINTS"),
    );
  });

  it("passes promise ledger to refinePassage when projectId is supplied", async () => {
    refinePassage.mockResolvedValue({ text: "polished", tokensUsed: 10, model: "claude" });
    extractVoiceFingerprint.mockReturnValue(null);
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    await POST(makeRequest({ text: "a passage long enough to pass the minimum length check", format: "Novel", projectId: "proj-1" }));
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "preserve");
    expect(refinePassage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.stringContaining("OPEN STORY PROMISES"),
    );
  });

  it("calls refinePassage with empty extraContext when helpers return empty strings", async () => {
    refinePassage.mockResolvedValue({ text: "polished", tokensUsed: 10, model: "claude" });
    extractVoiceFingerprint.mockReturnValue(null);
    buildPromiseLedger.mockResolvedValue("");
    await POST(makeRequest({ text: "a passage long enough to pass the minimum length check", format: "Novel" }));
    expect(refinePassage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "",
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/app/api/ai/refine/__tests__/route.test.ts
```
Expected: 3 new tests FAIL.

- [ ] **Step 3: Add `extraContext` param to `refinePassage` in `engine.ts`**

In `src/lib/ai/engine.ts`, find `export async function refinePassage(text: string, format: string)` and replace the function signature and system string construction:

```ts
export async function refinePassage(
  text: string,
  format: string,
  extraContext = "",
): Promise<{ text: string; tokensUsed: number; model: string }> {
  const model = MODELS.default;
  const baseSystem = `You are a precise line editor for ${format} fiction. Revise the passage to remove AI-slop while preserving the author's plot, meaning, characters, facts, and VOICE exactly. Fix ONLY these defects:
- cliché openings and stock phrases ("little did they know", "the air was thick with", "a chill ran down")
- filler transitions and throat-clearing ("as the sun dipped below the horizon", "without warning")
- vague emotional summaries — replace naming an emotion ("she felt sad") with physical/behavioral evidence
- repetitive sentence rhythm and repeated sentence openers
- forced, mixed, or purple metaphors
- telling where showing is stronger
- dialogue where every character sounds the same

HARD RULES:
- Do NOT change plot events, character decisions, or established facts.
- Do NOT add new scenes, characters, or content. Do NOT summarize.
- Keep length within ~10% of the original. Preserve paragraph breaks.
- Return ONLY the revised prose — no preamble, no commentary, no labels.`;
  const system = extraContext ? `${baseSystem}\n\n${extraContext}` : baseSystem;
  const msg = await client.messages.create({
    model,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: text.slice(0, 16000) }],
  });
  const out = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  return { text: out, tokensUsed: msg.usage.input_tokens + msg.usage.output_tokens, model };
}
```

- [ ] **Step 4: Update `refine/route.ts`**

Replace `src/app/api/ai/refine/route.ts` in full:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { refinePassage } from "@/lib/ai/engine";
import { extractVoiceFingerprint, fingerprintToConstraints } from "@/lib/ai/voice-fingerprint";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { text, format, projectId, chapterId } = await req.json();
  if (!text?.trim() || text.trim().length < 40) {
    return NextResponse.json({ error: "Write a bit more before polishing." }, { status: 400 });
  }

  const gate = await meterAndGate(session.user.id, "refine");
  if (gate) return gate;

  const fp = extractVoiceFingerprint([text]);
  const voiceConstraints = fp ? fingerprintToConstraints(fp) : "";
  const promiseLedger = projectId ? await buildPromiseLedger(projectId, "preserve") : "";
  const extraContext = [voiceConstraints, promiseLedger].filter(Boolean).join("\n\n");

  try {
    const r = await refinePassage(text, format || "Novel", extraContext);
    await db.insert(generations).values({
      projectId: projectId || null, chapterId: chapterId || null,
      mode: "refine", prompt: "polish", output: r.text, model: r.model, tokensUsed: r.tokensUsed,
    });
    await track(session.user.id, 'ai_generation', { mode: 'refine', format: format ?? '' });
    return NextResponse.json(r);
  } catch (e: any) {
    await refundCredits(session.user.id, "refine");
    console.error(`[refine] ${e?.status} ${(e?.message || '').slice(0, 200)}`);
    return NextResponse.json({ error: "Polish failed. Please try again." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run src/app/api/ai/refine/__tests__/route.test.ts
```
Expected: all tests PASS.

- [ ] **Step 6: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/engine.ts src/app/api/ai/refine/route.ts src/app/api/ai/refine/__tests__/route.test.ts
git commit -m "feat: wire voice fingerprint and preserve-mode ledger into refine route"
```

---

### Task 3: `prose-fix` + `surgical-edit` routes

**Files:**
- Modify: `src/app/api/ai/prose-fix/route.ts`
- Modify: `src/app/api/ai/surgical-edit/route.ts`
- Create: `src/app/api/ai/prose-fix/__tests__/route.test.ts`
- Create: `src/app/api/ai/surgical-edit/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `buildPromiseLedger(projectId, "preserve")` from Task 1; `extractVoiceFingerprint`, `fingerprintToConstraints` from `@/lib/ai/voice-fingerprint`; `proseTargetedFixSystemPrompt`, `surgicalEditSystemPrompt` from `@/lib/ai/prompts`.
- Produces: both routes now accept optional `projectId?: string` in their request body and append voice + preserve-ledger context to their system prompts.

- [ ] **Step 1: Create failing test for `prose-fix`**

Create `src/app/api/ai/prose-fix/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
const meterAndGate = vi.fn();
const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "pro"),
  canAccessFeature: vi.fn(() => true),
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args),
}));
const extractVoiceFingerprint = vi.fn();
const fingerprintToConstraints = vi.fn();
vi.mock("@/lib/ai/voice-fingerprint", () => ({
  extractVoiceFingerprint: (...args: any[]) => extractVoiceFingerprint(...args),
  fingerprintToConstraints: (...args: any[]) => fingerprintToConstraints(...args),
}));

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/prose-fix", {
    method: "POST", body: JSON.stringify(body),
  });
}

describe("POST /api/ai/prose-fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meterAndGate.mockResolvedValue(null);
    createMessage.mockResolvedValue({
      content: [{ type: "text", text: "fixed prose" }],
    });
    buildPromiseLedger.mockResolvedValue("");
    extractVoiceFingerprint.mockReturnValue(null);
  });

  it("appends voice constraints to system prompt when fingerprint succeeds", async () => {
    extractVoiceFingerprint.mockReturnValue({ avgSentenceLength: 12 });
    fingerprintToConstraints.mockReturnValue("BINDING VOICE CONSTRAINTS");
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing" }));
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("BINDING VOICE CONSTRAINTS"),
      }),
    );
  });

  it("appends promise ledger to system prompt when projectId is supplied", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing", projectId: "proj-1" }));
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "preserve");
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("OPEN STORY PROMISES"),
      }),
    );
  });

  it("system prompt is unchanged when helpers return empty (fail-open)", async () => {
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing" }));
    const call = createMessage.mock.calls[0][0];
    expect(call.system).not.toContain("\n\n");
  });

  it("skips buildPromiseLedger when no projectId", async () => {
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing" }));
    expect(buildPromiseLedger).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Create failing test for `surgical-edit`**

Create `src/app/api/ai/surgical-edit/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
const meterAndGate = vi.fn();
const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "pro"),
  canAccessFeature: vi.fn(() => true),
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

vi.mock("@/lib/editor/content-migration", () => ({
  isValidTipTapJson: vi.fn(() => false),
  tiptapToPlainText: vi.fn((j: any) => j),
  plainTextToTipTap: vi.fn((t: string) => t),
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args),
}));
const extractVoiceFingerprint = vi.fn();
const fingerprintToConstraints = vi.fn();
vi.mock("@/lib/ai/voice-fingerprint", () => ({
  extractVoiceFingerprint: (...args: any[]) => extractVoiceFingerprint(...args),
  fingerprintToConstraints: (...args: any[]) => fingerprintToConstraints(...args),
}));

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/surgical-edit", {
    method: "POST", body: JSON.stringify(body),
  });
}

const VALID_CHAPTER = "Here is a long enough chapter with several sentences. It contains many words. The protagonist walked slowly. She thought about the situation carefully. There were many things to consider. The plot thickened noticeably. Rain fell outside the window.";

describe("POST /api/ai/surgical-edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meterAndGate.mockResolvedValue(null);
    createMessage.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ found: "walked slowly", replacement: "strode", explanation: "stronger verb" }) }],
    });
    buildPromiseLedger.mockResolvedValue("");
    extractVoiceFingerprint.mockReturnValue(null);
  });

  it("appends voice constraints to system prompt when fingerprint succeeds", async () => {
    extractVoiceFingerprint.mockReturnValue({ avgSentenceLength: 10 });
    fingerprintToConstraints.mockReturnValue("BINDING VOICE CONSTRAINTS");
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs" }));
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("BINDING VOICE CONSTRAINTS"),
      }),
    );
  });

  it("appends promise ledger to system prompt when projectId is supplied", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs", projectId: "proj-1" }));
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "preserve");
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("OPEN STORY PROMISES"),
      }),
    );
  });

  it("system prompt is unchanged when helpers return empty (fail-open)", async () => {
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs" }));
    const call = createMessage.mock.calls[0][0];
    // surgicalEditSystemPrompt() itself has no double-newlines in the same pattern — any extra means we appended
    expect(call.system.endsWith("\n\n")).toBe(false);
  });

  it("skips buildPromiseLedger when no projectId", async () => {
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs" }));
    expect(buildPromiseLedger).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
npx vitest run src/app/api/ai/prose-fix/__tests__/route.test.ts src/app/api/ai/surgical-edit/__tests__/route.test.ts
```
Expected: all tests FAIL.

- [ ] **Step 4: Update `prose-fix/route.ts`**

Replace `src/app/api/ai/prose-fix/route.ts` in full:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { proseTargetedFixSystemPrompt } from "@/lib/ai/prompts";
import { extractVoiceFingerprint, fingerprintToConstraints } from "@/lib/ai/voice-fingerprint";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "prose");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_modes_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'prose_fix' }, { status: 403 });
  }

  const { text, fixInstruction, projectId } = await req.json();

  if (!text?.trim() || !fixInstruction?.trim()) {
    return NextResponse.json({ error: "text and fixInstruction are required" }, { status: 400 });
  }

  const cappedText = text.length > 6000 ? text.slice(0, 6000) + "\n\n[...chapter continues...]" : text;

  const fp = extractVoiceFingerprint([cappedText]);
  const voiceConstraints = fp ? fingerprintToConstraints(fp) : "";
  const promiseLedger = projectId ? await buildPromiseLedger(projectId, "preserve") : "";
  const extra = [voiceConstraints, promiseLedger].filter(Boolean).join("\n\n");
  const system = proseTargetedFixSystemPrompt(fixInstruction) + (extra ? `\n\n${extra}` : "");

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: cappedText }],
    });

    const result = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as any).text)
      .join("");

    return NextResponse.json({ result });
  } catch (e: any) {
    await refundCredits(session.user.id, "prose");
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Fix generation failed. Please try again." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Update `surgical-edit/route.ts`**

Replace `src/app/api/ai/surgical-edit/route.ts` in full:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { surgicalEditSystemPrompt } from "@/lib/ai/prompts";
import { isValidTipTapJson, tiptapToPlainText, plainTextToTipTap } from "@/lib/editor/content-migration";
import { extractVoiceFingerprint, fingerprintToConstraints } from "@/lib/ai/voice-fingerprint";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "prose");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_modes_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'surgical_edit' }, { status: 403 });
  }

  const { chapterContent, instruction, projectId } = await req.json();

  if (!chapterContent?.trim() || !instruction?.trim()) {
    return NextResponse.json({ error: "chapterContent and instruction are required" }, { status: 400 });
  }

  let plainText: string;
  if (isValidTipTapJson(chapterContent)) {
    plainText = tiptapToPlainText(JSON.parse(chapterContent));
  } else {
    plainText = chapterContent;
  }

  const cappedText = plainText.length > 8000 ? plainText.slice(0, 8000) + "\n\n[...chapter continues...]" : plainText;

  const fp = extractVoiceFingerprint([cappedText]);
  const voiceConstraints = fp ? fingerprintToConstraints(fp) : "";
  const promiseLedger = projectId ? await buildPromiseLedger(projectId, "preserve") : "";
  const extra = [voiceConstraints, promiseLedger].filter(Boolean).join("\n\n");
  const system = surgicalEditSystemPrompt() + (extra ? `\n\n${extra}` : "");

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: `Chapter:\n\n${cappedText}\n\nInstruction: ${instruction}` }],
    });

    const rawResult = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as any).text)
      .join("");

    let parsed: { found: string; replacement: string; explanation: string };
    try {
      parsed = JSON.parse(rawResult);
    } catch {
      return NextResponse.json({ error: "Edit generation failed. Please try again." }, { status: 500 });
    }

    const { found, replacement, explanation } = parsed;

    if (!found) {
      return NextResponse.json({ error: "Could not locate the described passage." }, { status: 422 });
    }

    if (!plainText.includes(found)) {
      return NextResponse.json({ error: "Could not locate the described passage." }, { status: 422 });
    }

    const updatedPlainText = plainText.replace(found, replacement);
    const updatedJson = plainTextToTipTap(updatedPlainText);

    return NextResponse.json({ original: found, replacement, explanation, updatedJson });
  } catch (e: any) {
    await refundCredits(session.user.id, "prose");
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Edit generation failed. Please try again." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```
npx vitest run src/app/api/ai/prose-fix/__tests__/route.test.ts src/app/api/ai/surgical-edit/__tests__/route.test.ts
```
Expected: all tests PASS.

- [ ] **Step 7: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/ai/prose-fix/route.ts src/app/api/ai/prose-fix/__tests__/route.test.ts \
        src/app/api/ai/surgical-edit/route.ts src/app/api/ai/surgical-edit/__tests__/route.test.ts
git commit -m "feat: wire voice fingerprint and preserve-mode ledger into prose-fix and surgical-edit"
```

---

### Task 4: Director `villain-pov` route

**Files:**
- Modify: `src/app/api/projects/[projectId]/villain-pov/route.ts`
- Create: `src/app/api/projects/[projectId]/villain-pov/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `buildPromiseLedger(projectId, "generate")` from Task 1; `buildVoiceExemplars(userId, sceneDescription)` from `@/lib/ai/exemplars` (existing export: `async (userId: string, queryText: string) => Promise<string>`); `villainPovSystemPrompt` from `@/lib/ai/prompts`.
- Produces: `villain-pov` route appends both context strings (when non-empty) to the system prompt.

- [ ] **Step 1: Create failing test**

Create `src/app/api/projects/[projectId]/villain-pov/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "pro"),
  canAccessFeature: vi.fn(() => true),
}));

const findFirstProject = vi.fn();
const findFirstCharacter = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
      characters: { findFirst: (...args: any[]) => findFirstCharacter(...args) },
    },
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_a: any, b: any) => b),
  and: vi.fn((...args: any[]) => args),
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args),
}));
const buildVoiceExemplars = vi.fn();
vi.mock("@/lib/ai/exemplars", () => ({
  buildVoiceExemplars: (...args: any[]) => buildVoiceExemplars(...args),
}));

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/projects/proj-1/villain-pov", {
    method: "POST", body: JSON.stringify(body),
  });
}
function makeParams(projectId = "proj-1") {
  return { params: Promise.resolve({ projectId }) };
}

describe("POST /api/projects/[projectId]/villain-pov", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", userId: "user-1", name: "Test" });
    findFirstCharacter.mockResolvedValue({
      id: "char-1", name: "Mordred", role: "antagonist",
      antagonistType: null, personality: "cold", desires: "power",
    });
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "villain scene" }] });
    buildPromiseLedger.mockResolvedValue("");
    buildVoiceExemplars.mockResolvedValue("");
  });

  it("fetches promiseLedger and voiceExemplars in parallel", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    buildVoiceExemplars.mockResolvedValue("VOICE EXEMPLARS");
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a tense confrontation" }), makeParams());
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "generate");
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", "a tense confrontation");
  });

  it("appends both context strings to the system prompt", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    buildVoiceExemplars.mockResolvedValue("VOICE EXEMPLARS");
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a tense confrontation" }), makeParams());
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("OPEN STORY PROMISES"),
      }),
    );
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("VOICE EXEMPLARS"),
      }),
    );
  });

  it("system prompt is unchanged when both helpers return empty (fail-open)", async () => {
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a tense confrontation" }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system.endsWith("\n\n")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run "src/app/api/projects/*/villain-pov/__tests__/route.test.ts"
```
Expected: tests FAIL.

- [ ] **Step 3: Update `villain-pov/route.ts`**

Replace `src/app/api/projects/[projectId]/villain-pov/route.ts` in full:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, characters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { villainPovSystemPrompt } from "@/lib/ai/prompts";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";
import { buildVoiceExemplars } from "@/lib/ai/exemplars";

const anthropic = new Anthropic();

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { characterId, sceneDescription } = await req.json();
  if (!characterId || !sceneDescription?.trim()) {
    return NextResponse.json({ error: "characterId and sceneDescription are required" }, { status: 400 });
  }

  const character = await db.query.characters.findFirst({
    where: and(eq(characters.id, characterId), eq(characters.projectId, projectId)),
  });
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const typeMap: Record<string, string> = {
    Narcissist:    "This character genuinely believes in their own special status. Every slight is an injustice. Every obstacle is an undeserved insult. The protagonist appears as someone who refuses to acknowledge what this character clearly deserves.",
    Machiavellian: "This character sees the board and everyone on it as pieces. The protagonist is an obstacle to a legitimate goal, perhaps useful in some contexts, but currently blocking progress. There is no malice here — only strategy.",
    Psychopath:    "This character feels no anticipatory anxiety about consequences that constrain other people. The protagonist's resistance appears baffling — why not simply take what you want? The character is not cruel; they are simply unrestrained in ways others cannot imagine.",
    Ideological:   "This character believes they are right and history will vindicate them. The protagonist represents either complicit cowardice or active obstruction of the necessary. The harm this character causes is regrettable but required.",
    Systemic:      "This is not a single character's POV but the POV of the institution — the logic of the organization, the rule, the precedent. The protagonist appears as an anomaly, a disruption, an exception the system was not designed to accommodate.",
  };

  const profileNote = character.antagonistType && typeMap[character.antagonistType as string]
    ? typeMap[character.antagonistType as string]
    : "This character believes they are acting correctly. The protagonist appears as an obstacle to something they genuinely want.";

  const [promiseLedger, voiceExemplars] = await Promise.all([
    buildPromiseLedger(projectId, "generate"),
    buildVoiceExemplars(session.user.id, sceneDescription),
  ]);
  const extra = [promiseLedger, voiceExemplars].filter(Boolean).join("\n\n");
  const system = villainPovSystemPrompt(character.name, character.role, profileNote, character.personality, character.desires)
    + (extra ? `\n\n${extra}` : "");

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: sceneDescription }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ text });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run "src/app/api/projects/*/villain-pov/__tests__/route.test.ts"
```
Expected: all tests PASS.

- [ ] **Step 5: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects/[projectId]/villain-pov/route.ts \
        "src/app/api/projects/[projectId]/villain-pov/__tests__/route.test.ts"
git commit -m "feat: wire promise ledger and voice exemplars into villain-pov route"
```

---

### Task 5: Director `generate-package` route

**Files:**
- Modify: `src/app/api/projects/[projectId]/production/generate-package/route.ts`
- Create: `src/app/api/projects/[projectId]/production/generate-package/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `buildPromiseLedger(projectId, "generate")` from Task 1.
- Produces: `generate-package` route appends the promise ledger (when non-empty) to the `userPrompt` string.

- [ ] **Step 1: Create failing test**

Create `src/app/api/projects/[projectId]/production/generate-package/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));

const findFirstProject = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "row-1" }]) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => {}) })),
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_a: any, b: any) => b),
  and: vi.fn((...args: any[]) => args),
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args),
}));

const { POST } = await import("../route");

function makeReq() {
  return new Request("http://localhost/api/projects/proj-1/production/generate-package", { method: "POST" });
}
function makeParams(projectId = "proj-1") {
  return { params: Promise.resolve({ projectId }) };
}

const MOCK_PACKAGE = JSON.stringify({
  projectBrief: { title: "T", logline: "l", format: "Novel", genres: [], tone: "t", styleNotes: "" },
  characterSheets: [],
  locationSheets: [],
  scenes: [],
  shots: [{ sceneNumber: 1, chapterId: "", chapterTitle: "Ch1", shotNumber: 1, shotType: "Medium", cameraMovement: "Static", lightingMood: "Day", timeOfDay: "Noon", subject: "hero", action: "walks", location: "park", mood: "calm", primaryCharacterName: "", soulPrompt: "", videoPrompt: "", dialogue: "", speaker: "" }],
});

describe("POST /api/projects/[projectId]/production/generate-package", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({
      id: "proj-1", userId: "user-1", name: "Test", format: "Novel", genres: [],
      characters: [], locations: [], plotThreads: [], worldEntities: [],
      chapters: [{ id: "ch-1", title: "Ch1", content: "content", sortOrder: 0 }],
      referenceWorks: [], storyMemories: [],
    });
    createMessage.mockResolvedValue({
      content: [{ type: "text", text: MOCK_PACKAGE }],
    });
    buildPromiseLedger.mockResolvedValue("");
  });

  it("calls buildPromiseLedger with generate mode", async () => {
    await POST(makeReq(), makeParams());
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "generate");
  });

  it("appends promise ledger to the user prompt when non-empty", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    await POST(makeReq(), makeParams());
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("OPEN STORY PROMISES"),
          }),
        ]),
      }),
    );
  });

  it("user prompt is unchanged when promise ledger returns empty (fail-open)", async () => {
    await POST(makeReq(), makeParams());
    const call = createMessage.mock.calls[0][0];
    const userContent = call.messages[0].content as string;
    expect(userContent).not.toContain("OPEN STORY PROMISES");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run "src/app/api/projects/*/production/generate-package/__tests__/route.test.ts"
```
Expected: tests FAIL.

- [ ] **Step 3: Update `generate-package/route.ts`**

Three surgical edits — everything else in the file is left unchanged:

**1.** Add one import after the existing `@/lib/ai/prompts` import line:
```ts
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";
```

**2.** Immediately after `const { projectId } = await params;` (line 27), add:
```ts
const promiseLedger = await buildPromiseLedger(projectId, "generate");
```

**3.** In the `userPrompt` template literal, replace the exact text:
```ts
${chaptersText || "(no chapters written yet)"}

Generate a production package as JSON:
```
with:
```ts
${chaptersText || "(no chapters written yet)"}${promiseLedger ? `\n\n${promiseLedger}` : ""}

Generate a production package as JSON:
```

The JSON schema object (`"projectBrief"`, `"characterSheets"`, `"locationSheets"`, `"scenes"`, `"shots"` keys) and the closing backtick of `userPrompt` are left entirely unchanged.

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run "src/app/api/projects/*/production/generate-package/__tests__/route.test.ts"
```
Expected: all tests PASS.

- [ ] **Step 5: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/projects/[projectId]/production/generate-package/route.ts" \
        "src/app/api/projects/[projectId]/production/generate-package/__tests__/route.test.ts"
git commit -m "feat: wire promise ledger into generate-package production route"
```

---

### Task 6: Frontend — add `projectId` to 3 fetch bodies

**Files:**
- Modify: `src/components/WritingRoom.tsx` (surgical-edit fetch body, line ~197)
- Modify: `src/components/EditorNotesPanel.tsx` (prose-fix fetch body, line ~88)
- Modify: `src/components/panels/StoryHealthPanel.tsx` (prose-fix fetch body, line ~248)
- Test: `src/components/__tests__/rag-projectid-payloads.test.ts` (new — source-text assertions)

**Interfaces:**
- Consumes: `project.id` (already in scope in WritingRoom, EditorNotesPanel); `projectId` prop (already a prop of StoryHealthPanel at `src/components/panels/StoryHealthPanel.tsx:32`).
- Produces: all three fetch bodies include `projectId` so the backend routes receive it.

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/rag-projectid-payloads.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("RAG projectId in fetch payloads", () => {
  it("WritingRoom surgical-edit fetch includes projectId", () => {
    const src = readFileSync(join(__dirname, "..", "WritingRoom.tsx"), "utf-8");
    // Find the surgical-edit fetch block and confirm projectId is in its body
    const fetchBlock = src.slice(src.indexOf("/api/ai/surgical-edit"));
    const bodyEnd = fetchBlock.indexOf("});");
    expect(fetchBlock.slice(0, bodyEnd)).toContain("projectId");
  });

  it("EditorNotesPanel prose-fix fetch includes projectId", () => {
    const src = readFileSync(join(__dirname, "..", "EditorNotesPanel.tsx"), "utf-8");
    const fetchBlock = src.slice(src.indexOf("/api/ai/prose-fix"));
    const bodyEnd = fetchBlock.indexOf("});");
    expect(fetchBlock.slice(0, bodyEnd)).toContain("projectId");
  });

  it("StoryHealthPanel prose-fix fetch includes projectId", () => {
    const src = readFileSync(join(__dirname, "..", "panels", "StoryHealthPanel.tsx"), "utf-8");
    const fetchBlock = src.slice(src.indexOf("/api/ai/prose-fix"));
    const bodyEnd = fetchBlock.indexOf("});");
    expect(fetchBlock.slice(0, bodyEnd)).toContain("projectId");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/components/__tests__/rag-projectid-payloads.test.ts
```
Expected: all 3 tests FAIL.

- [ ] **Step 3: Update WritingRoom.tsx**

Find the surgical-edit fetch in `src/components/WritingRoom.tsx` (the `body: JSON.stringify({...})` call around line 197). Replace:

```ts
body: JSON.stringify({
  chapterContent: activeChap.content,
  instruction: surgicalInstruction,
}),
```

with:

```ts
body: JSON.stringify({
  chapterContent: activeChap.content,
  instruction: surgicalInstruction,
  projectId: project.id,
}),
```

- [ ] **Step 4: Update EditorNotesPanel.tsx**

Find the prose-fix fetch in `src/components/EditorNotesPanel.tsx` (around line 88). Replace:

```ts
body: JSON.stringify({ text, fixInstruction: n.suggestedFix ? `${n.message} — ${n.suggestedFix}` : n.message }),
```

with:

```ts
body: JSON.stringify({ text, fixInstruction: n.suggestedFix ? `${n.message} — ${n.suggestedFix}` : n.message, projectId: project.id }),
```

Note: `project.id` is in scope via the `project` prop already passed to `EditorNotesPanel`. Confirm the prop exists by checking the component's prop destructuring — it receives `project` alongside `chapters`.

- [ ] **Step 5: Update StoryHealthPanel.tsx**

Find the prose-fix fetch in `src/components/panels/StoryHealthPanel.tsx` (around line 248). Replace:

```ts
body: JSON.stringify({ text: activeChapContent, fixInstruction }),
```

with:

```ts
body: JSON.stringify({ text: activeChapContent, fixInstruction, projectId }),
```

`projectId` is already a prop of `StoryHealthPanel` (confirmed at `StoryHealthPanel.tsx:32`: `projectId: string`).

- [ ] **Step 6: Run tests to verify they pass**

```
npx vitest run src/components/__tests__/rag-projectid-payloads.test.ts
```
Expected: all 3 tests PASS.

- [ ] **Step 7: Run full suite and typecheck**

```
npm test
npx tsc --noEmit
```
Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/WritingRoom.tsx src/components/EditorNotesPanel.tsx \
        src/components/panels/StoryHealthPanel.tsx \
        src/components/__tests__/rag-projectid-payloads.test.ts
git commit -m "feat: pass projectId in surgical-edit and prose-fix fetch bodies for RAG context"
```
