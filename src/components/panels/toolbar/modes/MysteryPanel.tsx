"use client";
import { getMysteryArchetypeNames } from "@/lib/mystery";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const MYSTERY_DESCRIPTIONS: Record<string, string> = {
  "Clue Planting": "Knox's fair-play contract — the clue lives in the sentence that reads as atmosphere. Surround it with equally specific irrelevancies. Never follow a clue with a POV reaction that flags its importance.",
  "Red Herring": "Macknik's overt misdirection — the false suspect must be more interesting than the real culprit. The reader follows because the herring is the better story. Until it isn't.",
  "Alibi Construction": "Loftus's reconstructive memory — the alibi is almost perfect, one specific flaw. The witness believes they're telling the truth. The flaw must be calculable from information already in the scene.",
  "Revelation Scene": "Brewer & Lichtenstein curiosity resolution — begin with the conclusion, then demonstrate the evidence chain. Every planted clue accounted for. Every red herring explained. No new facts.",
  "Misdirection": "Macknik's two-layer structure — apparently significant (actually irrelevant) and apparently irrelevant (actually the key). Both layers present. The re-readable sentence must be in the scene.",
};

interface Props {
  mysteryArchetype: string;
  setMysteryArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateMystery: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function MysteryPanel({
  mysteryArchetype, setMysteryArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateMystery, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", marginBottom: 10, textTransform: "uppercase" }}>
          Mystery Mode — Select an archetype
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
          <select
            style={{ ...sInput, marginBottom: 8 }}
            value={mysteryArchetype}
            onChange={e => setMysteryArchetype(e.target.value)}
          >
            {getMysteryArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ padding: "10px 12px", background: "#eff6ff", borderRadius: 8, border: "1px solid #1e40af40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
            {MYSTERY_DESCRIPTIONS[mysteryArchetype] ?? ""}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating mystery scene...</div>
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
          <button style={{ ...sBtn, background: "#eff6ff", color: "#1e40af" }} onClick={() => {
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
          placeholder="Describe the scene — setting, who is present, what is being investigated or concealed?"
          onKeyDown={e => e.key === "Enter" && !generating && generateMystery(mysteryArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#1e40af", color: "#fff" }}
          disabled={generating}
          onClick={() => generateMystery(mysteryArchetype, prompt)}
        >
          {generating ? "..." : "🔍 Generate"}
        </button>
      </div>
    </div>
  );
}
