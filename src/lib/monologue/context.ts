// src/lib/monologue/context.ts
import { MONOLOGUE_ARCHETYPES } from "./index";

export function buildMonologueContext(archetypeName: string): string {
  const arch = MONOLOGUE_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`MONOLOGUE LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nCompression level: ${arch.compressionLevel}`);
  l.push(`Associative pattern: ${arch.associativePattern}`);
  if (arch.suppressionBehavior) l.push(`Suppression behavior: ${arch.suppressionBehavior}`);
  l.push(`\nSYNTAX RULES:`);
  arch.syntaxRules.forEach(r => l.push(`• ${r}`));
  l.push(`\nSensory intrusion: ${arch.sensoryIntrusion}`);
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`— ${f}`));
  return l.join("\n");
}

export function getMonologueArchetypeNames(): string[] { return Object.keys(MONOLOGUE_ARCHETYPES); }
