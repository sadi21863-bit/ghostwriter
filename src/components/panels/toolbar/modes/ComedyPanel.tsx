"use client";
import { getComedyArchetypeNames } from "@/lib/comedy";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

const COMEDY_DESCRIPTIONS: Record<string, string> = {
  "Situation": "Benign Violation Theory — circumstances gone wrong but never dangerous. Establish the want, then make everything that can go wrong go wrong. Three escalations minimum.",
  "Character": "Superiority Theory — someone wrong about themselves in a consistent, endearing way. The fixed idea must never change. The world refuses to confirm it.",
  "Verbal Wit": "Incongruity Resolution — the punchline word MUST be the last word in the sentence. Setup creates expectation; punchline violates and resolves simultaneously.",
  "Dark Comedy": "Distance makes terrible things benign. Deadpan delivery is the tool — treat the enormous event with the same register as the trivial one.",
  "Physical": "Precise physical detail is everything. The body refusing to cooperate with dignified intentions. Causally connected cascade, character obviously unhurt.",
};

interface Props {
  comedyArchetype: string;
  setComedyArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateComedy: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

export function ComedyPanel({
  comedyArchetype, setComedyArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateComedy, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Archetype selector */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 10, textTransform: "uppercase" }}>
          Comedy Mode — Select an archetype
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
          <select
            style={{ ...sInput, marginBottom: 8 }}
            value={comedyArchetype}
            onChange={e => setComedyArchetype(e.target.value)}
          >
            {getComedyArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ padding: "10px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #d9770640", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
            {COMEDY_DESCRIPTIONS[comedyArchetype] ?? ""}
          </div>
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating comedy scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>
              Select an archetype and describe the scene below
            </div>
        }
      </div>

      {/* Insert / Discard bar */}
      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: "#fffbeb", color: "#d97706" }} onClick={() => {
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
          placeholder="Describe the scene — who wants what, and what is about to go wrong?"
          onKeyDown={e => e.key === "Enter" && !generating && generateComedy(comedyArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#d97706", color: "#fff" }}
          disabled={generating}
          onClick={() => generateComedy(comedyArchetype, prompt)}
        >
          {generating ? "..." : "😂 Generate"}
        </button>
      </div>
    </div>
  );
}
