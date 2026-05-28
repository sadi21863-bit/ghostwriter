// src/lib/mystery/context.ts
import { MYSTERY_ARCHETYPES } from "./index";
export function buildMysteryContext(archetypeName: string): string {
  const arch = MYSTERY_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`MYSTERY LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nFAIR-PLAY REQUIREMENT: ${arch.fairPlayRequirement}`);
  l.push(`Misdirection mechanic: ${arch.misdirectionMechanic}`);
  l.push(`Information structure: ${arch.informationStructure}`);
  l.push(`\nPLANTING RULES:`);
  arch.plantingRules.forEach(r => l.push(`• ${r}`));
  l.push(`\nREVELATION MECHANICS: ${arch.revelationMechanics}`);
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`— ${f}`));
  return l.join("\n");
}
export function getMysteryArchetypeNames(): string[] { return Object.keys(MYSTERY_ARCHETYPES); }
