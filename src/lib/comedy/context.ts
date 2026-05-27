// src/lib/comedy/context.ts
import { COMEDY_ARCHETYPES } from "./index";

export function buildComedyContext(archetypeName: string): string {
  const arch = COMEDY_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const lines: string[] = [];
  lines.push(`COMEDY LIBRARY — ${arch.name.toUpperCase()}`);
  lines.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  lines.push(`Core: ${arch.coreDescription}`);
  lines.push(`\nSETUP REQUIREMENT: ${arch.setupRequirement}`);
  lines.push(`BENIGN CONDITION: ${arch.benignCondition}`);
  lines.push(`TIMING PRINCIPLE: ${arch.timingPrinciple}`);
  lines.push(`\nMECHANICAL RULES:`);
  arch.mechanicalRules.forEach(r => lines.push(`• ${r}`));
  lines.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => lines.push(`• ${d}`));
  lines.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => lines.push(`→ ${f}`));
  return lines.join("\n");
}

export function getComedyArchetypeNames(): string[] {
  return Object.keys(COMEDY_ARCHETYPES);
}
