// src/lib/atmosphere/context.ts
import { ATMOSPHERE_ARCHETYPES } from "./index";

export function buildAtmosphereContext(environmentName: string): string {
  const env = ATMOSPHERE_ARCHETYPES[environmentName];
  if (!env) return "";

  const lines: string[] = [];
  lines.push("ATMOSPHERE LIBRARY — ACTIVE ENVIRONMENT");
  lines.push(`Environment: ${env.name}`);
  lines.push(`Core: ${env.coreDescription}`);

  lines.push("\nPSYCHOLOGICAL EFFECT (Ulrich SRT + Kaplan ART):");
  lines.push(`Cognitive state: ${env.psychologicalEffect.cognitiveState}`);
  lines.push(`Stress response: ${env.psychologicalEffect.stressResponse}`);
  lines.push(`Attention demand: ${env.psychologicalEffect.attentionalDemand}`);

  lines.push("\nSENSORY LAYERS:");
  lines.push(`Dominant sense: ${env.sensoryLayers.dominant}`);
  lines.push(`Visual: ${env.sensoryLayers.visual}`);
  lines.push(`Auditory: ${env.sensoryLayers.auditory}`);
  lines.push(`Olfactory (PRF memory key): ${env.sensoryLayers.olfactory}`);
  lines.push(`Tactile: ${env.sensoryLayers.tactile}`);
  lines.push(`Proprioceptive: ${env.sensoryLayers.proprioceptive}`);

  lines.push(`\nOlfactory key: ${env.olfactoryKey}`);
  lines.push(`Temporal quality: ${env.temporalQualities}`);

  lines.push("\nFAILURE MODES:");
  env.failureModes.forEach(f => lines.push(`→ ${f}`));

  lines.push("\nSYSTEM DIRECTIVES:");
  env.systemDirectives.forEach(d => lines.push(`• ${d}`));

  return lines.join("\n");
}

export function getAtmosphereNames(): string[] {
  return Object.keys(ATMOSPHERE_ARCHETYPES);
}
