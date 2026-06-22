// Regression test for the credential-fix work order (2026-06-21): portrait
// generation calls generateSoulImage(), which routes through Segmind
// (api.segmind.com), not Higgsfield's native API. The route used to decrypt
// user.higgsfieldApiKey (the wrong credential — auth would fail against
// Segmind) with a `|| process.env.HIGGSFIELD_API_KEY` fallback that would
// silently generate on the developer's own key/dime. Both are fixed: the
// route now reads user.segmindApiKey, with no env fallback at all.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({
  decrypt: (...args: any[]) => decrypt(...args),
}));

const generateSoulImage = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateSoulImage: (...args: any[]) => generateSoulImage(...args),
}));

const findFirstProjects = vi.fn();
const findFirstUsers = vi.fn();
const findFirstCharacters = vi.fn();
const updateCharacters = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      users: { findFirst: (...args: any[]) => findFirstUsers(...args) },
      characters: { findFirst: (...args: any[]) => findFirstCharacters(...args) },
    },
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => updateCharacters(),
        }),
      }),
    }),
  },
}));

import { POST } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/projects/proj-1/characters/char-1/portrait", { method: "POST" });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", characterId: "char-1" }) };
}

describe("POST /api/projects/[projectId]/characters/[characterId]/portrait", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstCharacters.mockResolvedValue({ id: "char-1", projectId: "proj-1", name: "Mira", appearance: "lean, watchful" });
    updateCharacters.mockResolvedValue([{ portraitUrl: "https://example.com/portrait.png" }]);
    generateSoulImage.mockResolvedValue("https://example.com/portrait.png");
    delete process.env.HIGGSFIELD_API_KEY;
  });

  it("uses segmindApiKey, not higgsfieldApiKey, as the credential", async () => {
    findFirstUsers.mockResolvedValue({ segmindApiKey: "encrypted-segmind-key", higgsfieldApiKey: "encrypted-higgsfield-key" });
    decrypt.mockImplementation((v: string) => (v === "encrypted-segmind-key" ? "SG_real_key" : ""));

    await POST(makeRequest(), makeParams());

    expect(generateSoulImage).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "SG_real_key" }));
  });

  it("never falls back to process.env.HIGGSFIELD_API_KEY when the user has no Segmind key", async () => {
    process.env.HIGGSFIELD_API_KEY = "dev-key-should-never-be-used";
    findFirstUsers.mockResolvedValue({ segmindApiKey: "", higgsfieldApiKey: "encrypted-higgsfield-key" });
    decrypt.mockReturnValue("");

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Segmind");
    expect(generateSoulImage).not.toHaveBeenCalled();
  });

  it("returns a clear, non-silent error when no Segmind key is configured", async () => {
    findFirstUsers.mockResolvedValue({ segmindApiKey: "" });
    decrypt.mockReturnValue("");

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Add your Segmind API key in Settings to generate portraits.");
  });
});
