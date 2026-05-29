"use client";
import { getHistoricalArchetypeNames } from "@/lib/historical";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

const HISTORICAL_DESCRIPTIONS: Record<string, string> = {
  "Longue Durée": "Braudel — the permanent material conditions of existence. Never named by characters; always present. Strip modern assumptions: light after dark has cost, cold requires management, distance is time.",
  "Conjunctural Pressure": "The large forces of the specific decade pressing on every individual life. Felt as personal, not structural. 'Bread is too expensive now' — not 'there is an economic crisis.'",
  "Microhistory Moment": "Ginzburg — one small, dense scene that illuminates the large forces. A transaction, a conversation. Every detail loadable with meaning. Read the silences as carefully as the statements.",
  "Material Reality": "E.P. Thompson — the specific material costs of historical existence. What the body must do. The weight of things, the cost of light, the time that distance requires.",
  "Cultural Script": "Geertz — the web of meanings within which behavior is intelligible. Characters inhabit their scripts naturally. The violation is always costly in the specific way this culture makes it costly.",
};

interface Props {
  historicalArchetype: string;
  setHistoricalArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateHistorical: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

export function HistoricalPanel({
  historicalArchetype, setHistoricalArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateHistorical, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 10, textTransform: "uppercase" }}>
          Historical/Cultural Mode — Select an archetype
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={historicalArchetype}
          onChange={e => setHistoricalArchetype(e.target.value)}
        >
          {getHistoricalArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: "#fef3c7", borderRadius: 8, border: "1px solid #92400E40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {HISTORICAL_DESCRIPTIONS[historicalArchetype] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating historical scene...</div>
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
          <button style={{ ...sBtn, background: "#fef3c7", color: "#92400E" }} onClick={() => {
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
          placeholder="Describe the historical moment — period, place, who is present, what is at stake"
          onKeyDown={e => e.key === "Enter" && !generating && generateHistorical(historicalArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#92400E", color: "#fff" }}
          disabled={generating}
          onClick={() => generateHistorical(historicalArchetype, prompt)}
        >
          {generating ? "..." : "📜 Generate"}
        </button>
      </div>
    </div>
  );
}
