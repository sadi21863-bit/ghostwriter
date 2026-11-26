import { describe, expect, it } from "vitest";
import {
  cleanBeat,
  longestCommonWordRun,
  looksTruncated,
  scrubArtifacts,
  splitUnitTitle,
  words,
  worstRepeat,
} from "@/lib/story/loop-guards";

/**
 * The story loop's guards are the only thing between a model drift and a
 * published unit: a truncated completion must be rejected, a verbatim echo
 * (including of a LATER unit on resume) must be caught, and artifact labels
 * must never reach the page. Each case pins the behaviour the loop relies on,
 * not just absence-of-crash.
 */

/** 15 words, used as the known shared run throughout. */
const SHARED_PASSAGE =
  "the keeper climbed the tower and lit the lamp before the storm arrived at dawn";

describe("words", () => {
  it("counts whitespace-separated words and treats blank text as zero", () => {
    expect(words("  the fog  came in\nlow ")).toBe(5);
    expect(words("")).toBe(0);
    expect(words("   \n\t ")).toBe(0);
  });
});

describe("scrubArtifacts", () => {
  it("removes CHAPTER/SCENE/EPISODE label lines and bold chapter markers", () => {
    const input = [
      "CHAPTER 1",
      "The fog came in low.",
      "SCENE 2:",
      "She lit the lamp.",
      "EPISODE 3",
      "**CHAPTER 4**",
      "The light answered.",
    ].join("\n");
    expect(scrubArtifacts(input)).toBe(
      "The fog came in low.\nShe lit the lamp.\nThe light answered.",
    );
  });

  it("removes BEAT: prefixes and --- separators wherever they appear", () => {
    const input = [
      "BEAT:",
      "Rhea crossed the yard.",
      "BEAT: The lamp guttered.",
      "---",
      "---=",
      "The fog held.",
    ].join("\n");
    expect(scrubArtifacts(input)).toBe(
      "Rhea crossed the yard.\nThe lamp guttered.\nThe fog held.",
    );
  });

  it("keeps legitimate prose that mentions chapters without label syntax", () => {
    const prose =
      "The chapter opened quietly. She read chapter one twice, then set the book down.";
    expect(scrubArtifacts(prose)).toBe(prose);
  });

  it("collapses 3+ newlines to one blank line and trims the edges", () => {
    expect(scrubArtifacts("\n\nAlpha.\n\n\n\nBeta.\n\nGamma.\n\n\n")).toBe(
      "Alpha.\n\nBeta.\n\nGamma.",
    );
  });
});

describe("looksTruncated", () => {
  it("treats empty and whitespace-only text as truncated", () => {
    expect(looksTruncated("")).toBe(true);
    expect(looksTruncated("   \n\t")).toBe(true);
  });

  it("flags a completion cut off mid-sentence", () => {
    expect(looksTruncated("The fog came in low and")).toBe(true);
    expect(looksTruncated("She set the lamp down,")).toBe(true);
  });

  it("accepts terminal punctuation, including a closing quote or bracket", () => {
    for (const ending of [".", "!", "?", '"', ".”", "’", ")", "]"]) {
      expect(looksTruncated(`A sentence ends here${ending}`)).toBe(false);
    }
  });
});

describe("longestCommonWordRun", () => {
  it("returns the exact run for a known synthetic pair", () => {
    const a = `${SHARED_PASSAGE} then she slept.`;
    const b = `nothing moved at all. ${SHARED_PASSAGE} after that.`;
    expect(longestCommonWordRun(a, b)).toBe(15);
  });

  it("ignores case, punctuation and curly apostrophes", () => {
    expect(
      longestCommonWordRun(
        "She didn’t run. She climbed the tower.",
        "SHE DIDN'T RUN she climbed the tower",
      ),
    ).toBe(7);
    expect(longestCommonWordRun("It’s cold", "it's COLD")).toBe(2);
  });

  it("returns 0 when either side has no words", () => {
    expect(longestCommonWordRun("", SHARED_PASSAGE)).toBe(0);
    expect(longestCommonWordRun(SHARED_PASSAGE, "   ")).toBe(0);
    expect(longestCommonWordRun("...", "!!!")).toBe(0);
  });

  it("caps each side at 6000 words without crashing", () => {
    const repeated = "alpha ".repeat(6100);
    expect(longestCommonWordRun(repeated, repeated)).toBe(6000);
    const beyondCap = `${"filler ".repeat(6000)}needle in the haystack`;
    expect(longestCommonWordRun(beyondCap, "needle in the haystack")).toBe(0);
  });
});

describe("worstRepeat", () => {
  it("returns the maximum run across multiple rows and its row index", () => {
    const content = `${SHARED_PASSAGE} then she slept.`;
    const rows = [
      { content: "a completely different sentence about nothing at all" },
      { content: SHARED_PASSAGE },
      { content: "the keeper climbed the tower and lit the lamp" },
    ];
    expect(worstRepeat(content, rows, 0)).toEqual({ run: 15, index: 1 });
  });

  it("skips the unit itself", () => {
    const rows = [
      { content: SHARED_PASSAGE },
      { content: "unrelated words entirely" },
    ];
    expect(worstRepeat(SHARED_PASSAGE, rows, 0)).toEqual({ run: 0, index: -1 });
  });

  it("skips empty and null rows", () => {
    const rows = [{ content: null }, { content: "   " }, { content: "" }];
    expect(worstRepeat(SHARED_PASSAGE, rows, 0)).toEqual({ run: 0, index: -1 });
  });

  it("catches an echo of a LATER row — the resume case", () => {
    const rows = [{ content: "" }, { content: SHARED_PASSAGE }];
    expect(worstRepeat(SHARED_PASSAGE, rows, 0)).toEqual({ run: 15, index: 1 });
  });

  it("masks an allowlisted refrain in both texts", () => {
    const refrain = "the light remembers every ship that never came home";
    const content = `Rhea climbed the stairs at dusk. ${refrain}. She slept.`;
    const rows = [
      { content: `Tam waited by the ferry. ${refrain}. The fog rose.` },
    ];
    expect(worstRepeat(content, rows, 1).run).toBe(9);
    expect(worstRepeat(content, rows, 1, { allow: [refrain] })).toEqual({
      run: 1,
      index: 0,
    });
  });

  it("normalizes whitespace in an allowlist phrase", () => {
    const content =
      "The light  remembers\nevery ship that never came home.";
    const rows = [
      { content: "the light remembers every ship that never came home." },
    ];
    expect(worstRepeat(content, rows, 1).run).toBe(9);
    expect(
      worstRepeat(content, rows, 1, {
        allow: ["  the light remembers\nevery ship that never came home  "],
      }).run,
    ).toBe(1);
  });

  it("returns { run: 0, index: -1 } when every row is clean", () => {
    expect(
      worstRepeat(SHARED_PASSAGE, [{ content: "nothing here overlaps" }], 0),
    ).toEqual({ run: 0, index: -1 });
    expect(worstRepeat(SHARED_PASSAGE, [], 0)).toEqual({ run: 0, index: -1 });
  });
});

describe("cleanBeat", () => {
  it("strips numbering, BEAT:, and CHAPTER/SCENE/EPISODE label variants", () => {
    expect(cleanBeat("1. BEAT: 1. The Lamp — Rhea lights it.")).toBe(
      "The Lamp — Rhea lights it.",
    );
    expect(cleanBeat("2) CHAPTER 3: The Storm")).toBe("The Storm");
    expect(cleanBeat("SCENE 4 - Int. Tower")).toBe("Int. Tower");
    expect(cleanBeat("EPISODE 5: Cold Open")).toBe("Cold Open");
    expect(cleanBeat("  plain beat  ")).toBe("plain beat");
  });
});

describe("splitUnitTitle", () => {
  it("takes the segment before an em, en or hyphen separator", () => {
    expect(splitUnitTitle("The Lamp — Rhea lights it", "Chapter 1")).toBe(
      "The Lamp",
    );
    expect(splitUnitTitle("The Lamp – Rhea lights it", "Chapter 1")).toBe(
      "The Lamp",
    );
    expect(splitUnitTitle("The Lamp - Rhea lights it", "Chapter 1")).toBe(
      "The Lamp",
    );
  });

  it("keeps a separator-free beat and falls back only when empty", () => {
    expect(splitUnitTitle("The Lamp", "Chapter 1")).toBe("The Lamp");
    expect(splitUnitTitle("   ", "Chapter 1")).toBe("Chapter 1");
    expect(splitUnitTitle("", "Scene 2")).toBe("Scene 2");
  });

  it("preserves hyphens inside a title", () => {
    expect(splitUnitTitle("The Half-Light — Rhea lights it", "Chapter 1")).toBe(
      "The Half-Light",
    );
    expect(splitUnitTitle("The Half-Light", "Chapter 1")).toBe("The Half-Light");
    expect(splitUnitTitle("A Two-Part Debt - Rhea pays it", "Chapter 1")).toBe(
      "A Two-Part Debt",
    );
  });
});
