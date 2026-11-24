import { describe, it, expect } from "vitest";
import { MODE_REGISTRY, isGenerationMode } from "@/lib/modes/registry";
import { GATED_MODES, FEATURE_ACCESS } from "@/types/subscription";

/**
 * One source of gating truth (v4 §7 / §9.1).
 *
 * `/api/ai/generate` used to carry TWO independent free-tier checks:
 *
 *   1. `GATED_MODES[mode]` + `canAccessFeature(tier, ...)`  — registry-derived
 *   2. a hardcoded 22-entry `LIBRARY_MODES` set, gated on `tier === "free"`
 *
 * They disagreed: `LIBRARY_MODES` omitted `dialogue`, which the registry gates.
 * More importantly the second check could never fire — every mode it listed was
 * already refused by the first, because both `story_modes_advanced` and
 * `composition_layer` exclude the free tier. That made it 22 lines of duplicated
 * policy that silently could not execute.
 *
 * These tests pin the property that lets it stay deleted: the registry's gates
 * cover every mode that was in the old set, and each such gate actually denies
 * free. If a future gate were added to the free tier, this fails and the removed
 * check would need to come back deliberately rather than by accident.
 */

/** The 22 modes the deleted `LIBRARY_MODES` set listed. */
const FORMER_LIBRARY_MODES = [
  "combat", "emotional", "atmosphere", "tension", "horror",
  "comedy", "mystery", "romance", "action", "monologue",
  "voice", "thriller", "sports", "setting", "historical",
  "scitech", "ethics", "endings", "isekai", "composition",
  "interrogation", "chase",
] as const;

describe("generation gating has a single source of truth", () => {
  it("every formerly-library mode is still gated by the registry", () => {
    const ungated = FORMER_LIBRARY_MODES.filter((m) => !GATED_MODES[m]);
    expect(ungated).toEqual([]);
  });

  it("every formerly-library mode's gate actually denies the free tier", () => {
    // This is what made the hardcoded set dead: the registry check fired first.
    const notDenied = FORMER_LIBRARY_MODES.filter((m) => {
      const gate = GATED_MODES[m]!;
      return (FEATURE_ACCESS[gate] ?? []).includes("free");
    });
    expect(notDenied).toEqual([]);
  });

  it("GATED_MODES is exactly the set of gated registry modes", () => {
    // @/types/subscription derives it from MODE_REGISTRY; this pins that it did.
    const fromRegistry = Object.keys(MODE_REGISTRY).filter(
      (m) => (MODE_REGISTRY as Record<string, { gate: string | null }>)[m]!.gate !== null,
    );
    expect(Object.keys(GATED_MODLES_KEYS()).sort()).toEqual(fromRegistry.sort());
  });

  it("no gate in the table grants the free tier", () => {
    // Measured, not assumed: every entry in FEATURE_ACCESS excludes "free".
    const granting = Object.entries(FEATURE_ACCESS)
      .filter(([, tiers]) => tiers.includes("free"))
      .map(([gate]) => gate);
    expect(granting).toEqual([]);
  });

  it("every gated mode is a registered generation mode", () => {
    for (const mode of Object.keys(GATED_MODES)) {
      expect(isGenerationMode(mode)).toBe(true);
    }
  });
});

/** Helper so the "derived" assertion reads clearly. */
function GATED_MODLES_KEYS(): Record<string, unknown> {
  return GATED_MODES;
}
