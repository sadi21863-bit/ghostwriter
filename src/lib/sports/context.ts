// src/lib/sports/context.ts
import { SPORTS_ARCHETYPES } from "./index";

export function buildSportsContext(archetypeName: string): string {
  const arch = SPORTS_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`SPORTS LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nPsychological state: ${arch.psychologicalState}`);
  l.push(`Body mechanics: ${arch.bodyMechanics}`);
  l.push(`Performance structure: ${arch.performanceStructure}`);
  if (arch.teamDimension) l.push(`Team dimension: ${arch.teamDimension}`);
  l.push(`Stakes requirement: ${arch.stakesRequirement}`);
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`— ${f}`));
  return l.join("\n");
}

export function getSportsArchetypeNames(): string[] { return Object.keys(SPORTS_ARCHETYPES); }
