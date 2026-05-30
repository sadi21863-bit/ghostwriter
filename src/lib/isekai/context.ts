import {
  CLASSIC_ISEKAI, VILLAINESS_ISEKAI, SLOW_LIFE_ISEKAI,
  DARK_ISEKAI, KINGDOM_BUILDING_ISEKAI,
} from "./archetypes/all-isekai";
import type { IsekaiArchetype } from "./types";

const ISEKAI_ARCHETYPES: Record<string, IsekaiArchetype> = {
  "Classic Isekai":    CLASSIC_ISEKAI,
  "Villainess/Otome":  VILLAINESS_ISEKAI,
  "Slow Life":         SLOW_LIFE_ISEKAI,
  "Dark Isekai":       DARK_ISEKAI,
  "Kingdom Building":  KINGDOM_BUILDING_ISEKAI,
};

export function buildIsekaiContext(archetypeName: string): string {
  const arch = ISEKAI_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`ISEKAI/${arch.subgenre.toUpperCase()} — ${arch.name}`);
  l.push(`Core reader promise: ${arch.corePromise}`);
  l.push(`\nNON-NEGOTIABLES (must be present):`);
  arch.nonNegotiables.forEach(n => l.push(`• ${n}`));
  l.push(`\nFRESH ANGLES (what's working 2025-2026):`);
  arch.freshAngles.forEach(f => l.push(`• ${f}`));
  l.push(`\nSYSTEM MECHANICS: ${arch.systemMechanics}`);
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nOVERSATURATED (offer to subvert):`);
  arch.oversaturatedTropes.forEach(t => l.push(`⚠ ${t}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`✗ ${f}`));
  return l.join("\n");
}

export function getIsekaiArchetypeNames(): string[] {
  return Object.keys(ISEKAI_ARCHETYPES);
}
