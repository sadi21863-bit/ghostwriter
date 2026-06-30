import { describe, it, expect } from "vitest";
import { buildDialogueBubbleSvg, buildCaptionBoxSvg } from "../bubble-svg";

describe("buildDialogueBubbleSvg", () => {
  it("renders a speech bubble as an ellipse with a tail, sized to the given box", () => {
    const svg = buildDialogueBubbleSvg({ width: 400, height: 150, bubbleType: "speech" });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="150"');
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("<polygon"); // the tail
    expect(svg).not.toContain("<circle"); // no thought-bubble trail circles
  });

  it("renders a shout bubble as a jagged polygon, not an ellipse", () => {
    const svg = buildDialogueBubbleSvg({ width: 400, height: 150, bubbleType: "shout" });
    expect(svg).toContain("<polygon");
    expect(svg).not.toContain("<ellipse");
  });

  it("renders a thought bubble as an ellipse with trailing circles instead of a tail", () => {
    const svg = buildDialogueBubbleSvg({ width: 400, height: 150, bubbleType: "thought" });
    expect(svg).toContain("<ellipse");
    expect(svg).not.toContain("<polygon");
    const circleCount = svg.split("<circle").length - 1;
    expect(circleCount).toBeGreaterThanOrEqual(3);
  });
});

describe("buildCaptionBoxSvg", () => {
  it("renders a plain rectangle box sized to the given dimensions", () => {
    const svg = buildCaptionBoxSvg(400, 60);
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="60"');
    expect(svg).toContain("<rect");
    expect(svg).not.toContain("<ellipse");
    expect(svg).not.toContain("<polygon");
  });
});
