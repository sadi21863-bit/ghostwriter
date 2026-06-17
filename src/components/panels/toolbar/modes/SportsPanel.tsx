"use client";
import { getSportsArchetypeNames } from "@/lib/sports";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const SPORTS_DESCRIPTIONS: Record<string, string> = {
  "Flow State": "Csikszentmihalyi's absorption — action and awareness merged, self-monitoring absent, time distorted. Write from inside the movement, not observing it. The self that watches is not present. Flow breaks with a specific trigger.",
  "Pressure Performance": "Beilock's choking — explicit monitoring breaks automaticity. The character knows exactly what they should be doing. That knowledge is the problem. The spiral: each noticed mistake generates more self-monitoring. Resolve through disengagement, not willpower.",
  "Team Dynamics": "Hackman's shared mental model — communication minimal, prediction maximal. Show backup behavior: a teammate covers for another without being asked. The breakdown scene (failure of coordination) is often more narratively rich than the coordination scene.",
  "The Comeback": "Three structural requirements: a genuine all-is-lost moment, a resource the audience didn't know the character had, and a cost that cannot be returned. The comeback happens through depletion, not by transcending it. The opponent must remain formidable.",
  "Defeat": "The more common human experience. The moment of certainty before the official end. The continuation anyway. The body after defeat: not tired — specifically and pointlessly depleted. Do not redeem the defeat within the scene.",
};

interface Props {
  sportsArchetype: string;
  setSportsArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateSports: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function SportsPanel({
  sportsArchetype, setSportsArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateSports, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 10, textTransform: "uppercase" }}>
          Sports Mode — Select an archetype
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={sportsArchetype}
          onChange={e => setSportsArchetype(e.target.value)}
        >
          {getSportsArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #16653440", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {SPORTS_DESCRIPTIONS[sportsArchetype] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating sports scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>
              Select an archetype and describe the performance — sport, character, stakes, physical state
            </div>
        }
      </div>

      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: "#f0fdf4", color: "#166534" }} onClick={() => {
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
          placeholder="Describe the performance — what sport or activity, who is performing, what is at stake, what physical state are they in?"
          onKeyDown={e => e.key === "Enter" && !generating && generateSports(sportsArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#166534", color: "#fff" }}
          disabled={generating}
          onClick={() => generateSports(sportsArchetype, prompt)}
        >
          {generating ? "..." : "🏃 Generate"}
        </button>
      </div>
    </div>
  );
}
