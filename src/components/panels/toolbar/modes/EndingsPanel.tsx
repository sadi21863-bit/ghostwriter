"use client";
import { getEndingsArchetypeNames } from "@/lib/endings";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const ENDINGS_DESCRIPTIONS: Record<string, string> = {
  "Resolution": "Kermode's tick-tock: the ending that makes the beginning mean something. Every earlier sacrifice now reads as necessary. Must carry permanent, irreversible cost — costless resolution is wish fulfillment.",
  "Defeat": "Aristotle's hamartia: not bad luck but the inevitable result of who the protagonist is. Must be clarifying, not merely sad. The reader should understand exactly why.",
  "Pyrrhic": "Pyrrhus of Epirus: the goal achieved at a cost greater than the goal was worth. Neither cancels the other. Do not adjudicate — let the reader determine whether it was worth it.",
  "Sacrifice": "The voluntary surrender of the goal for something the protagonist values more. Proves character: not what they say they value, but what they will not trade.",
  "Ambiguous": "Closes thematically while remaining open mechanically. The plot question is withheld — not because the writer didn't know, but because not knowing is the correct experience of this material.",
};

interface Props {
  endingsArchetype: string;
  setEndingsArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateEndings: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function EndingsPanel({
  endingsArchetype, setEndingsArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateEndings, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#292524", marginBottom: 10, textTransform: "uppercase" }}>
          🎭 Endings — Select an archetype
        </div>
        <div>
          <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Ending type</div>
          <select
            style={{ ...sInput, marginBottom: 8 }}
            value={endingsArchetype}
            onChange={e => setEndingsArchetype(e.target.value)}
          >
            {getEndingsArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ padding: "10px 12px", background: "#f5f5f4", borderRadius: 8, border: "1px solid #1c191740", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
            {ENDINGS_DESCRIPTIONS[endingsArchetype] ?? ""}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating ending scene...</div>
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
          <button style={{ ...sBtn, background: "#f5f5f4", color: "#1c1917" }} onClick={() => {
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
          placeholder="Describe the ending scene — what has been paid, what has been achieved, what remains?"
          onKeyDown={e => e.key === "Enter" && !generating && generateEndings(endingsArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#1c1917", color: "#fff" }}
          disabled={generating}
          onClick={() => generateEndings(endingsArchetype, prompt)}
        >
          {generating ? "..." : "🎭 Generate"}
        </button>
      </div>
    </div>
  );
}
