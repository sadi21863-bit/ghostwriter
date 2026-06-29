import { describe, it, expect } from "vitest";
import { MODE_REGISTRY } from "../registry";

const ROLES = ["director", "writer", "editor"];
const STAGES = ["discover", "shape", "write", "produce"];

describe("MODE_REGISTRY role/stage tagging", () => {
  it("every mode declares a valid role and stage", () => {
    for (const [mode, cfg] of Object.entries(MODE_REGISTRY)) {
      expect(ROLES, `${mode}.role`).toContain((cfg as any).role);
      expect(STAGES, `${mode}.stage`).toContain((cfg as any).stage);
    }
  });

  it("brainstorm is discover/writer and outline is shape/director", () => {
    expect(MODE_REGISTRY.brainstorm.stage).toBe("discover");
    expect(MODE_REGISTRY.brainstorm.role).toBe("writer");
    expect(MODE_REGISTRY.outline.stage).toBe("shape");
    expect(MODE_REGISTRY.outline.role).toBe("director");
  });

  it("write and the craft modes are write/writer", () => {
    expect(MODE_REGISTRY.write.stage).toBe("write");
    expect(MODE_REGISTRY.write.role).toBe("writer");
    expect(MODE_REGISTRY.dialogue.stage).toBe("write");
    expect(MODE_REGISTRY.combat.role).toBe("writer");
  });
});
