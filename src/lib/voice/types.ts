// src/lib/voice/types.ts
export interface VoiceProfile {
  name: string;
  theoreticalBasis: string;
  coreDescription: string;
  bigFiveProfile: string;
  vocabularyRange: string;
  syntacticFingerprint: string;
  functionWordPattern: string;
  registerBehavior: string;
  emotionalDegradation: string;
  specimenLines: string[];
  forbiddenPatterns: string[];
  systemDirectives: string[];
  writingNotes: string;
}
