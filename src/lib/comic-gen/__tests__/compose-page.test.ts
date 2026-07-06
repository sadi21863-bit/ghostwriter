import { describe, it, expect } from "vitest";
import { pageLayoutFor } from "@/lib/comic-gen/compose-page";

describe("pageLayoutFor", () => {
  it("lays out a single panel as 1 column-row, canvas sized to one cell", () => {
    expect(pageLayoutFor(1)).toEqual({ cols: 2, rows: 1, canvasWidth: 1056, canvasHeight: 528, cellSize: 528 });
  });

  it("lays out 2 panels as one full row", () => {
    expect(pageLayoutFor(2)).toEqual({ cols: 2, rows: 1, canvasWidth: 1056, canvasHeight: 528, cellSize: 528 });
  });

  it("lays out 3 panels across 2 rows (2 + 1)", () => {
    expect(pageLayoutFor(3)).toEqual({ cols: 2, rows: 2, canvasWidth: 1056, canvasHeight: 1056, cellSize: 528 });
  });

  it("lays out 6 panels (the standard full page) as 2x3, matching exportPng()'s 1056x1584 canvas", () => {
    expect(pageLayoutFor(6)).toEqual({ cols: 2, rows: 3, canvasWidth: 1056, canvasHeight: 1584, cellSize: 528 });
  });

  it("caps at 6 panels — extra panels don't grow the canvas further", () => {
    expect(pageLayoutFor(9)).toEqual({ cols: 2, rows: 3, canvasWidth: 1056, canvasHeight: 1584, cellSize: 528 });
  });

  it("treats zero or negative panel counts as at least 1", () => {
    expect(pageLayoutFor(0)).toEqual({ cols: 2, rows: 1, canvasWidth: 1056, canvasHeight: 528, cellSize: 528 });
  });
});
