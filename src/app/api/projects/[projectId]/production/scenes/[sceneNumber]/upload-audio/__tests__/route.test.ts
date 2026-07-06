import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const putMock = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...args: any[]) => putMock(...args),
}));

const findFirstProjects = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return { where: (...args: any[]) => { updateWhere(...args); return Promise.resolve(); } };
      },
    }),
  },
}));

import { POST } from "../route";

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", sceneNumber: "1" }) };
}

function makeRequestWithFile(file: File | null) {
  const formData = new FormData();
  if (file) formData.set("audio", file);
  return new Request("http://localhost/api/projects/proj-1/production/scenes/1/upload-audio", {
    method: "POST",
    body: formData,
  });
}

describe("POST .../scenes/[sceneNumber]/upload-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    putMock.mockResolvedValue({ url: "https://blob.example.com/audio-123.mp3" });
  });

  it("uploads the file and stores its URL on every shot in the scene", async () => {
    const file = new File(["fake-audio-bytes"], "track.mp3", { type: "audio/mpeg" });

    const res = await POST(makeRequestWithFile(file), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://blob.example.com/audio-123.mp3");
    expect(putMock).toHaveBeenCalledWith(
      expect.stringContaining("scene-1/audio-"),
      expect.any(Buffer),
      { access: "public", contentType: "audio/mpeg" },
    );
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ sceneAudioTrackUrl: "https://blob.example.com/audio-123.mp3" }));
  });

  it("returns 400 when no audio file is provided", async () => {
    const res = await POST(makeRequestWithFile(null), makeParams());
    expect(res.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the project isn't owned by the user", async () => {
    findFirstProjects.mockResolvedValue(undefined);
    const file = new File(["fake-audio-bytes"], "track.mp3", { type: "audio/mpeg" });
    const res = await POST(makeRequestWithFile(file), makeParams());
    expect(res.status).toBe(404);
  });
});
