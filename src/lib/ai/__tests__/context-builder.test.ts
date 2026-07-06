import { describe, it, expect } from "vitest";
import { buildContext, buildStaticContext, buildDynamicContext, contextIsTrimmed, type ContextProject, type StoryMemory } from "@/lib/ai/context-builder";
import type { Character, Chapter, Location, PlotThread } from "@/types";

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

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "l1",
    projectId: "p1",
    name: "The Old Mill",
    description: "",
    atmosphere: "",
    history: "",
    sensoryDetails: "",
    sortOrder: 0,
    alwaysInContext: true,
    linkedCharacterIds: [],
    ...overrides,
  };
}

function makePlotThread(overrides: Partial<PlotThread> = {}): PlotThread {
  return {
    id: "t1",
    projectId: "p1",
    name: "The Conspiracy",
    description: "",
    status: "Active",
    stakes: "",
    connections: "",
    sortOrder: 0,
    alwaysInContext: true,
    ...overrides,
  };
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

describe("contextIsTrimmed — surfaces Headroom's trim marker as a boolean", () => {
  it("is false for small projects", () => {
    expect(contextIsTrimmed(baseProject({ characters: [makeCharacter({ name: "Alice" })] }))).toBe(false);
  });

  it("is true for projects large enough that buildStaticContext trims a section", () => {
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
    expect(contextIsTrimmed(baseProject({ characters }))).toBe(true);
  });
});

describe("contextPolicy — mode-aware section gating (C-2)", () => {
  it("uses brief character depth (no backstory/profile detail) for modes with charDepth: 'brief'", () => {
    const char = makeCharacter({
      name: "Alice",
      personality: "Brave and determined",
      backstory: "Grew up in a war zone.",
      arc: "Redemption",
    });
    const ctx = buildStaticContext(baseProject({ characters: [char] }), "setting");
    expect(ctx).toContain("Alice");
    expect(ctx).toContain("Brave and determined");
    expect(ctx).toContain("Arc: Redemption");
    expect(ctx).not.toContain("Backstory:");
  });

  it("uses full character depth (including backstory) when no mode is passed", () => {
    const char = makeCharacter({
      name: "Alice",
      personality: "Brave and determined",
      backstory: "Grew up in a war zone.",
    });
    const ctx = buildStaticContext(baseProject({ characters: [char] }));
    expect(ctx).toContain("Backstory: Grew up in a war zone.");
  });

  it("omits the LOCATIONS section for modes with needsLocations: false (dialogue)", () => {
    const project = baseProject({
      characters: [makeCharacter({ name: "Alice", backstory: "Grew up in a war zone." })],
      locations: [makeLocation({ name: "The Old Mill" })],
    });

    const withoutMode = buildStaticContext(project);
    expect(withoutMode).toContain("LOCATIONS:");
    expect(withoutMode).toContain("The Old Mill");

    const dialogueCtx = buildStaticContext(project, "dialogue");
    expect(dialogueCtx).not.toContain("LOCATIONS:");
    // dialogue still gets full character depth
    expect(dialogueCtx).toContain("Backstory: Grew up in a war zone.");
  });

  it("omits the PLOTS section for modes with needsPlotThreads: false (combat)", () => {
    const project = baseProject({ plotThreads: [makePlotThread({ name: "The Conspiracy" })] });
    expect(buildStaticContext(project)).toContain("PLOTS:");
    expect(buildStaticContext(project, "combat")).not.toContain("PLOTS:");
  });

  it("omits STORY MEMORY for modes with needsMemories: false (combat)", () => {
    const memories: StoryMemory[] = [makeMemory("general", "the bridge collapsed last winter")];
    const project = baseProject({ storyMemories: memories });
    expect(buildDynamicContext(project)).toContain("STORY MEMORY");
    expect(buildDynamicContext(project, "combat")).not.toContain("STORY MEMORY");
  });

  it("suppresses realism injection for modes with needsRealism: false even when activeMode has domains", () => {
    const project = baseProject({ activeMode: "combat" });
    // No policy passed (defaults to full policy, needsRealism: true) — picks up
    // realism domains from p.activeMode.
    expect(buildDynamicContext(project)).toContain("COMBAT REALISM");
    // "write" mode's policy sets needsRealism: false, suppressing it.
    expect(buildDynamicContext(project, "write")).not.toContain("COMBAT REALISM");
  });

  it("applies a tighter static-context budget for lower subscription tiers via the tier param", () => {
    const longField = "x".repeat(1500);
    const characters = Array.from({ length: 5 }, (_, i) =>
      makeCharacter({ id: `c${i}`, name: `Character${i}`, personality: longField, backstory: longField })
    );
    const project = baseProject({ characters });

    const noTier = buildStaticContext(project, "write");
    expect(noTier).not.toContain("[Context trimmed");

    const freeTier = buildStaticContext(project, "write", "free");
    expect(freeTier).toContain("[Context trimmed — project too large]");
    expect(freeTier.length).toBeLessThan(noTier.length);
  });

  it("buildContext threads mode and tier through to both static and dynamic context", () => {
    const project = baseProject({
      characters: [makeCharacter({ name: "Alice", backstory: "Grew up in a war zone." })],
      locations: [makeLocation({ name: "The Old Mill" })],
      activeMode: "dialogue",
    });
    const ctx = buildContext(project, "dialogue");
    expect(ctx).not.toContain("LOCATIONS:");
    expect(ctx).toContain("Backstory: Grew up in a war zone.");
  });
});

describe("buildStaticContext — character embodiment", () => {
  it("emits backstory, want/need, and contradiction as data only, without instructional sentences", () => {
    const char = makeCharacter({
      name: "Alice",
      backstory: "Grew up in a war zone.",
    });
    (char as any).characterWant = "to be free";
    (char as any).characterNeed = "to forgive herself";
    (char as any).contradiction = "Craves connection but pushes everyone away.";

    const ctx = buildStaticContext(baseProject({ characters: [char] }));

    expect(ctx).toContain("Backstory: Grew up in a war zone.");
    expect(ctx).toContain("Want: to be free");
    expect(ctx).toContain("Need: to forgive herself");
    expect(ctx).toContain("Contradiction: Craves connection but pushes everyone away.");
    expect(ctx).not.toContain("do not state — embody");
    expect(ctx).not.toContain("DEFINING CONTRADICTION");
    expect(ctx).not.toContain("collision between want and need");
  });
});

describe("buildStaticContext — story graph wiring", () => {
  it("flags a character with no location, thread, or relationship as unconnected", () => {
    const project = baseProject({
      characters: [
        makeCharacter({ id: "c1", name: "Alice", linkedLocationIds: ["l1"] }),
        makeCharacter({ id: "c2", name: "Ghost", linkedLocationIds: [], linkedPlotThreadIds: [] }),
      ],
      locations: [makeLocation({ id: "l1", name: "The Old Mill" })],
    });
    const ctx = buildStaticContext(project);
    expect(ctx).toContain("UNCONNECTED CHARACTERS");
    expect(ctx).toContain("Ghost");
    expect(ctx).not.toMatch(/UNCONNECTED CHARACTERS[^\n]*Alice/);
  });

  it("does not flag any character as unconnected once every character has a location, thread, or relationship", () => {
    const project = baseProject({
      characters: [
        makeCharacter({ id: "c1", name: "Alice", linkedLocationIds: ["l1"] }),
        makeCharacter({ id: "c2", name: "Bob", linkedPlotThreadIds: ["t1"] }),
      ],
      locations: [makeLocation({ id: "l1", name: "The Old Mill" })],
      plotThreads: [makePlotThread({ id: "t1", name: "The Conspiracy" })],
    });
    expect(buildStaticContext(project)).not.toContain("UNCONNECTED CHARACTERS");
  });

  it("lists which characters appear at a location, derived from linkedLocationIds", () => {
    const project = baseProject({
      characters: [makeCharacter({ id: "c1", name: "Alice", linkedLocationIds: ["l1"] })],
      locations: [makeLocation({ id: "l1", name: "The Old Mill" })],
    });
    const ctx = buildStaticContext(project);
    expect(ctx).toContain("Characters seen here: Alice");
  });

  it("lists which characters drive a plot thread, derived from linkedPlotThreadIds", () => {
    const project = baseProject({
      characters: [makeCharacter({ id: "c1", name: "Alice", linkedPlotThreadIds: ["t1"] })],
      plotThreads: [makePlotThread({ id: "t1", name: "The Conspiracy" })],
    });
    const ctx = buildStaticContext(project);
    expect(ctx).toContain("Driven by: Alice");
  });

  it("skips graph computation (no UNCONNECTED / derived lines) for brief-depth modes", () => {
    const project = baseProject({
      characters: [makeCharacter({ id: "c1", name: "Ghost" })],
      locations: [makeLocation({ id: "l1", name: "The Old Mill" })],
    });
    const ctx = buildStaticContext(project, "setting"); // charDepth: "brief"
    expect(ctx).not.toContain("UNCONNECTED CHARACTERS");
    expect(ctx).not.toContain("Characters seen here");
  });
});

describe("world entities (World Bible expansion)", () => {
  const entity = { kind: "weapon", name: "The Ember Blade", summary: "a sword that burns cold", alwaysInContext: true };

  it("includes the WORLD ELEMENTS section under a needsWorldEntities policy (combat)", () => {
    const ctx = buildStaticContext(baseProject({ worldEntities: [entity] }), "combat");
    expect(ctx).toContain("WORLD ELEMENTS:");
    expect(ctx).toContain("The Ember Blade");
    expect(ctx).toContain("Weapons:");
  });

  it("omits the section for a mode that does not opt in (atmosphere)", () => {
    const ctx = buildStaticContext(baseProject({ worldEntities: [entity] }), "atmosphere");
    expect(ctx).not.toContain("WORLD ELEMENTS:");
    expect(ctx).not.toContain("The Ember Blade");
  });

  it("includes the section for no-mode callers (FULL policy)", () => {
    const ctx = buildStaticContext(baseProject({ worldEntities: [entity] }));
    expect(ctx).toContain("The Ember Blade");
  });

  it("skips an entity flagged alwaysInContext=false", () => {
    const ctx = buildStaticContext(baseProject({ worldEntities: [{ ...entity, alwaysInContext: false }] }), "combat");
    expect(ctx).not.toContain("The Ember Blade");
  });
});
