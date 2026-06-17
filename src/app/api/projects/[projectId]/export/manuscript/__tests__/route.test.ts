import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstProjects = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(async () => {}),
}));

import { POST, isCharacterCue, SCENE_HEADING_RE, PARENTHETICAL_RE } from "../route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/projects/project-1/export/manuscript", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("isCharacterCue / SCENE_HEADING_RE / PARENTHETICAL_RE", () => {
  it("recognizes scene headings", () => {
    expect(SCENE_HEADING_RE.test("INT. APARTMENT - NIGHT")).toBe(true);
    expect(SCENE_HEADING_RE.test("EXT. STREET - DAY")).toBe(true);
    expect(SCENE_HEADING_RE.test("She walked into the room.")).toBe(false);
  });

  it("recognizes short ALL CAPS character cues", () => {
    expect(isCharacterCue("MARIA")).toBe(true);
    expect(isCharacterCue("MARIA (V.O.)")).toBe(true);
    expect(isCharacterCue("INT. APARTMENT - NIGHT")).toBe(false); // scene heading, not a cue
    expect(isCharacterCue("She walked into the room and sat down by the window quietly.")).toBe(false); // too long / not caps
  });

  it("recognizes parentheticals", () => {
    expect(PARENTHETICAL_RE.test("(whispering)")).toBe(true);
    expect(PARENTHETICAL_RE.test("She whispered.")).toBe(false);
  });
});

describe("POST /api/projects/[projectId]/export/manuscript", () => {
  beforeEach(() => {
    findFirstProjects.mockReset();
  });

  it("returns 404 when the project doesn't exist or isn't owned by the user", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ formats: ["docx"] }), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(res.status).toBe(404);
  });

  it("exports a docx for a Screenplay-format project without throwing", async () => {
    findFirstProjects.mockResolvedValue({
      id: "project-1",
      name: "My Script",
      format: "Screenplay",
      chapters: [
        { title: "Scene 1", sortOrder: 0, content: "INT. APARTMENT - NIGHT\n\nMARIA\n\n(whispering)\n\nIs anyone there?" },
      ],
    });

    const res = await POST(makeRequest({ formats: ["docx"] }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  });

  it("exports a docx for a Novel-format project without throwing", async () => {
    findFirstProjects.mockResolvedValue({
      id: "project-1",
      name: "My Novel",
      format: "Novel",
      chapters: [
        { title: "Chapter 1", sortOrder: 0, content: "It was a dark and stormy night." },
      ],
    });

    const res = await POST(makeRequest({ formats: ["docx"] }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  });
});
