"use client";
import { getEthicsArchetypeNames } from "@/lib/ethics";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const ETHICS_DESCRIPTIONS: Record<string, string> = {
  "Moral Dumbfounding": "Haidt — the conviction arrives before the argument. When the argument is defeated, the conviction remains. The character who cannot be argued out of their position is not being unreasonable. They are being human.",
  "Foundation Conflict": "Two characters activating different moral foundations — Care vs. Loyalty, Fairness vs. Authority. They are not in a factual dispute. They are experiencing different moral landscapes. Neither can win the argument.",
  "Moral Remainder": "Williams — the right choice still costs something. The remainder is specific: the name, the face, the obligation that was real and could not be fulfilled. It does not resolve within the scene.",
  "Post-Hoc Rationalization": "The intuition arrives first; the reasoning is the lawyer constructing the case afterward. The tell: the argument shifts, the conviction doesn't. The character cannot see what they are doing.",
  "Tragic Choice": "Nussbaum — every available option involves the genuine sacrifice of something genuinely valuable. Not a puzzle to solve. A situation to survive. Eliminate all third options before writing.",
};

interface Props {
  ethicsArchetype: string;
  setEthicsArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateEthics: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function EthicsPanel({
  ethicsArchetype, setEthicsArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateEthics, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#3B0764", marginBottom: 10, textTransform: "uppercase" }}>
          Ethics/Moral Complexity Mode — Select an archetype
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={ethicsArchetype}
          onChange={e => setEthicsArchetype(e.target.value)}
        >
          {getEthicsArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: "#f5f0ff", borderRadius: 8, border: "1px solid #3B076440", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {ETHICS_DESCRIPTIONS[ethicsArchetype] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating ethics scene...</div>
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
          <button style={{ ...sBtn, background: "#f5f0ff", color: "#3B0764" }} onClick={() => {
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
          placeholder="Describe the moral situation — who faces it, what is at stake, what the two options are"
          onKeyDown={e => e.key === "Enter" && !generating && generateEthics(ethicsArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#3B0764", color: "#fff" }}
          disabled={generating}
          onClick={() => generateEthics(ethicsArchetype, prompt)}
        >
          {generating ? "..." : "⚖️ Generate"}
        </button>
      </div>
    </div>
  );
}
