import { describe, it, expect } from "vitest";
import { getFormatNoun, isStoryFormat, FORMATS } from "../formats";

describe("getFormatNoun", () => {
  it("returns the correct noun for each story format", () => {
    expect(getFormatNoun("Novel")).toBe("novel");
    expect(getFormatNoun("Screenplay")).toBe("screenplay");
    expect(getFormatNoun("Web Series")).toBe("web series");
  });

  it("falls back to 'novel' for creator formats and unrecognized formats", () => {
    expect(getFormatNoun("YouTube Long-form")).toBe("novel");
    expect(getFormatNoun("TikTok Native")).toBe("novel");
    expect(getFormatNoun("Some Custom Format")).toBe("novel");
  });

  it("never returns an empty string for any format in FORMATS", () => {
    for (const format of FORMATS) {
      expect(getFormatNoun(format).length).toBeGreaterThan(0);
    }
  });
});

describe("isStoryFormat", () => {
  it("only story formats are Novel/Screenplay/Web Series", () => {
    const storyFormats = FORMATS.filter(isStoryFormat);
    expect(storyFormats.sort()).toEqual(["Novel", "Screenplay", "Web Series"].sort());
  });
});
