"use client";
import { getActionArchetypeNames } from "@/lib/action";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

const ACTION_DESCRIPTIONS: Record<string, string> = {
  "Chase": "The gap is the tension. State it explicitly, change it at each obstacle. Three causally connected obstacles. Consequence cascade. Sentences shorten as the gap closes. No internal monologue at pace.",
  "Escape": "Three perimeter layers: outer, inner, exit point — each harder. Alternating rhythm: long sentences when still, short when moving. Every sound registered. Earlier choices narrow the options at the exit point.",
  "Infiltration": "Three escalating tests: routine, unexpected, personal. Social pace, not physical pace. Internal monologue during tests. Physical stress responses suppressed — reader sees both layers simultaneously.",
  "Race": "The competitor's position must be stated regularly. Both competitors' states present. The environment affects each differently. Physical costs accumulate for both. The winner pays something real.",
  "Survival": "Three resource crises, each arising from management of the previous. Track physical state explicitly. Cognitive degradation as resources deplete. Duration must be felt. Each decision costs something permanently.",
};

interface Props {
  actionArchetype: string;
  setActionArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateAction: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

export function ActionPanel({
  actionArchetype, setActionArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateAction, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", marginBottom: 10, textTransform: "uppercase" }}>
          Action Mode — Select an archetype
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
          <select
            style={{ ...sInput, marginBottom: 8 }}
            value={actionArchetype}
            onChange={e => setActionArchetype(e.target.value)}
          >
            {getActionArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ padding: "10px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #b4530940", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
            {ACTION_DESCRIPTIONS[actionArchetype] ?? ""}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating action scene...</div>
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
          <button style={{ ...sBtn, background: "#fffbeb", color: "#b45309" }} onClick={() => {
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
          placeholder="Describe the scene — who, where, what is the goal, what is the obstacle?"
          onKeyDown={e => e.key === "Enter" && !generating && generateAction(actionArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#b45309", color: "#fff" }}
          disabled={generating}
          onClick={() => generateAction(actionArchetype, prompt)}
        >
          {generating ? "..." : "⚡ Generate"}
        </button>
      </div>
    </div>
  );
}
