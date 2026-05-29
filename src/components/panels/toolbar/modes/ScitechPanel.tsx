"use client";
import { getScitechArchetypeNames } from "@/lib/scitech";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

const SCITECH_DESCRIPTIONS: Record<string, string> = {
  "Normal Science": "Kuhn — puzzle-solving inside an invisible paradigm. What the scientist is not asking is as important as what they are asking. The intellectual beauty of precision within bounded assumptions.",
  "Anomaly Accumulation": "The data that doesn't fit — dismissed correctly within the paradigm. The reader sees what the character cannot. The tragedy of specifically correct incomprehension.",
  "Paradigm Shift": "The gestalt switch — the world reorganizing, not a logical conclusion being reached. Incommensurability: they use the same words but mean different things. Resistance is internally coherent.",
  "Feynman Integrity": "'You must not fool yourself — and you are the easiest person to fool.' The self-deception is unconscious. The cost is real: something must be given up.",
  "Technology as Character": "McLuhan — the tool shapes its user. The technology's specific logic, specific failure modes, specific demands. The character who thinks like their instrument.",
};

interface Props {
  scitechArchetype: string;
  setScitechArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateScitech: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

export function ScitechPanel({
  scitechArchetype, setScitechArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateScitech, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1E3A5F", marginBottom: 10, textTransform: "uppercase" }}>
          Science/Technology Mode — Select an archetype
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={scitechArchetype}
          onChange={e => setScitechArchetype(e.target.value)}
        >
          {getScitechArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: "#e8eef5", borderRadius: 8, border: "1px solid #1E3A5F40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {SCITECH_DESCRIPTIONS[scitechArchetype] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating science/technology scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>
              Select an archetype and describe the scene below
            </div>
        }
      </div>

      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: "#e8eef5", color: "#1E3A5F" }} onClick={() => {
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
          placeholder="Describe the scientific or technical situation — who, what paradigm, what is being observed"
          onKeyDown={e => e.key === "Enter" && !generating && generateScitech(scitechArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#1E3A5F", color: "#fff" }}
          disabled={generating}
          onClick={() => generateScitech(scitechArchetype, prompt)}
        >
          {generating ? "..." : "🔬 Generate"}
        </button>
      </div>
    </div>
  );
}
