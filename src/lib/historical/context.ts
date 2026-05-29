// src/lib/historical/context.ts
import { HISTORICAL_ARCHETYPES } from "./index";

export function buildHistoricalContext(archetypeName: string): string {
  const arch = HISTORICAL_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`HISTORICAL/CULTURAL TEXTURE LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nTemporal layer: ${arch.temporalLayer}`);
  l.push(`Grounding mechanic: ${arch.groundingMechanic}`);
  l.push(`Detail strategy: ${arch.detailStrategy}`);
  l.push(`\nWRITING DIRECTIVES:`);
  arch.writingDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`✗ ${f}`));
  return l.join("\n");
}

export function getHistoricalArchetypeNames(): string[] {
  return Object.keys(HISTORICAL_ARCHETYPES);
}
