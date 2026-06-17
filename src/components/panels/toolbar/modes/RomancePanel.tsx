"use client";
import { getRomanceArchetypeNames } from "@/lib/romance";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const ROMANCE_DESCRIPTIONS: Record<string, string> = {
  "First Recognition": "Fisher Stage 2 begins — dopamine/norepinephrine spike. The character notices before they decide to notice. One specific non-generic detail registers. Disrupted automatic behavior. End in unsettled ambiguity, not certainty.",
  "Slow Burn": "Dopamine uncertainty principle — one approach, one frustrated retreat per scene. Neither character names what is happening. The reader is ahead of both of them. Protect the uncertainty.",
  "Dark Moment": "Eisenberger social pain = physical pain — the offending character's own action breaks the relationship. Write loss as a body event. The hollow chest, the cold. The grovel requirement: demonstrated change, not explanation.",
  "Reconciliation": "Stage 3 transition — oxytocin/vasopressin. The grovel is an act, not an apology. Write the released tension, the warmth at the sternum, the full breath. Different from Stage 2's electricity.",
  "Declaration": "Stage 2 to Stage 3 — write the specific words. That character's voice, not generic romantic language. The vulnerability must be present. The response must be equally specific.",
};

interface Props {
  romanceArchetype: string;
  setRomanceArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateRomance: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function RomancePanel({
  romanceArchetype, setRomanceArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateRomance, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#be185d", marginBottom: 10, textTransform: "uppercase" }}>
          Romance Mode — Select an archetype
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
          <select
            style={{ ...sInput, marginBottom: 8 }}
            value={romanceArchetype}
            onChange={e => setRomanceArchetype(e.target.value)}
          >
            {getRomanceArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ padding: "10px 12px", background: "#fdf2f8", borderRadius: 8, border: "1px solid #be185d40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
            {ROMANCE_DESCRIPTIONS[romanceArchetype] ?? ""}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating romance scene...</div>
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
          <button style={{ ...sBtn, background: "#fdf2f8", color: "#be185d" }} onClick={() => {
            if (insertIntoEditor) { insertIntoEditor(streamText); } else { updateChapter("content", appendToTipTap(activeChap?.content || "", streamText)); }
            setStreamText("");
          }}>Insert into Chapter</button>
        </div>
      )}

      <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface, flexShrink: 0 }}>
        <input
          style={{ ...sInput, flex: 1 }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the scene — who is present, what Fisher stage are we in, what is the obstacle?"
          onKeyDown={e => e.key === "Enter" && !generating && generateRomance(romanceArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#be185d", color: "#fff" }}
          disabled={generating}
          onClick={() => generateRomance(romanceArchetype, prompt)}
        >
          {generating ? "..." : "💗 Generate"}
        </button>
      </div>
    </div>
  );
}
