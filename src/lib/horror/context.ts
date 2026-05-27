// src/lib/horror/context.ts
import { HORROR_ARCHETYPES } from "./index";

export function buildHorrorContext(archetypeName: string): string {
  const arch = HORROR_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const lines: string[] = [];
  lines.push(`HORROR LIBRARY — ${arch.name.toUpperCase()}`);
  lines.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  lines.push(`Core: ${arch.coreDescription}`);
  lines.push(`\nBASELINE REQUIREMENT: ${arch.baselineRequirement}`);
  lines.push(`Onset mechanics: ${arch.onsetMechanics}`);
  lines.push(`Escalation pattern: ${arch.escalationPattern}`);
  lines.push(`\nPSYCHOLOGICAL MECHANISMS:`);
  arch.psychologicalMechanisms.forEach(m => lines.push(`• ${m}`));
  lines.push(`\nREADER SOMATIC TARGET: ${arch.readerSomaticTarget}`);
  lines.push(`\nSACRED RULES (never violate):`);
  arch.sacredRules.forEach(r => lines.push(`→ ${r}`));
  lines.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => lines.push(`• ${d}`));
  lines.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => lines.push(`→ ${f}`));
  return lines.join("\n");
}

export function getHorrorArchetypeNames(): string[] {
  return Object.keys(HORROR_ARCHETYPES);
}
