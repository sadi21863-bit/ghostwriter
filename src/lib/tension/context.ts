// src/lib/tension/context.ts
import { TENSION_ARCHETYPES } from "./index";

export function buildTensionContext(tensionName: string): string {
  const tension = TENSION_ARCHETYPES[tensionName];
  if (!tension) return "";

  const lines: string[] = [];
  lines.push("TENSION LIBRARY — ACTIVE TYPE");
  lines.push(`Type: ${tension.name}`);
  lines.push(`Theoretical basis: ${tension.theoreticalBasis}`);
  lines.push(`Core: ${tension.coreDescription}`);

  lines.push(`\nDiscourse structure (Brewer & Lichtenstein): ${tension.discourseStructure}`);

  lines.push("\nINFORMATION STATE:");
  lines.push(`Reader knows: ${tension.informationState.readerKnows}`);
  lines.push(`Character knows: ${tension.informationState.characterKnows}`);
  lines.push(`The gap: ${tension.informationState.gap}`);

  lines.push(`\nBuild mechanics: ${tension.buildMechanics}`);
  lines.push(`Sustain mechanics: ${tension.sustainMechanics}`);
  lines.push(`Release or withhold: ${tension.releaseOrWithhold}`);
  lines.push(`Pacing rules: ${tension.pacingRules}`);

  lines.push("\nTENSION KILLERS (avoid):");
  tension.tensionKillers.forEach(k => lines.push(`✗ ${k}`));

  lines.push("\nSYSTEM DIRECTIVES:");
  tension.systemDirectives.forEach(d => lines.push(`• ${d}`));

  lines.push("\nFAILURE MODES:");
  tension.failureModes.forEach(f => lines.push(`→ ${f}`));

  return lines.join("\n");
}

export function getTensionTypeNames(): string[] {
  return Object.keys(TENSION_ARCHETYPES);
}
