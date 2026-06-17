"use client";
import { getHorrorArchetypeNames } from "@/lib/horror";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const HORROR_DESCRIPTIONS: Record<string, string> = {
  "Uncanny": "Freud's Unheimliche — the familiar made wrong. Establish safety first, then violate it by degrees. Three signals minimum. Ordinary prose throughout.",
  "Body Horror": "Haidt's disgust triggers: decay, contamination, bodily violations, category mixing. Specific sensory wrongness > vague menace. Never label the disgust — produce it.",
  "Psychological": "Corruption of the perceiving self. Reader and character cannot determine if the horror is real or internal. Never fully resolve the ambiguity.",
  "Cosmic": "Scale and indifference, not malice. The entity does not notice the character. The human framework for meaning ceases to function. End in the failure of comprehension.",
  "Monster": "Carroll's art-horror: fear + disgust fused. Violates mental categories simultaneously. Partial reveal before the full picture. Leave the reader's curiosity unsatisfied.",
  "Compulsion": "Freud's Thanatos — the body moves toward destruction against conscious will. Awareness makes it worse, not better. The character knows. They cannot stop. It was always going to end here.",
  "Social Horror": "Girard's mimetic desire — the horror is social reality, not physical. The community turns. Mass hysteria is real (Dancing Plague 1518, Salem). The performance of normality collapses.",
  "Existential Horror": "Becker's Terror Management Theory — strip the mortality buffer. Horror that makes death meaningless, not merely certain. The universe offers no response. Ligotti: consciousness is the mistake.",
};

interface Props {
  horrorArchetype: string;
  setHorrorArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateHorror: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function HorrorPanel({
  horrorArchetype, setHorrorArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateHorror, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Archetype selector */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 10, textTransform: "uppercase" }}>
          Horror Mode — Select an archetype
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
          <select
            style={{ ...sInput, marginBottom: 8 }}
            value={horrorArchetype}
            onChange={e => setHorrorArchetype(e.target.value)}
          >
            {getHorrorArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ padding: "10px 12px", background: "#f3f0ff", borderRadius: 8, border: "1px solid #7c3aed40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
            {HORROR_DESCRIPTIONS[horrorArchetype] ?? ""}
          </div>
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating horror scene...</div>
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
          <button style={{ ...sBtn, background: "#f3f0ff", color: "#7c3aed" }} onClick={() => {
            if (insertIntoEditor) { insertIntoEditor(streamText); } else { updateChapter("content", appendToTipTap(activeChap?.content || "", streamText)); }
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
          placeholder="Describe the scene — where are we, who is present, what is beginning to feel wrong?"
          onKeyDown={e => e.key === "Enter" && !generating && generateHorror(horrorArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#7c3aed", color: "#fff" }}
          disabled={generating}
          onClick={() => generateHorror(horrorArchetype, prompt)}
        >
          {generating ? "..." : "👁 Generate"}
        </button>
      </div>
    </div>
  );
}
