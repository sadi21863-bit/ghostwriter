import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("RAG projectId in fetch payloads", () => {
  it("WritingRoom surgical-edit fetch includes projectId", () => {
    const src = readFileSync(join(__dirname, "..", "WritingRoom.tsx"), "utf-8");
    // Find the surgical-edit fetch block and confirm projectId is in its body
    const fetchBlock = src.slice(src.indexOf("/api/ai/surgical-edit"));
    const bodyEnd = fetchBlock.indexOf("});");
    expect(fetchBlock.slice(0, bodyEnd)).toContain("projectId");
  });

  it("EditorNotesPanel prose-fix fetch includes projectId", () => {
    const src = readFileSync(join(__dirname, "..", "EditorNotesPanel.tsx"), "utf-8");
    const fetchBlock = src.slice(src.indexOf("/api/ai/prose-fix"));
    const bodyEnd = fetchBlock.indexOf("});");
    expect(fetchBlock.slice(0, bodyEnd)).toContain("projectId");
  });

  it("StoryHealthPanel prose-fix fetch includes projectId", () => {
    const src = readFileSync(join(__dirname, "..", "panels", "StoryHealthPanel.tsx"), "utf-8");
    const fetchBlock = src.slice(src.indexOf("/api/ai/prose-fix"));
    const bodyEnd = fetchBlock.indexOf("});");
    expect(fetchBlock.slice(0, bodyEnd)).toContain("projectId");
  });
});
