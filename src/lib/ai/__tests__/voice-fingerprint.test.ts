import { describe, it, expect } from "vitest";
import { fingerprintToConstraints, type VoiceFingerprint } from "@/lib/ai/voice-fingerprint";

function makeFingerprint(overrides: Partial<VoiceFingerprint> = {}): VoiceFingerprint {
  return {
    avgSentenceLength: 12,
    contractionRate: 0.02,
    firstPersonRate: 2,
    avgWordLength: 4.5,
    shortSentenceRate: 0.2,
    longSentenceRate: 0.1,
    dialogueRatio: 0.2,
    questionRate: 0.05,
    paragraphLengthAvg: 60,
    wordDiversityRatio: 0.5,
    ...overrides,
  };
}

describe("fingerprintToConstraints", () => {
  it("includes the binding numerical constraints", () => {
    const text = fingerprintToConstraints(makeFingerprint());
    expect(text).toContain("BINDING VOICE CONSTRAINTS");
    expect(text).toContain("Average sentence length: 12.0 words");
  });

  it("includes the PREFERENCE/QUERY/APPLY?/WHY calibration example teaching when a constraint may yield", () => {
    const text = fingerprintToConstraints(makeFingerprint());
    expect(text).toContain("CALIBRATION EXAMPLE");
    expect(text).toContain("PREFERENCE:");
    expect(text).toContain("QUERY:");
    expect(text).toContain("APPLY?:");
    expect(text).toContain("WHY:");
  });
});
