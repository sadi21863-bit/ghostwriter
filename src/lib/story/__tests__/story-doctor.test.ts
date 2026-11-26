import { describe, expect, it } from "vitest";
import {
  doctorTokens,
  factBigrams,
  factTerms,
  findKnowledgeConflicts,
  findUnresolvedPromises,
  runStoryDoctor,
  type DoctorChapter,
  type DoctorMemory,
} from "@/lib/story/story-doctor";

/**
 * PLAN-v5 step 5 — one fixture story per check, each with a planted defect the
 * Doctor MUST find, plus a clean control it must NOT flag.
 */

describe("check 1 — knowledge conflict (acting on unlearned information)", () => {
  const chapters: DoctorChapter[] = [
    {
      title: "The Canal",
      sortOrder: 0,
      content:
        "Mara crouched by the lock and slid the brass key into the gate. The canal water rose behind her.",
    },
    {
      title: "The Lesson",
      sortOrder: 1,
      content:
        "Old Tamsin showed Mara how the brass key opens the canal gate, and warned her never to use it at night.",
    },
    {
      title: "Nightfall",
      sortOrder: 2,
      content: "The gate stayed shut.",
    },
  ];

  it("finds the planted defect: Mara uses the key in chapter 1, learns of it in chapter 2", () => {
    const memories: DoctorMemory[] = [
      {
        chapterIndex: 1,
        structuredData: {
          knowledgeShifts: [
            {
              character: "Mara",
              learned: "the brass key opens the canal gate",
              from: "ignorant of the lock",
              to: "knows the key's purpose",
            },
          ],
        },
      },
    ];
    const issues = findKnowledgeConflicts(chapters, memories);
    expect(issues).toHaveLength(1);
    const issue = issues[0]!;
    expect(issue.kind).toBe("knowledge-conflict");
    expect(issue.character).toBe("Mara");
    expect(issue.learnedAtChapter).toBe(1);
    expect(issue.chapterIndex).toBe(0);
    expect(issue.chapterTitle).toBe("The Canal");
    expect(issue.excerpt.toLowerCase()).toContain("brass key");
    expect(issue.message).toContain("chapter 2");
  });

  it("clean control: when the learning precedes the acting chapter, nothing is flagged", () => {
    const memories: DoctorMemory[] = [
      {
        chapterIndex: 0, // learned in chapter 1 — before the canal scene
        structuredData: {
          knowledgeShifts: [{ character: "Mara", learned: "the brass key opens the canal gate" }],
        },
      },
    ];
    expect(findKnowledgeConflicts(chapters, memories)).toEqual([]);
  });

  it("requires the character's name: the same facts without Mara are not a conflict", () => {
    const memories: DoctorMemory[] = [
      {
        chapterIndex: 1,
        structuredData: {
          knowledgeShifts: [{ character: "Tamsin", learned: "the brass key opens the canal gate" }],
        },
      },
    ];
    // Tamsin does not appear in chapter 1's prose.
    expect(findKnowledgeConflicts(chapters, memories)).toEqual([]);
  });

  it("requires real term evidence: one weak token alone is not enough when the fact has several", () => {
    const memories: DoctorMemory[] = [
      {
        chapterIndex: 1,
        structuredData: {
          knowledgeShifts: [{ character: "Mara", learned: "the brass key opens the canal gate" }],
        },
      },
    ];
    const thin: DoctorChapter[] = [
      {
        title: "Thin",
        sortOrder: 0,
        content: "Mara sat by the brass ring and watched the water.", // only "brass"
      },
      chapters[1]!,
    ];
    expect(findKnowledgeConflicts(thin, memories)).toEqual([]);
  });

  it("does not flag shared topic words without a repeated phrase", () => {
    // The real-world false positive: a fact about Sera inheriting the ledger,
    // while an earlier chapter mentions Sera, the ledger, and her mother in
    // separate clauses. Isolated terms are not evidence of acting on the fact.
    const memories: DoctorMemory[] = [
      {
        chapterIndex: 1,
        structuredData: {
          knowledgeShifts: [
            { character: "Sera", learned: "Sera inherited the ledger from her mother" },
          ],
        },
      },
    ];
    const prose: DoctorChapter[] = [
      {
        title: "The Rain Debt",
        sortOrder: 0,
        content:
          "Sera set the ledger on the table, then touched the ring her mother had worn.",
      },
      {
        title: "The Clerk's Hand",
        sortOrder: 1,
        content: "Sera inherited the ledger from her mother, and said so plainly.",
      },
    ];
    expect(findKnowledgeConflicts(prose, memories)).toEqual([]);
  });
});

describe("check 2 — unresolved promise (setup never paid off)", () => {
  it("finds the planted defect: a promise opened in chapter 1 and never resolved", () => {
    const memories: DoctorMemory[] = [
      {
        chapterIndex: 0,
        structuredData: {
          openPromisesCreated: ["The canal key must be returned to the lockkeeper"],
        },
      },
      { chapterIndex: 1, structuredData: {} },
      { chapterIndex: 2, structuredData: {} },
    ];
    const issues = findUnresolvedPromises(memories);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe("unresolved-promise");
    expect(issues[0]!.promise).toBe("The canal key must be returned to the lockkeeper");
    expect(issues[0]!.openedInChapter).toBe(0);
    expect(issues[0]!.message).toContain("chapter 1");
  });

  it("clean control: a fuzzy resolution pays the promise off", () => {
    const memories: DoctorMemory[] = [
      {
        chapterIndex: 0,
        structuredData: { openPromisesCreated: ["relit the lamp at dawn"] },
      },
      {
        chapterIndex: 1,
        structuredData: { openPromisesResolved: ["relit the lamp"] },
      },
    ];
    expect(findUnresolvedPromises(memories)).toEqual([]);
  });

  it("order independence: memories arriving out of chapter order resolve the same way", () => {
    const memories: DoctorMemory[] = [
      { chapterIndex: 2, structuredData: {} },
      {
        chapterIndex: 0,
        structuredData: { openPromisesCreated: ["the lamp must be relit at dawn"] },
      },
      { chapterIndex: 1, structuredData: { openPromisesResolved: ["must be relit"] } },
    ];
    expect(findUnresolvedPromises(memories)).toEqual([]);
  });

  it("dedupes repeated creations and keeps the FIRST opening chapter", () => {
    const memories: DoctorMemory[] = [
      { chapterIndex: 0, structuredData: { openPromisesCreated: ["Find the letter"] } },
      { chapterIndex: 1, structuredData: { openPromisesCreated: ["Find the letter"] } },
    ];
    const issues = findUnresolvedPromises(memories);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.openedInChapter).toBe(0);
  });
});

describe("runStoryDoctor — the whole report", () => {
  it("returns both planted defects plus the checked counts", () => {
    const report = runStoryDoctor({
      chapters: [
        { title: "One", sortOrder: 1, content: "Mara turned the brass key in the canal gate." },
        { title: "Two", sortOrder: 0, content: "A prologue with no named actor." },
        { title: "Three", sortOrder: 2, content: "" },
      ],
      memories: [
        {
          chapterIndex: 0,
          structuredData: {
            openPromisesCreated: ["The ledger must balance"],
          },
        },
        {
          // Ordered chapters are Two(0), One(1), Three(2): learning recorded in
          // the LAST chapter, so One (index 1) is genuinely earlier.
          chapterIndex: 2,
          structuredData: {
            knowledgeShifts: [{ character: "Mara", learned: "the brass key opens the canal gate" }],
          },
        },
      ],
    });
    expect(report.issues.map((i) => i.kind).sort()).toEqual([
      "knowledge-conflict",
      "unresolved-promise",
    ]);
    expect(report.checked).toEqual({
      chapters: 3,
      knowledgeShifts: 1,
      promisesCreated: 1,
      promisesResolved: 0,
    });
  });

  it("a clean story yields zero issues", () => {
    const report = runStoryDoctor({
      chapters: [{ title: "Only", sortOrder: 0, content: "Mara lit the lamp and slept." }],
      memories: [
        {
          chapterIndex: 0,
          structuredData: {
            openPromisesCreated: ["relit the lamp at dawn"],
            openPromisesResolved: ["relit the lamp"],
          },
        },
      ],
    });
    expect(report.issues).toEqual([]);
  });
});

describe("token helpers", () => {
  it("drops stopwords and short words; keeps distinctive terms", () => {
    expect(doctorTokens("The BRASS key, of the canal!")).toEqual(["brass", "canal"]);
    expect(factTerms("the brass key opens the canal gate")).toEqual([
      "brass",
      "opens",
      "canal",
      "gate",
    ]);
    expect(factTerms("")).toEqual([]);
  });

  it("builds ordered content bigrams for phrase evidence", () => {
    expect(factBigrams("the brass key opens the canal gate")).toEqual([
      "brass key",
      "key opens",
      "opens canal",
      "canal gate",
    ]);
    expect(factBigrams("The ledger")).toEqual([]);
    expect(factBigrams("")).toEqual([]);
  });
});
