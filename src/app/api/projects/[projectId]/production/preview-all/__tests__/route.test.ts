import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "segmind-key"),
}));
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.example/preview.jpg" })),
}));

const findFirstProject = vi.fn();
const findFirstUser = vi.fn();
const findManyShots = vi.fn();
const updateSet = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
      users: { findFirst: (...args: any[]) => findFirstUser(...args) },
      productionShots: { findMany: (...args: any[]) => findManyShots(...args) },
    },
    update: vi.fn(() => ({ set: (...args: any[]) => updateSet(...args) })),
  },
}));
vi.mock("drizzle-orm", async (importOriginal: any) => {
  const actual = await importOriginal();
  return { ...actual, eq: vi.fn((_a: any, b: any) => b), and: vi.fn((...args: any[]) => args) };
});

const generateSoulImage = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateSoulImage: (...args: any[]) => generateSoulImage(...args),
}));

// If BLOB_READ_WRITE_TOKEN is set in the local env, the route re-fetches the
// generated image to re-upload it to Blob storage — stub that out so tests
// never make a real network call.
vi.stubGlobal("fetch", vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })));

function makeShots(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `shot-${i}`,
    soulPrompt: "a shot",
    subject: "hero",
    action: "walks",
    location: "park",
    previewImageUrl: null,
    primaryCharacter: null,
  }));
}

function makeReq() {
  return new Request("http://localhost/api/projects/proj-1/production/preview-all", { method: "POST" });
}
function makeParams(projectId = "proj-1") {
  return { params: Promise.resolve({ projectId }) };
}

describe("POST /api/projects/[projectId]/production/preview-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUser.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted" });
    updateSet.mockReturnValue({ where: vi.fn(async () => {}) });
    generateSoulImage.mockResolvedValue("https://segmind.example/generated.jpg");
  });

  it("clamps the batch to what the $5 budget cap affords, not just the item-count ceiling", async () => {
    // 25 pending shots at $0.29/item = $7.25, which the 20-item CEILING alone
    // would let through at $5.80 — enforceBudgetCap must clamp tighter, to
    // floor(5 / 0.29) = 17 items ($4.93), before any spend happens.
    findManyShots.mockResolvedValue(makeShots(25));
    const { POST } = await import("../route");

    const res = await POST(makeReq(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(17);
    expect(body.remaining).toBe(8);
    expect(generateSoulImage).toHaveBeenCalledTimes(17);
  });

  it("rejects the whole batch with no spend when even one item would exceed the cap", async () => {
    vi.doMock("@/lib/capabilities/cost", () => ({
      CAPABILITY_UNIT_USD: { comic_generate: 10 }, // exceeds MAX_BATCH_SPEND_USD on its own
      MAX_BATCH_SPEND_USD: 5,
      enforceBudgetCap: (estimateUsd: number, capUsd?: number) => {
        if (capUsd !== undefined && estimateUsd > capUsd) {
          return { allowed: false, estimateUsd, capUsd, reason: `Estimated $${estimateUsd.toFixed(2)} exceeds your $${capUsd.toFixed(2)} run cap.` };
        }
        return { allowed: true, estimateUsd, capUsd };
      },
    }));
    findManyShots.mockResolvedValue(makeShots(3));
    vi.resetModules();
    const { POST } = await import("../route");

    const res = await POST(makeReq(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/exceeds your \$5\.00 run cap/);
    expect(generateSoulImage).not.toHaveBeenCalled();
  });
});
