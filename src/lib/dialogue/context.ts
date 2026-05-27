// src/lib/dialogue/context.ts — UPGRADED
// Now injects the full psychological layer alongside structural rules.
import { DIALOGUE_ARCHETYPES } from "./_registry";
import type { Character } from "@/types";

export function buildDialogueContext(
  charA: Character | undefined,
  charB: Character | undefined,
  archetypeName: string,
  participants?: Character[]
): string {
  const archetype = DIALOGUE_ARCHETYPES[archetypeName] ?? DIALOGUE_ARCHETYPES["Argument"];
  const lines: string[] = [];

  lines.push("DIALOGUE LIBRARY — ACTIVE ARCHETYPE");
  lines.push(`Scene type: ${archetype.name}`);
  lines.push(`Core conflict: ${archetype.underlyingConflict}`);
  lines.push(`Power dynamic: ${archetype.powerDynamic}`);
  lines.push(`Structure: ${archetype.sceneStructure}`);
  lines.push(`Escalation: ${archetype.escalationMechanics}`);
  lines.push(`Breaking point: ${archetype.breakingPoint}`);
  lines.push(`Opening: ${archetype.openingPrinciple}`);
  lines.push(`Rhythm: ${archetype.rhythmPattern}`);

  lines.push("\nSUBTEXT RULES:");
  archetype.subtextRules.forEach(r => lines.push(`• ${r}`));

  // Psychological layer
  const p = archetype.psychological;
  lines.push("\nPSYCHOLOGICAL LAYER (PVT + FACS + Damasio SMH + Brewer & Lichtenstein SAT):");
  lines.push(`Party A nervous system: ${p.partyAState.replace("_", " ")} | Party B: ${p.partyBState.replace("_", " ")}`);
  lines.push(`State shift: ${p.stateShift}`);

  lines.push("\nVOICE PHYSIOLOGY (Porges — vagal control of larynx + prosody):");
  lines.push(`Party A voice — pitch: ${p.partyAVoice.pitch} | rate: ${p.partyAVoice.rate} | breath: ${p.partyAVoice.breathSupport}`);
  lines.push(`Party B voice — pitch: ${p.partyBVoice.pitch} | rate: ${p.partyBVoice.rate} | breath: ${p.partyBVoice.breathSupport}`);

  lines.push("\nFACS SIGNALS ACTIVE:");
  p.activeFacsSignals.forEach(s => lines.push(`• ${s}`));

  lines.push(`\nSOMATIC PRESENCE: ${p.somaticPresence}`);

  lines.push("\nINFORMATION DYNAMICS (Brewer & Lichtenstein SAT):");
  lines.push(`Structure: ${p.informationDynamics.structure}`);
  lines.push(`Reader knows: ${p.informationDynamics.readerKnows}`);
  lines.push(`Character knows: ${p.informationDynamics.characterKnows}`);
  lines.push(`The gap: ${p.informationDynamics.gap}`);

  lines.push("\nPSYCHOLOGICAL DIRECTIVES:");
  p.psychologicalDirectives.forEach(d => lines.push(`• ${d}`));

  lines.push("\nSYSTEM DIRECTIVES:");
  archetype.systemDirectives.forEach(d => lines.push(`• ${d}`));

  lines.push("\nFAILURE MODES:");
  archetype.failureModes.forEach(f => lines.push(`✗ ${f}`));

  // Character profiles
  if (charA || charB) lines.push("\nCHARACTERS IN THIS SCENE:");
  if (charA) lines.push(formatCharForDialogue(charA, "A"));
  if (charB) lines.push(formatCharForDialogue(charB, "B"));

  if (participants && participants.length > 2) {
    lines.push(`\nGROUP: ${participants.length} characters total.`);
    participants.forEach((c, i) => lines.push(formatCharForDialogue(c, String(i + 1))));
    lines.push("Group rules: alliances shift. At least one character is silenced or interrupted. At least one exchange directed at a third party.");
  }

  return lines.join("\n");
}

function formatCharForDialogue(c: Character, label: string): string {
  const l: string[] = [`Character ${label}: ${c.name}${c.role ? ` (${c.role})` : ""}`];
  if (c.personality)   l.push(`  Personality: ${c.personality}`);
  if (c.speechPattern) l.push(`  Speech pattern: ${c.speechPattern}`);
  if (c.fears)         l.push(`  Fears: ${c.fears}`);
  if (c.desires)       l.push(`  Desires: ${c.desires}`);
  if (c.backstory)     l.push(`  Backstory: ${c.backstory}`);
  l.push(`  Voice rule: ${c.name}'s lines must be immediately distinguishable. No generic phrasing either character could say.`);
  return l.join("\n");
}

export function getDialogueArchetypeNames(): string[] {
  return Object.keys(DIALOGUE_ARCHETYPES);
}
