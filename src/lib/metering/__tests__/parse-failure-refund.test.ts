import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 0 / v4 §7.3 — parse-failure refunds on seam-metered routes.
 *
 * `runMeteredCall` (src/lib/roles/shared.ts) refunds when the model call THROWS.
 * It cannot know about a parse failure, because the parsing happens back in the
 * route. Five routes charged the user, hit `JSON.parse` on well-formed-looking
 * but unparseable output, and returned 5xx/422 without refunding — the user was
 * billed for output they never received.
 *
 * These are behavioural tests against the real routes.
 */

const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  refundCredits: (...args: any[]) => refundCredits(...args),
  meterAndGate: vi.fn(async () => null),
}));

// The implementation must accept the arguments, otherwise spreading `...args`
// into a zero-arg signature is a tsc error (CLAUDE.md item 69 gotcha).
const checkAiRateLimit = vi.fn(async (..._args: any[]) => null);
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: (...args: any[]) => checkAiRateLimit(...args),
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "story_pro"),
  canAccessFeature: vi.fn(() => true),
}));

const findFirstProject = vi.fn();
const findManyChapters = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
      chapters: { findMany: (...args: any[]) => findManyChapters(...args) },
    },
  },
}));

// The seam itself succeeds — we are isolating what happens AFTER a successful
// charge, when the route's own parse fails.
const runMet = vi.fn();
vi.mock("@/lib/roles/shared", () => ({
  runMeteredCall: (...args: any[]) => runMet(...args),
  MeteredCallParams: {},
  MeteredCallResult: {},
}));
vi.mock("@/lib/roles/director", async (orig) => ({
  ...(await orig<any>()),
  runDirectorCall: (...args: any[]) => runMet(...args),
}));
vi.mock("@/lib/roles/editor", async (orig) => ({
  ...(await orig<any>()),
  runEditorCall: (...args: any[]) => runMet(...args),
}));

const tensionCurve = await import("@/app/api/projects/[projectId]/tension-curve/route");
const transportation = await import("@/app/api/projects/[projectId]/transportation-check/route");

const params = { params: Promise.resolve({ projectId: "proj-1" }) };
const post = (body: unknown = {}) =>
  new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const LONG_CHAPTER = "A".repeat(400);
// tension-curve needs >= 2 chapters of >100 chars; transportation-check needs
// chapterContent in the body.
const TWO_CHAPTERS = [
  { id: "c1", title: "One", content: LONG_CHAPTER, sortOrder: 0 },
  { id: "c2", title: "Two", content: LONG_CHAPTER, sortOrder: 1 },
];

describe("parse-failure refunds on seam-metered routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", format: "Novel", userId: "user-1" });
    findManyChapters.mockResolvedValue(TWO_CHAPTERS);
  });

  it("refunds tension-curve when the model output will not parse", async () => {
    runMet.mockResolvedValue({ ok: true, text: "this is definitely not json" });

    const res = await tensionCurve.POST(post(), params);

    expect(res.status).toBe(500);
    expect(refundCredits).toHaveBeenCalledWith("user-1", "tension-curve");
  });

  it("refunds transportation-check when the model output will not parse", async () => {
    runMet.mockResolvedValue({ ok: true, text: "this is definitely not json" });

    const res = await transportation.POST(post({ chapterContent: "some chapter text that is definitely long enough" }), params);

    expect(res.status).toBe(500);
    expect(refundCredits).toHaveBeenCalledWith("user-1", "transportation-check");
  });

  it.each([
    ["tension-curve", tensionCurve],
    ["transportation-check", transportation],
  ])("does NOT refund %s when the output parses cleanly", async (_op, mod) => {
    runMet.mockResolvedValue({ ok: true, text: '{"scores":[]}' });

    const res = await mod.POST(post({ chapterContent: "some chapter text that is definitely long enough" }), params);

    expect(res.status).toBe(200);
    expect(refundCredits).not.toHaveBeenCalled();
  });
});
