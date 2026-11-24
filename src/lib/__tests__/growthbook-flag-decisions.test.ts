import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FLAGS } from "@/lib/growthbook";
import {
  EXPERIMENTAL_CAPABILITIES,
  SCENE_BLUEPRINT_CAPABILITY,
  isExperimental,
} from "@/lib/ai/experimental-capabilities";

/**
 * Phase 0 / v4 item 8 — GrowthBook flag decisions.
 *
 * v4 requires that live GrowthBook flags stop living in indefinite limbo: each
 * gets promote+test, quarantine, or delete. Two rules follow, and both are
 * enforced here rather than left to reviewer memory:
 *
 *  1. No flag may exist without a real production reader. Seven keys
 *     (craft_library, constellation_view, draft_branching, reader_mode,
 *     command_palette, adaptive_onboarding, new_design_tokens) had zero readers
 *     and were deleted; this test stops them coming back as dormant branches.
 *  2. An experimental capability kept behind a flag must not be a silent
 *     disabled path — it needs provider/model/token budget, a cost estimate, a
 *     contract test, a named gate, and a lifecycle status.
 */

// This file is src/lib/__tests__/x.test.ts — three levels below the repo root.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next") continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const ALL_SOURCES = walk(SRC);
const rel = (p: string) => p.replace(ROOT + "\\", "").replace(/\\/g, "/");

/**
 * Production read-sites per `FLAGS.<name>`, computed in a SINGLE pass.
 *
 * The first version called a per-flag `prodReaders()` that re-walked and re-read
 * every file under src/ for each flag. Under full-suite contention that blew the
 * 5s timeout twice over. Reading each file once and testing every flag against it
 * turns O(flags × files) into O(files).
 */
function allProdReaders(): Map<string, string[]> {
  const definitionFile = "src/lib/growthbook.ts";
  const readers = new Map<string, string[]>(Object.keys(FLAGS).map((n) => [n, []]));
  for (const f of ALL_SOURCES) {
    const relPath = rel(f);
    if (relPath === definitionFile || relPath.includes("__tests__")) continue;
    const src = readFileSync(f, "utf8");
    for (const name of Object.keys(FLAGS)) {
      if (new RegExp(`FLAGS\\.${name}\\b`).test(src)) readers.get(name)!.push(relPath);
    }
  }
  return readers;
}

const READERS = allProdReaders();

describe("GrowthBook flags have no dormant branches", () => {
  const names = Object.keys(FLAGS);

  it("has only the two flags v4 decided to keep", () => {
    // sceneBlueprint -> quarantined experimental capability
    // streaming     -> promote + test, then remove in Phase 1
    expect(names.sort()).toEqual(["sceneBlueprint", "streaming"]);
  });

it.each(names)("%s has at least one production reader", (name) => {
expect(READERS.get(name)).not.toEqual([]);
});

  it("no longer defines the seven unread keys", () => {
    const deleted = [
      "craft_library",
      "constellation_view",
      "draft_branching",
      "reader_mode",
      "command_palette",
      "adaptive_onboarding",
      "new_design_tokens",
      "home_redesign",
    ];
    const values = Object.values(FLAGS) as string[];
    expect(values.filter((v) => deleted.includes(v))).toEqual([]);
  });
});

describe("sceneBlueprint quarantine", () => {
  it("is registered as an experimental capability", () => {
    expect(isExperimental("scene_blueprint")).toBe(true);
    expect(SCENE_BLUEPRINT_CAPABILITY.model).toBe("claude-haiku-4-5-20251001");
  });

  it("declares a non-zero cost estimate and how it was derived", () => {
    expect(SCENE_BLUEPRINT_CAPABILITY.estimatedUsdPerCall).toBeGreaterThan(0);
    expect(SCENE_BLUEPRINT_CAPABILITY.costBasis).toMatch(/\$/);
  });

  it("is marked experimental, not promoted", () => {
    expect(SCENE_BLUEPRINT_CAPABILITY.status).toBe("experimental");
  });

  it("points at a contract test that actually exists", () => {
    expect(existsAtRoot(SCENE_BLUEPRINT_CAPABILITY.contractTest)).toBe(true);
  });

  it("the token budget matches the real provider call", () => {
    // Guards the metadata against drifting from the implementation it describes.
    const src = readFileSync(join(ROOT, "src/lib/ai/scene-blueprint.ts"), "utf8");
    const maxTokens = /max_tokens:\s*(\d+)/.exec(src)?.[1];
    const model = /model:\s*["']([^"']+)["']/.exec(src)?.[1];
    expect(Number(maxTokens)).toBe(SCENE_BLUEPRINT_CAPABILITY.maxTokens);
    expect(model).toBe(SCENE_BLUEPRINT_CAPABILITY.model);
  });

  it("every experimental capability is complete", () => {
    for (const c of EXPERIMENTAL_CAPABILITIES) {
      expect({ ...c, id: undefined }).toMatchObject({
        description: expect.any(String),
        provider: expect.any(String),
        model: expect.any(String),
        maxTokens: expect.any(Number),
        estimatedUsdPerCall: expect.any(Number),
        costBasis: expect.any(String),
        contractTest: expect.any(String),
        gate: expect.any(String),
        status: expect.any(String),
      });
    }
  });
});

function existsAtRoot(p: string): boolean {
  try {
    statSync(join(ROOT, p));
    return true;
  } catch {
    return false;
  }
}