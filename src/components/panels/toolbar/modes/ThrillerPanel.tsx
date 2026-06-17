"use client";
import { getThrillerArchetypeNames } from "@/lib/thriller";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const THRILLER_DESCRIPTIONS: Record<string, string> = {
  "Expanding Threat": "Brewer & Lichtenstein expanding variant — each revelation doubles the apparent scope. The expansion arrives mid-scene, not at the end. The protagonist must update their threat model specifically. The full scope must remain unknown.",
  "MacGuffin": "Hitchcock's structural device — urgent and specific, thematically arbitrary. Acquiring it must cost something. The scene is about what the character becomes in pursuit, not about the object itself. The MacGuffin changes hands.",
  "False Resolution": "The satisfaction must be genuine before it is revoked. The gap between resolution and reactivation must be long enough to feel. Reactivation expands the threat — something is worse than before, not merely continued.",
  "Moral Compromise": "The thriller's heart — the protagonist crosses a line established earlier. Tactical necessity must be genuine. The crossing is a specific act, not a feeling. The moral question must remain open at the scene's end.",
  "Twist": "Brewer & Lichtenstein surprise — recontextualizes all previous information. The twist data was available. Include the realization pause. The twist must reframe specific earlier events. Earn it forward and backward simultaneously.",
};

interface Props {
  thrillerArchetype: string;
  setThrillerArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateThriller: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function ThrillerPanel({
  thrillerArchetype, setThrillerArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateThriller, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9f1239", marginBottom: 10, textTransform: "uppercase" }}>
          Thriller Mode — Select an archetype
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={thrillerArchetype}
          onChange={e => setThrillerArchetype(e.target.value)}
        >
          {getThrillerArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: "#fff1f2", borderRadius: 8, border: "1px solid #9f123940", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {THRILLER_DESCRIPTIONS[thrillerArchetype] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating thriller scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>
              Select an archetype and describe the scene — protagonist, threat, what is about to be discovered
            </div>
        }
      </div>

      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: "#fff1f2", color: "#9f1239" }} onClick={() => {
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
          placeholder="Describe the scene — protagonist, what they discover, the current scope of the threat, the moral stakes"
          onKeyDown={e => e.key === "Enter" && !generating && generateThriller(thrillerArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#9f1239", color: "#fff" }}
          disabled={generating}
          onClick={() => generateThriller(thrillerArchetype, prompt)}
        >
          {generating ? "..." : "🔦 Generate"}
        </button>
      </div>
    </div>
  );
}
