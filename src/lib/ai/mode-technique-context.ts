import { buildCombatContext } from "@/lib/combat";
import { buildEmotionalContext } from "@/lib/emotional";
import { buildTensionContext } from "@/lib/tension";
import { buildAtmosphereContext } from "@/lib/atmosphere";

export interface ModeTechniqueRequest {
  mode?: string;
  combatStyleA?: string;
  combatStyleB?: string;
  combatStyleAOwner?: string;
  combatStyleBOwner?: string;
  emotion?: string;
  tensionType?: string;
  atmosphere?: string;
}

/**
 * Generic per-mode technique-library lookup, shared across Writer/Director/Editor
 * tools. Previously the deep technique libraries (combat biomechanics, emotional
 * FACS/polyvagal signatures, tension discourse structure, atmosphere psychology)
 * were only reachable via each mode's own dedicated UI flow (buildCombatContext
 * imported ad hoc by useGeneration.ts's generateCombat, composer.ts for
 * Composition mode) — Editor tools (refine, prose-fix) and Director tools
 * (villain-pov) had no path to the same grounding when the passage/scene they
 * were given IS one of these modes. Fails open (empty string) when the mode has
 * no dedicated library or the caller didn't supply the params it needs — callers
 * always fall back to their existing generic behavior.
 */
export function buildModeTechniqueContext(req: ModeTechniqueRequest): string {
  switch (req.mode) {
    case "combat":
      return req.combatStyleA
        ? buildCombatContext(req.combatStyleA, req.combatStyleB || "", req.combatStyleAOwner, req.combatStyleBOwner)
        : "";
    case "emotional":
      return req.emotion ? buildEmotionalContext(req.emotion) : "";
    case "tension":
      return req.tensionType ? buildTensionContext(req.tensionType) : "";
    case "atmosphere":
      return req.atmosphere ? buildAtmosphereContext(req.atmosphere) : "";
    default:
      return "";
  }
}
