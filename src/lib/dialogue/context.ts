import { DIALOGUE_ARCHETYPES } from "./_registry";
import type { Character } from "@/types";

export function buildDialogueContext(
  charA: Character | undefined,
  charB: Character | undefined,
  archetypeName: string,
  participants?: Character[]
): string {
  const archetype = DIALOGUE_ARCHETYPES[archetypeName] ?? DIALOGUE_ARCHETYPES["Argument"];
  const blocks: string[] = [];
  blocks.push("DIALOGUE LIBRARY — ACTIVE ARCHETYPE");
  blocks.push(`Scene type: ${archetype.name}`);
  blocks.push(`Core conflict: ${archetype.underlyingConflict}`);
  blocks.push(`Power dynamic: ${archetype.powerDynamic}`);
  blocks.push(`Structure: ${archetype.sceneStructure}`);
  blocks.push(`Escalation: ${archetype.escalationMechanics}`);
  blocks.push(`Breaking point: ${archetype.breakingPoint}`);
  blocks.push(`Opening principle: ${archetype.openingPrinciple}`);
  blocks.push(`Rhythm: ${archetype.rhythmPattern}`);
  blocks.push("SUBTEXT RULES (enforce every line):");
  archetype.subtextRules.forEach(r => blocks.push(`• ${r}`));
  blocks.push("SYSTEM DIRECTIVES (non-negotiable):");
  archetype.systemDirectives.forEach(d => blocks.push(`• ${d}`));
  blocks.push("FAILURE MODES (never do these):");
  archetype.failureModes.forEach(f => blocks.push(`✗ ${f}`));
  if (charA || charB) blocks.push("CHARACTERS IN THIS SCENE:");
  if (charA) blocks.push(formatCharacterForDialogue(charA, "A"));
  if (charB) blocks.push(formatCharacterForDialogue(charB, "B"));
  if (participants && participants.length > 2) {
    blocks.push(`GROUP: ${participants.length} characters total.`);
    participants.forEach((c, i) => blocks.push(formatCharacterForDialogue(c, String(i + 1))));
  }
  return blocks.join("\n");
}

function formatCharacterForDialogue(c: Character, label: string): string {
  const lines: string[] = [`Character ${label}: ${c.name}${c.role ? ` (${c.role})` : ""}`];
  if (c.personality)   lines.push(`  Personality: ${c.personality}`);
  if (c.speechPattern) lines.push(`  Speech pattern: ${c.speechPattern}`);
  if (c.fears)         lines.push(`  Fears: ${c.fears}`);
  if (c.desires)       lines.push(`  Desires: ${c.desires}`);
  if (c.backstory)     lines.push(`  Backstory: ${c.backstory}`);
  lines.push(`  Voice rule: ${c.name}'s lines must be immediately distinguishable from other characters.`);
  return lines.join("\n");
}

export function getDialogueArchetypeNames(): string[] {
  return Object.keys(DIALOGUE_ARCHETYPES);
}
