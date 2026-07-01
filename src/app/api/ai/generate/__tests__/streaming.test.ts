// Tests the `stream: true` branch of /api/ai/generate: it should return a
// ReadableStream of text deltas (not JSON), persist the generation record on
// completion, and refund credits + emit a visible error chunk if generateStream
// throws mid-stream — all without disturbing the existing non-streaming path
// (covered separately by quality-stack.test.ts).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "story_pro"),
  canAccessFeature: vi.fn(() => true),
}));
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: vi.fn(async () => null),
  refundCredits: vi.fn(async () => {}),
}));
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(async () => {}),
}));
vi.mock("@/lib/ai/aiisms", () => ({
  buildAiismsInstruction: vi.fn(() => ""),
}));
vi.mock("@/lib/growthbook-server", () => ({
  isFeatureOnServer: vi.fn(async () => false),
}));
vi.mock("@/lib/ai/scene-blueprint", () => ({ buildSceneBlueprint: vi.fn(async () => "") }));
vi.mock("@/lib/ai/promise-ledger", () => ({ buildPromiseLedger: vi.fn(async () => "") }));
vi.mock("@/lib/ai/exemplars", () => ({ buildVoiceExemplars: vi.fn(async () => "") }));

const generateStream = vi.fn();
vi.mock("@/lib/ai/engine", () => ({
  generate: vi.fn(),
  generateStream: (...args: any[]) => generateStream(...args),
  MODELS: { default: "default-model", fast: "fast-model" },
}));

const findFirstProjects = vi.fn();
const findManySeriesBibles = vi.fn();
const insertGenerations = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      seriesBibles: { findMany: (...args: any[]) => findManySeriesBibles(...args) },
    },
    insert: () => ({ values: (...args: any[]) => insertGenerations(...args) }),
  },
}));

import { refundCredits } from "@/lib/metering/meter";
import { track } from "@/lib/analytics";
import { POST } from "../route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
}

async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe("POST /api/ai/generate — stream: true", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1", intentionalViolations: {} });
    findManySeriesBibles.mockResolvedValue([]);
  });

  it("returns a streamed text/plain response, not JSON", async () => {
    generateStream.mockImplementation(async (_params: any, onDelta: (d: string) => void) => {
      onDelta("Once upon ");
      onDelta("a time.");
      return { text: "Once upon a time.", tokensUsed: 12, model: "claude-sonnet-5" };
    });

    const res = await POST(makeRequest({ mode: "write", prompt: "Write the opening.", projectId: "proj-1", format: "Novel", stream: true }));

    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await readAll(res)).toBe("Once upon a time.");
  });

  it("persists the generation and tracks streamed: true on completion", async () => {
    generateStream.mockImplementation(async (_params: any, onDelta: (d: string) => void) => {
      onDelta("text");
      return { text: "text", tokensUsed: 5, model: "claude-sonnet-5" };
    });

    const res = await POST(makeRequest({ mode: "write", prompt: "p", projectId: "proj-1", chapterId: "chap-1", format: "Novel", stream: true }));
    await readAll(res);

    expect(insertGenerations).toHaveBeenCalledWith(expect.objectContaining({ projectId: "proj-1", chapterId: "chap-1", mode: "write", output: "text" }));
    expect(track).toHaveBeenCalledWith("user-1", "ai_generation", expect.objectContaining({ streamed: true }));
  });

  it("refunds credits and emits a visible error chunk if generateStream throws", async () => {
    generateStream.mockRejectedValue(new Error("model exploded"));

    const res = await POST(makeRequest({ mode: "write", prompt: "p", projectId: "proj-1", format: "Novel", stream: true }));
    const text = await readAll(res);

    expect(text).toContain("[Generation interrupted. Please try again.]");
    expect(refundCredits).toHaveBeenCalledWith("user-1", "generate");
    expect(insertGenerations).not.toHaveBeenCalled();
  });

  it("non-streaming requests are unaffected (stream omitted entirely)", async () => {
    const { generate } = await import("@/lib/ai/engine");
    vi.mocked(generate).mockResolvedValue({ text: "plain result", tokensUsed: 3, model: "claude-sonnet-5" } as any);

    const res = await POST(makeRequest({ mode: "write", prompt: "p", projectId: "proj-1", format: "Novel" }));

    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    expect(body.text).toBe("plain result");
    expect(generateStream).not.toHaveBeenCalled();
  });
});
