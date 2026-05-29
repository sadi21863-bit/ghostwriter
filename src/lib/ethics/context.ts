// src/lib/ethics/context.ts
import { ETHICS_ARCHETYPES } from "./index";

export function buildEthicsContext(archetypeName: string): string {
  const arch = ETHICS_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`ETHICS/MORAL COMPLEXITY LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nFoundations in conflict: ${arch.foundationsInConflict}`);
  l.push(`Intuition mechanic: ${arch.intuitionMechanism}`);
  l.push(`Moral remainder potential: ${arch.remainderPotential}`);
  l.push(`\nWRITING DIRECTIVES:`);
  arch.writingDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`✗ ${f}`));
  return l.join("\n");
}

export function getEthicsArchetypeNames(): string[] {
  return Object.keys(ETHICS_ARCHETYPES);
}
