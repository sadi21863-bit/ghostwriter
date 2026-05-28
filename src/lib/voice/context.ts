// src/lib/voice/context.ts
import { VOICE_PROFILES } from "./index";

export function buildVoiceContext(profileName: string): string {
  const p = VOICE_PROFILES[profileName];
  if (!p) return "";
  const l: string[] = [];
  l.push(`VOICE PROFILE — ${p.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${p.theoreticalBasis}`);
  l.push(`Core: ${p.coreDescription}`);
  l.push(`\nBig Five profile: ${p.bigFiveProfile}`);
  l.push(`Vocabulary range: ${p.vocabularyRange}`);
  l.push(`Syntactic fingerprint: ${p.syntacticFingerprint}`);
  l.push(`Function word pattern: ${p.functionWordPattern}`);
  l.push(`Register behavior: ${p.registerBehavior}`);
  l.push(`Emotional degradation: ${p.emotionalDegradation}`);
  l.push(`\nSPECIMEN LINES:`);
  p.specimenLines.forEach(s => l.push(`• ${s}`));
  l.push(`\nFORBIDDEN PATTERNS:`);
  p.forbiddenPatterns.forEach(f => l.push(`— ${f}`));
  l.push(`\nSYSTEM DIRECTIVES:`);
  p.systemDirectives.forEach(d => l.push(`• ${d}`));
  return l.join("\n");
}

export function getVoiceProfileNames(): string[] { return Object.keys(VOICE_PROFILES); }
