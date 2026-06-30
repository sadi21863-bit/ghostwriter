import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
  verifyChildOwnership: vi.fn(),
}));

const findFirstProjects = vi.fn();
const findFirstPanels = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const returning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      comicPanels: { findFirst: (...args: any[]) => findFirstPanels(...args) },
    },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return {
          where: (...args: any[]) => {
            updateWhere(...args);
            return { returning: (...rArgs: any[]) => returning(...rArgs) };
          },
        };
      },
    }),
  },
}));

const compositeLettering = vi.fn();
vi.mock("@/lib/comic-lettering/composite-panel", () => ({
  compositeLettering: (...args: any[]) => compositeLettering(...args),
}));

const putBlob = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...args: any[]) => putBlob(...args),
}));

import { verifyChildOwnership } from "@/lib/auth-helpers";
import { POST } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/projects/proj-1/comics/page-1/panels/panel-1/letter", { method: "POST" });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", pageId: "page-1", panelId: "panel-1" }) };
}

const realFetch = global.fetch;

describe("POST .../panels/[panelId]/letter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    (verifyChildOwnership as any).mockResolvedValue(true);
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    global.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as any;
    compositeLettering.mockResolvedValue(Buffer.from("lettered-png-bytes"));
    putBlob.mockResolvedValue({ url: "https://blob.example.com/lettered.png" });
    returning.mockResolvedValue([{ id: "panel-1", letteredImageUrl: "https://blob.example.com/lettered.png" }]);
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("composites lettering, uploads it, and persists letteredImageUrl", async () => {
    findFirstPanels.mockResolvedValue({
      id: "panel-1", projectId: "proj-1", panelIndex: 0, imageUrl: "https://blob.example.com/raw.png",
      dialogue: "We meet again.", caption: "", speakerName: "Kessler", bubbleType: "speech",
    });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(compositeLettering).toHaveBeenCalledWith(expect.objectContaining({
      dialogue: "We meet again.", speakerName: "Kessler", bubbleType: "speech",
    }));
    expect(putBlob).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith({ letteredImageUrl: "https://blob.example.com/lettered.png" });
    expect(body.panel.letteredImageUrl).toBe("https://blob.example.com/lettered.png");
  });

  it("returns 400 when the panel has neither dialogue nor caption", async () => {
    findFirstPanels.mockResolvedValue({
      id: "panel-1", projectId: "proj-1", panelIndex: 0, imageUrl: "https://blob.example.com/raw.png",
      dialogue: "", caption: "", speakerName: "", bubbleType: "speech",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(400);
    expect(compositeLettering).not.toHaveBeenCalled();
  });

  it("returns 404 when the panel does not exist", async () => {
    findFirstPanels.mockResolvedValue(undefined);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(404);
  });

  it("returns 500 when Blob storage is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    findFirstPanels.mockResolvedValue({
      id: "panel-1", projectId: "proj-1", panelIndex: 0, imageUrl: "https://blob.example.com/raw.png",
      dialogue: "We meet again.", caption: "", speakerName: "", bubbleType: "speech",
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    expect(compositeLettering).not.toHaveBeenCalled();
  });
});
