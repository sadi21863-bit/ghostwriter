import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Studio entry point", () => {
  it("WritingRoom links to /project/[id]/studio so Studio isn't an orphaned route", () => {
    const source = readFileSync(join(__dirname, "..", "WritingRoom.tsx"), "utf-8");
    expect(source).toMatch(/\/project\/\$\{project\.id\}\/studio/);
  });
});
