import { describe, it, expect } from "vitest";
import { voiceLockStatus } from "../voice-lock";

// Enough varied prose to clear extractVoiceFingerprint's thresholds (>500 chars,
// >=10 sentences).
const richChapter = Array.from({ length: 14 }, (_, i) =>
  `The harbor was quiet that morning, and Mara wondered whether she'd made the right call. "We can't stay," she said. Kessler only nodded. The tide pulled at the boats. Sentence number ${i} drifts on.`
).join(" ");

describe("voiceLockStatus", () => {
  it("reports locked once there's enough prose to fingerprint", () => {
    const s = voiceLockStatus([richChapter]);
    expect(s.ready).toBe(true);
    expect(s.fingerprint).not.toBeNull();
    expect(s.qualifyingChapters).toBe(1);
    expect(s.label).toContain("locked");
  });

  it("reports warming up when there isn't enough material yet", () => {
    const s = voiceLockStatus(["Too short."]);
    expect(s.ready).toBe(false);
    expect(s.fingerprint).toBeNull();
    expect(s.label).toContain("warming up");
  });

  it("handles empty/missing chapter input without throwing", () => {
    expect(voiceLockStatus([]).ready).toBe(false);
    expect(voiceLockStatus(undefined as any).ready).toBe(false);
  });

  it("counts only chapters with enough text as qualifying", () => {
    const s = voiceLockStatus([richChapter, "tiny", "   "]);
    expect(s.qualifyingChapters).toBe(1);
  });
});
