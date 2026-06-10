import { describe, it, expect } from "vitest";
import { buildContext, buildStaticContext, type ContextProject, type StoryMemory } from "@/lib/ai/context-builder";
import type { Character, Chapter } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseProject(overrides: Partial<ContextProject> = {}): ContextProject {
  return {
    id: "p1",
    name: "Test Novel",
    format: "Novel",
    skillLevel: "expert",
    genres: ["Thriller", "Mystery"],
    notes: "",
    characters: [],
    locations: [],
    plotThreads: [],
    chapters: [],
    referenceWorks: [],
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character>): Character {
  return {
    id: "c1",
    projectId: "p1",
    name: "Alice",
    role: "Protagonist",
    age: "30",
    appearance: "",
    personality: "",
    thinkingStyle: "",
    behavior: "",
    habits: "",
    fears: "",
    desires: "",
    speechPattern: "",
    backstory: "",
    arc: "",
    portraitUrl: "",
    sortOrder: 0,
    alwaysInContext: true,
    linkedLocationIds: [],
    linkedPlotThreadIds: [],
    ...overrides,
  };
}

function makeMemory(
  category: string,
  fact: string,
  chapterIndex = 0
): StoryMemory {
  return { id: Math.random().toString(36).slice(2), category, fact, chapterIndex };
}

function makeChapter(id: string, sortOrder: number): Chapter {
  return {
    id,
    projectId: "p1",
    title: `Chapter ${sortOrder}`,
    content: "",
    summary: "",
    tags: [],
    chapterType: "scene",
    sortOrder,
    wordCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildContext", () => {
  it("includes the project name and format in the header", () => {
    const ctx = buildContext(baseProject());
    expect(ctx).toContain("Test Novel");
    expect(ctx).toContain("Novel");
  });

  it("includes all genres in the header", () => {
    const ctx = buildContext(baseProject({ genres: ["Thriller", "Mystery"] }));
    expect(ctx).toContain("Thriller");
    expect(ctx).toContain("Mystery");
  });

  it("emits full character details when alwaysInContext is true (default)", () => {
    const char = makeCharacter({
      name: "Alice",
      role: "Protagonist",
      age: "30",
      personality: "Brave and determined",
      fears: "Losing control",
    });
    const ctx = buildContext(baseProject({ characters: [char] }));
    expect(ctx).toContain("Alice");
    expect(ctx).toContain("Protagonist");
    expect(ctx).toContain("Brave and determined");
    expect(ctx).toContain("Losing control");
  });

  it("marks characters with alwaysInContext=false as minor and omits their detail fields", () => {
    const minor = makeCharacter({
      name: "Bob",
      role: "Shopkeeper",
      personality: "Friendly",
      alwaysInContext: false,
    });
    const ctx = buildContext(baseProject({ characters: [minor] }));
    expect(ctx).toContain("Bob");
    expect(ctx).toContain("minor");
    // Personality should NOT appear — minor characters get no detail lines
    expect(ctx).not.toContain("Friendly");
  });

  it("caps story memories at 8 regardless of input size", () => {
    const memories: StoryMemory[] = Array.from({ length: 15 }, (_, i) =>
      makeMemory("general", `fact-${i}`)
    );
    const ctx = buildContext(baseProject({ storyMemories: memories }));

    // Count lines that start with "- [" inside the ESTABLISHED FACTS section
    const factsSection = ctx.split("ESTABLISHED FACTS")[1] ?? "";
    const factLines = factsSection
      .split("\n")
      .filter((l) => l.startsWith("- ["));
    expect(factLines.length).toBeLessThanOrEqual(8);
  });

  it("prioritises high-weight memories over low-weight ones when capped", () => {
    // 10 memories: 9 'general' (weight 1) + 1 'character_decision' (weight 3)
    // Only 8 fit — the character_decision entry must appear because it scores highest
    const memories: StoryMemory[] = [
      ...Array.from({ length: 9 }, (_, i) =>
        makeMemory("general", `generic-fact-${i}`)
      ),
      makeMemory("character_decision", "the protagonist chose betrayal"),
    ];
    const ctx = buildContext(baseProject({ storyMemories: memories }));
    expect(ctx).toContain("the protagonist chose betrayal");
  });

  it("includes style directives from reference works", () => {
    const project = baseProject({
      referenceWorks: [
        {
          id: "rw1",
          projectId: "p1",
          title: "On Writing",
          attributes: {
            pacing: "Fast, punchy sentences",
            tone: "Dry wit",
          },
        },
      ],
    });
    const ctx = buildContext(project);
    expect(ctx).toContain("STYLE DIRECTIVE");
    expect(ctx).toContain("Fast, punchy sentences");
    expect(ctx).toContain("Dry wit");
  });

  it("omits the style directive block when reference works have no attributes", () => {
    const project = baseProject({
      referenceWorks: [
        {
          id: "rw1",
          projectId: "p1",
          title: "A Book",
          attributes: {},
        },
      ],
    });
    const ctx = buildContext(project);
    expect(ctx).not.toContain("STYLE DIRECTIVE");
  });

  it("uses recency to score memories — facts from recent chapters rank higher", () => {
    // Active chapter is ch2 (index 1). ch1-memory has chapterIndex 0 (distance 1),
    // ch0-memory has chapterIndex -5 (very old). Both are 'general', so the only
    // differentiator is recency. Put 10 memories so capping occurs and we can see
    // which ones survive. The recent one should survive; the old one may not.
    const chapters: Chapter[] = [makeChapter("ch1", 0), makeChapter("ch2", 1)];
    const recentMemory = makeMemory("general", "just-happened-fact", 1);
    const staleMemory = makeMemory("general", "ancient-fact", 0);
    // Fill up 9 more general memories at chapterIndex 1 (same recency as recentMemory)
    // so staleMemory competes against them
    const fillerMemories: StoryMemory[] = Array.from({ length: 8 }, (_, i) =>
      makeMemory("general", `filler-${i}`, 1)
    );
    const memories = [staleMemory, recentMemory, ...fillerMemories];
    // 10 total → only 8 survive. staleMemory should be cut (lower recency score).
    const ctx = buildContext(
      baseProject({ storyMemories: memories, chapters, activeChapter: "ch2" })
    );
    expect(ctx).toContain("just-happened-fact");
    expect(ctx).not.toContain("ancient-fact");
  });
});

describe("buildStaticContext — token budget", () => {
  it("does not include a trim marker for small projects", () => {
    const ctx = buildStaticContext(baseProject({ characters: [makeCharacter({ name: "Alice" })] }));
    expect(ctx).not.toContain("[Context trimmed");
  });

  it("appends a trim marker and stays within budget for very large projects", () => {
    const longText = "x".repeat(1000);
    const characters = Array.from({ length: 10 }, (_, i) =>
      makeCharacter({
        id: `c${i}`,
        name: `Character${i}`,
        appearance: longText,
        personality: longText,
        thinkingStyle: longText,
        behavior: longText,
        habits: longText,
        speechPattern: longText,
        arc: longText,
        backstory: longText,
      })
    );
    const ctx = buildStaticContext(baseProject({ characters }));
    expect(ctx).toContain("[Context trimmed — project too large]");
    // 8,000-token budget ≈ 32,000 chars; allow slack for the header section
    // (always included) plus the trim marker itself.
    expect(ctx.length).toBeLessThan(40_000);
  });

  it("produces identical output for identical project data (deterministic truncation)", () => {
    const longText = "y".repeat(1000);
    const characters = Array.from({ length: 10 }, (_, i) =>
      makeCharacter({ id: `c${i}`, name: `Character${i}`, backstory: longText, personality: longText })
    );
    const project = baseProject({ characters });
    expect(buildStaticContext(project)).toBe(buildStaticContext(project));
  });
});
