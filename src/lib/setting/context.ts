// src/lib/setting/context.ts
import { SETTING_ARCHETYPES } from "./index";

export function buildSettingContext(archetypeName: string): string {
  const arch = SETTING_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`WORLD/SETTING LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nSpatial mechanism: ${arch.spatialMechanism}`);
  l.push(`Sensory hierarchy: ${arch.sensoryHierarchy}`);
  l.push(`Character reveal: ${arch.characterReveal}`);
  l.push(`\nWRITING DIRECTIVES:`);
  arch.writingDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`✗ ${f}`));
  return l.join("\n");
}

export function getSettingArchetypeNames(): string[] {
  return Object.keys(SETTING_ARCHETYPES);
}
