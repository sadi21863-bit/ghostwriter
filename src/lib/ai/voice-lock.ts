// "Lock Voice" lever — surfaces the voice-fingerprint state as a first-class,
// user-visible signal. The fingerprint (10 stylometric markers) is already
// extracted from recent chapters and injected as binding constraints on every
// generation; this just tells the writer whether their voice is locked in yet,
// turning a silent background feature into a visible Write/Polish lever.
import { extractVoiceFingerprint, type VoiceFingerprint } from "./voice-fingerprint";

export interface VoiceLockStatus {
  /** True once there's enough prose to fingerprint (and thus to "lock"). */
  ready: boolean;
  /** Chapters with enough text to contribute to the fingerprint. */
  qualifyingChapters: number;
  fingerprint: VoiceFingerprint | null;
  /** Short chip label. */
  label: string;
  /** Tooltip / one-line explanation. */
  detail: string;
}

export function voiceLockStatus(chapters: string[]): VoiceLockStatus {
  const list = chapters ?? [];
  const qualifyingChapters = list.filter(c => c && c.trim().length > 100).length;
  const fingerprint = extractVoiceFingerprint(list);
  if (fingerprint) {
    return {
      ready: true,
      qualifyingChapters,
      fingerprint,
      label: "🔒 Voice locked",
      detail: `Your voice is fingerprinted from ${qualifyingChapters} chapter${qualifyingChapters === 1 ? "" : "s"} and applied as a binding constraint on every generation.`,
    };
  }
  return {
    ready: false,
    qualifyingChapters,
    fingerprint: null,
    label: "Voice: warming up",
    detail: "Keep writing — your voice locks automatically once there's enough prose to fingerprint.",
  };
}
