// src/lib/romance/context.ts
import { ROMANCE_ARCHETYPES } from "./index";
export function buildRomanceContext(archetypeName: string): string {
  const arch = ROMANCE_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`ROMANCE LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nFISHER STAGE: ${arch.fisherStage} | Neurochemistry: ${arch.neurochemistry}`);
  l.push(`Dopamine mechanic: ${arch.dopamineMechanic}`);
  l.push(`Structural requirement: ${arch.structuralRequirement}`);
  l.push(`\nPHYSICAL SIGNALS:`);
  arch.physicalSignals.forEach(s => l.push(`• ${s}`));
  l.push(`\nFORBIDDEN MOVES:`);
  arch.forbiddenMoves.forEach(f => l.push(`— ${f}`));
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`— ${f}`));
  return l.join("\n");
}
export function getRomanceArchetypeNames(): string[] { return Object.keys(ROMANCE_ARCHETYPES); }
