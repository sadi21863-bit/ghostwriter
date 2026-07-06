import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstShowcases = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      showcases: { findFirst: (...args: any[]) => findFirstShowcases(...args) },
    },
  },
}));

import { GET } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/showcase/some-slug");
}

describe("GET /api/showcase/[slug] (public)", () => {
  beforeEach(() => {
    findFirstShowcases.mockReset();
  });

  it("404s when the slug doesn't exist", async () => {
    findFirstShowcases.mockResolvedValue(undefined);

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: "missing" }) });

    expect(res.status).toBe(404);
  });

  it("404s when the showcase is private, even with a correct slug", async () => {
    findFirstShowcases.mockResolvedValue({
      slug: "private-slug", visibility: "private", title: "t", blurb: "b",
      project: { format: "Novel", genres: [], chapters: [], characters: [], comicPages: [], productionShots: [] },
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: "private-slug" }) });

    expect(res.status).toBe(404);
  });

  it("returns a safe DTO for an unlisted showcase (no raw project internals)", async () => {
    findFirstShowcases.mockResolvedValue({
      slug: "unlisted-slug", visibility: "unlisted", title: "My Story", blurb: "A tale",
      project: { format: "Novel", genres: ["Fantasy"], chapters: [], characters: [], comicPages: [], productionShots: [] },
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: "unlisted-slug" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("My Story");
    expect(body.format).toBe("Novel");
    expect(body.project).toBeUndefined();
    expect(body.userId).toBeUndefined();
  });

  it("returns a safe DTO for a public showcase", async () => {
    findFirstShowcases.mockResolvedValue({
      slug: "public-slug", visibility: "public", title: "Public Tale", blurb: "b",
      project: { format: "Screenplay", genres: [], chapters: [], characters: [], comicPages: [], productionShots: [] },
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: "public-slug" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Public Tale");
  });
});
