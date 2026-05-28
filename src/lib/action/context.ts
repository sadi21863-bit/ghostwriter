// src/lib/action/context.ts
import { ACTION_ARCHETYPES } from "./index";
export function buildActionContext(archetypeName: string): string {
  const arch = ACTION_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`ACTION LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nOBSTACLE STRUCTURE: ${arch.obstacleStructure}`);
  l.push(`Environment role: ${arch.environmentRole}`);
  l.push(`Consequence cascade: ${arch.consequenceCascade}`);
  l.push(`\nPACE RULES:`);
  arch.paceRules.forEach(r => l.push(`• ${r}`));
  l.push(`\nSENTENCE RHYTHM: ${arch.sentenceRhythm}`);
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE MODES:`);
  arch.failureModes.forEach(f => l.push(`— ${f}`));
  return l.join("\n");
}
export function getActionArchetypeNames(): string[] { return Object.keys(ACTION_ARCHETYPES); }
