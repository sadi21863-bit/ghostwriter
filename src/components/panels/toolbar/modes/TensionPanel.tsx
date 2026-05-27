"use client";
import { getTensionTypeNames } from "@/lib/tension";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

interface Props {
  tensionType: string;
  setTensionType: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateTension: (tensionType: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

const TENSION_DESCRIPTIONS: Record<string, string> = {
  "Suspense": "Reader ahead of character. Show the bomb, then show a conversation about nothing. Sentence length = pacing. Works even when reader knows the ending.",
  "Curiosity": "Present outcome before cause. Reader works backward. Begin with the body / the ruin / the end state. Each answer generates a more specific question.",
  "Dread": "No named threat. Accumulate ambiguous anomalies — each with a plausible innocent explanation. Ordinary prose throughout. Never announce the frightening part.",
  "Paranoia": "Character's threat-detection may be miscalibrated. Every piece of evidence has an innocent reading. Maintain both interpretations until the last moment.",
  "Countdown": "Explicit deadline + real consequence. Time markers at regular intervals. Shorten sentences as clock runs down. Resolution must arrive within the last margin.",
};

export function TensionPanel({
  tensionType, setTensionType,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateTension, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Tension type selector */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Tension Mode — Select a tension structure</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Tension Type (Brewer &amp; Lichtenstein 1982)</div>
            <select style={{ ...sInput, marginBottom: 8 }} value={tensionType} onChange={e => setTensionType(e.target.value)}>
              {getTensionTypeNames().map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ padding: "10px 12px", background: co.accentBg, borderRadius: 8, border: "1px solid " + co.accent + "40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
              {TENSION_DESCRIPTIONS[tensionType] ?? ""}
            </div>
          </div>
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating tension scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>Select a tension type and describe the scene below</div>}
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
          placeholder="Describe the scene — characters, situation, what's at stake?"
          onKeyDown={e => e.key === "Enter" && !generating && generateTension(tensionType, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1 }}
          disabled={generating}
          onClick={() => generateTension(tensionType, prompt)}
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
