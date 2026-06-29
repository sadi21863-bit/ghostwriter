import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCapabilities, getCapabilitiesByStage, getCapabilitiesByRole } from "../registry";
import { MODE_REGISTRY } from "@/lib/modes/registry";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function routeFileForEndpoint(endpoint: string): string {
  return join(REPO_ROOT, "src", "app", endpoint.replace(/^\//, ""), "route.ts");
}

describe("getCapabilities", () => {
  const caps = getCapabilities();

  it("includes every MODE_REGISTRY mode exactly once as kind:mode", () => {
    const modeIds = caps.filter(c => c.kind === "mode").map(c => c.id).sort();
    expect(modeIds).toEqual(Object.keys(MODE_REGISTRY).sort());
  });

  it("has no duplicate ids across modes + tools", () => {
    const ids = caps.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every capability has a valid role, stage, and provider", () => {
    for (const c of caps) {
      expect(["director", "writer", "editor"]).toContain(c.role);
      expect(["discover", "shape", "write", "produce"]).toContain(c.stage);
      expect(["anthropic", "segmind", "openai", "internal"]).toContain(c.provider);
    }
  });

  it("drift guard: every tool capability with a static endpoint points at a real route.ts", () => {
    const missing: string[] = [];
    for (const c of caps) {
      if (c.kind === "tool" && c.endpoint && !c.endpoint.includes("[")) {
        if (!existsSync(routeFileForEndpoint(c.endpoint))) missing.push(`${c.id} -> ${c.endpoint}`);
      }
    }
    expect(missing, `tool endpoints with no route.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("groups by stage and role", () => {
    expect(getCapabilitiesByStage("write").length).toBeGreaterThan(0);
    expect(getCapabilitiesByRole("director").length).toBeGreaterThan(0);
    expect(getCapabilitiesByStage("write").every(c => c.stage === "write")).toBe(true);
  });
});
