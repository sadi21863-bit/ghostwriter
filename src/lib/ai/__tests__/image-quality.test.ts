import { describe, it, expect } from "vitest";
import { ANATOMY_NEGATIVE_PROMPT, ANATOMY_POSITIVE_DIRECTIVE, withAnatomyDirective } from "../image-quality";

describe("anatomy guards", () => {
  it("the negative prompt covers the common AI failure modes", () => {
    for (const term of ["extra fingers", "bad hands", "bad anatomy", "extra limbs", "impossible pose"]) {
      expect(ANATOMY_NEGATIVE_PROMPT).toContain(term);
    }
  });

  it("withAnatomyDirective appends the directive once and is idempotent", () => {
    const once = withAnatomyDirective("A noir panel.");
    expect(once).toContain(ANATOMY_POSITIVE_DIRECTIVE);
    expect(withAnatomyDirective(once)).toBe(once);
  });
});
