"use client";
import { getEmotionNames } from "@/lib/emotional";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

interface Props {
  emotionalEmotion: string;
  setEmotionalEmotion: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateEmotionalScene: (emotionName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

const EMOTION_DESCRIPTIONS: Record<string, string> = {
  "Grief": "Body-first signal of attachment loss. Wave pattern: numbness → flooding → recession. Physicalizes through AU1 brow raise, hollow chest, disrupted motor memory.",
  "Rage": "Sympathetic system at maximum mobilization. Hot wave upward, tunnel vision at peak, jaw + hands are the tell. Controlled rage is quieter and more dangerous.",
  "Fear": "Amygdala fires 200ms before conscious awareness. Body moves first. Cold extremities, stomach drop, possible freeze. Lingers 20-60 min after safety.",
  "Shame": "Involuntary flush that cannot be suppressed. Gaze drops without decision. Body tries to become smaller. Third-person memory quality.",
  "Joy / Elation": "Duchenne vs performed: AU6 cheek crinkle cannot be faked. Body expands, takes up more space. High elation produces coordination failures.",
  "Intimacy / Tenderness": "Ventral vagal: brow releases default defense tension. Synchronized breathing. Slightly closer than social distance. Peripheral awareness disappears.",
  "Despair": "Dorsal vagal shutdown. Flat affect, not sadness. All movement requires a deliberate decision. Performed normalcy with nothing underneath.",
};

export function EmotionalPanel({
  emotionalEmotion, setEmotionalEmotion,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateEmotionalScene, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Emotion selector */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Emotional Scene Mode — Select an emotion</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Emotion</div>
            <select style={{ ...sInput, marginBottom: 8 }} value={emotionalEmotion} onChange={e => setEmotionalEmotion(e.target.value)}>
              {getEmotionNames().map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <div style={{ padding: "10px 12px", background: co.accentBg, borderRadius: 8, border: "1px solid " + co.accent + "40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
              {EMOTION_DESCRIPTIONS[emotionalEmotion] ?? ""}
            </div>
          </div>
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating emotional scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>Select an emotion and describe the scene below</div>}
      </div>

      {/* Insert / Discard bar */}
      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={sBtn} onClick={() => {
            updateChapter("content", (activeChap?.content || "") + (activeChap?.content ? "\n\n" : "") + streamText);
            setStreamText("");
          }}>Insert into Chapter</button>
        </div>
      )}

      {/* Prompt bar */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface, flexShrink: 0 }}>
        <input
          style={{ ...sInput, flex: 1 }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the scene — who is feeling this and what is happening?"
          onKeyDown={e => e.key === "Enter" && !generating && generateEmotionalScene(emotionalEmotion, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1 }}
          disabled={generating}
          onClick={() => generateEmotionalScene(emotionalEmotion, prompt)}
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
