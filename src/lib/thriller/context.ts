// src/lib/thriller/context.ts
import { THRILLER_ARCHETYPES } from "./index";

export function buildThrillerContext(archetypeName: string): string {
  const arch = THRILLER_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`THRILLER LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nExpansion mechanic: ${arch.expansionMechanic}`);
  l.push(`Information strategy: ${arch.informationStrategy}`);
  l.push(`Moral dimension: ${arch.moralDimension}`);
  l.push(`Reveal structure: ${arch.revealStructure}`);
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`— ${f}`));
  return l.join("\n");
}

export function getThrillerArchetypeNames(): string[] { return Object.keys(THRILLER_ARCHETYPES); }
