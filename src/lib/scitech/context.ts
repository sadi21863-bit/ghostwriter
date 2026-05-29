// src/lib/scitech/context.ts
import { SCITECH_ARCHETYPES } from "./index";

export function buildScitechContext(archetypeName: string): string {
  const arch = SCITECH_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`SCIENCE/TECHNOLOGY LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nParadigm position: ${arch.paradigmPosition}`);
  l.push(`Epistemic state: ${arch.epistemicState}`);
  l.push(`Dramatic engine: ${arch.dramaticEngine}`);
  l.push(`\nWRITING DIRECTIVES:`);
  arch.writingDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`✗ ${f}`));
  return l.join("\n");
}

export function getScitechArchetypeNames(): string[] {
  return Object.keys(SCITECH_ARCHETYPES);
}
