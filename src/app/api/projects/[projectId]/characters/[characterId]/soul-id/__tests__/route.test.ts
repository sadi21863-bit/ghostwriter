import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "pro"),
  canAccessFeature: vi.fn(() => true),
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((v: string) => v || ""),
}));

const findFirstProject = vi.fn();
const findFirstCharacter = vi.fn();
const updateSet = vi.fn((..._args: any[]) => ({ where: vi.fn(async () => {}) }));
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
      characters: { findFirst: (...args: any[]) => findFirstCharacter(...args) },
      users: { findFirst: vi.fn(async () => ({ id: "user-1", higgsfieldApiKey: "hf-key", higgsfieldApiSecret: "hf-secret" })) },
    },
    update: vi.fn(() => ({ set: (...args: any[]) => updateSet(...args) })),
  },
}));
vi.mock("drizzle-orm", async (importOriginal: any) => {
  const actual = await importOriginal();
  return { ...actual, eq: vi.fn((_a: any, b: any) => b), and: vi.fn((...args: any[]) => args) };
});

const pollSoulIdTraining = vi.fn();
const trainSoulId = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  trainSoulId: (...args: any[]) => trainSoulId(...args),
  pollSoulIdTraining: (...args: any[]) => pollSoulIdTraining(...args),
}));

const { GET } = await import("../route");

function makeReq(url: string) {
  return new Request(url);
}
function makeParams(projectId = "proj-1", characterId = "char-1") {
  return { params: Promise.resolve({ projectId, characterId }) };
}

describe("GET /api/projects/[projectId]/characters/[characterId]/soul-id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstCharacter.mockResolvedValue({ id: "char-1", soulIdTrainingJobId: "" });
  });

  it("polls using an explicit jobId query param when given (pre-existing manual-trigger path)", async () => {
    pollSoulIdTraining.mockResolvedValue({ status: "queued" });
    const res = await GET(makeReq("http://localhost/x?jobId=explicit-job"), makeParams());
    expect(res.status).toBe(200);
    expect(pollSoulIdTraining).toHaveBeenCalledWith(expect.objectContaining({ jobId: "explicit-job" }));
  });

  it("falls back to the character's stored soulIdTrainingJobId when no jobId query param is given (item 68's auto-bootstrap path)", async () => {
    findFirstCharacter.mockResolvedValue({ id: "char-1", soulIdTrainingJobId: "stored-job-id" });
    pollSoulIdTraining.mockResolvedValue({ status: "queued" });

    const res = await GET(makeReq("http://localhost/x"), makeParams());
    expect(res.status).toBe(200);
    expect(pollSoulIdTraining).toHaveBeenCalledWith(expect.objectContaining({ jobId: "stored-job-id" }));
  });

  it("returns 400 when neither an explicit jobId nor a stored one exists", async () => {
    findFirstCharacter.mockResolvedValue({ id: "char-1", soulIdTrainingJobId: "" });
    const res = await GET(makeReq("http://localhost/x"), makeParams());
    expect(res.status).toBe(400);
    expect(pollSoulIdTraining).not.toHaveBeenCalled();
  });

  it("on completion, sets soulId AND clears soulIdTrainingJobId", async () => {
    findFirstCharacter.mockResolvedValue({ id: "char-1", soulIdTrainingJobId: "job-1" });
    pollSoulIdTraining.mockResolvedValue({ status: "completed", soulId: "soul-abc" });

    const res = await GET(makeReq("http://localhost/x"), makeParams());
    const json = await res.json();
    expect(json.status).toBe("completed");
    expect(updateSet).toHaveBeenCalledWith({ soulId: "soul-abc", soulIdTrainingJobId: "" });
  });

  it("on failure, clears the stored soulIdTrainingJobId so a stale dead job isn't polled forever", async () => {
    findFirstCharacter.mockResolvedValue({ id: "char-1", soulIdTrainingJobId: "job-1" });
    pollSoulIdTraining.mockResolvedValue({ status: "failed" });

    await GET(makeReq("http://localhost/x"), makeParams());
    expect(updateSet).toHaveBeenCalledWith({ soulIdTrainingJobId: "" });
  });

  it("does not touch soulIdTrainingJobId while still queued/processing", async () => {
    findFirstCharacter.mockResolvedValue({ id: "char-1", soulIdTrainingJobId: "job-1" });
    pollSoulIdTraining.mockResolvedValue({ status: "queued" });

    await GET(makeReq("http://localhost/x"), makeParams());
    expect(updateSet).not.toHaveBeenCalled();
  });
});
