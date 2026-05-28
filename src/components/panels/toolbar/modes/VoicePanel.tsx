"use client";
import { getVoiceProfileNames } from "@/lib/voice";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

const VOICE_DESCRIPTIONS: Record<string, string> = {
  "Vocabulary Register": "Labov's code-switching — default register (high/low) + how the voice shifts with authority figures vs. in-group. Under stress: retreats to the most natural register underneath the performed one.",
  "Syntactic Fingerprint": "Periodic (builds to point) vs. cumulative (leads with point) vs. short declarative chain. Under stress: syntax flattens. The end of sentences reveals personality. Consistent enough to identify without dialogue tags.",
  "Personality-Language": "Mairesse Big Five mapping — Neuroticism = more 'I', Agreeableness = 'we' + hedging, Openness = 'perhaps' + abstract words. Unconscious patterns the character doesn't know they're using.",
  "Emotional Degradation": "The specific degradation arc: what is lost first (syntax, register, vocabulary range), what new patterns emerge (repetition, fragments, tense shift), what remains at extreme stress. Four levels: baseline → moderate → high → extreme.",
  "Prosodic Rhythm": "Burst vs. flow vs. metered rhythm. Read aloud to test. Under stress: burst fragments further, flow loses coherence, metered over-meters or breaks entirely. The rhythm must be hearable on the page.",
};

interface Props {
  voiceProfile: string;
  setVoiceProfile: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateVoice: (profileName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

export function VoicePanel({
  voiceProfile, setVoiceProfile,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateVoice, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", marginBottom: 10, textTransform: "uppercase" }}>
          Voice Mode — Select a profile
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Voice Profile</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={voiceProfile}
          onChange={e => setVoiceProfile(e.target.value)}
        >
          {getVoiceProfileNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: "#f0fdfa", borderRadius: 8, border: "1px solid #0f766e40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {VOICE_DESCRIPTIONS[voiceProfile] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating voice passage...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>
              Select a voice profile and describe the scene or dialogue to generate
            </div>
        }
      </div>

      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: "#f0fdfa", color: "#0f766e" }} onClick={() => {
            updateChapter("content", (activeChap?.content || "") + (activeChap?.content ? "\n\n" : "") + streamText);
            setStreamText("");
          }}>Insert into Chapter</button>
        </div>
      )}

      <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface, flexShrink: 0 }}>
        <input
          style={{ ...sInput, flex: 1 }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the scene or dialogue — who is speaking, what is happening, what emotional register are they in?"
          onKeyDown={e => e.key === "Enter" && !generating && generateVoice(voiceProfile, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#0f766e", color: "#fff" }}
          disabled={generating}
          onClick={() => generateVoice(voiceProfile, prompt)}
        >
          {generating ? "..." : "🎭 Generate"}
        </button>
      </div>
    </div>
  );
}
