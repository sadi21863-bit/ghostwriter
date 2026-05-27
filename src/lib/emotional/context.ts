// src/lib/emotional/context.ts
import { EMOTIONAL_ARCHETYPES } from "./index";

export function buildEmotionalContext(emotionName: string): string {
  const emotion = EMOTIONAL_ARCHETYPES[emotionName];
  if (!emotion) return "";

  const lines: string[] = [];
  lines.push("EMOTIONAL SCENE LIBRARY — ACTIVE EMOTION");
  lines.push(`Emotion: ${emotion.name} | Polyvagal state: ${emotion.polyvagalState.replace("_", " ")}`);
  lines.push(`Core: ${emotion.coreDescription}`);

  lines.push("\nFACS SIGNATURE (Ekman Facial Action Coding System):");
  lines.push(`Primary AUs: ${emotion.facs.primaryAUs.join("; ")}`);
  lines.push(`Suppressed display: ${emotion.facs.suppressedDisplay}`);

  lines.push("\nSOMAIC SIGNATURE (Damasio — body-first signal):");
  lines.push(`Heart rate: ${emotion.somatic.heartRate}`);
  lines.push(`Breathing: ${emotion.somatic.breathing}`);
  lines.push(`Muscle state: ${emotion.somatic.muscleState}`);
  lines.push(`Skin response: ${emotion.somatic.skinResponse}`);
  lines.push(`Digestive: ${emotion.somatic.digestive}`);
  lines.push(`Motor control: ${emotion.somatic.motorControl}`);

  lines.push(`\nOnset: ${emotion.onset}`);
  lines.push(`Peak: ${emotion.peak}`);
  lines.push(`Recession: ${emotion.recession}`);

  lines.push("\nHOW THIS READS IN OTHERS:");
  emotion.externalReads.forEach(r => lines.push(`• ${r}`));

  lines.push("\nSHOW DON'T NAME RULES (non-negotiable):");
  emotion.showDontNameRules.forEach(r => lines.push(`• ${r}`));

  lines.push("\nFAILURE MODES (never do these):");
  emotion.failureModes.forEach(f => lines.push(`→ ${f}`));

  lines.push("\nSYSTEM DIRECTIVES:");
  emotion.systemDirectives.forEach(d => lines.push(`• ${d}`));

  return lines.join("\n");
}

export function getEmotionNames(): string[] {
  return Object.keys(EMOTIONAL_ARCHETYPES);
}
