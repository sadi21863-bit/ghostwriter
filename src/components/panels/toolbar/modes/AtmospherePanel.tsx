"use client";
import { getAtmosphereNames } from "@/lib/atmosphere";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

interface Props {
  atmosphereEnvironment: string;
  setAtmosphereEnvironment: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateAtmosphere: (environmentName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

const ENV_DESCRIPTIONS: Record<string, string> = {
  "Natural": "Soft fascination (ART). Cortisol drops. Lead with movement. Olfactory key: petrichor + soil + organic decay. Nature is indifferent — that's its power.",
  "Urban": "Hard fascination. Directed attention depletes. Anchor with sound layers: ground hum (engine, <200Hz) → voices → sharp sounds above. Temporal signature: 3am city ≠ noon city.",
  "Confined": "Forces proximity. Sound amplifies in small spaces. Olfactory: the accumulated presence of other people. Boundaries must be felt by the body.",
  "Liminal": "Suspended time and identity. Institutional smell (cleaning products, recycled air). Transitional light. Character says things they'd say nowhere else.",
  "Abandoned": "Temporal palimpsest: present decay over implied prior use. Olfactory: mold + damp + old wood. Floor requires conscious trust. Objects left behind tell the story.",
};

export function AtmospherePanel({
  atmosphereEnvironment, setAtmosphereEnvironment,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateAtmosphere, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Environment selector */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Atmosphere Mode — Select an environment</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Environment Type</div>
            <select style={{ ...sInput, marginBottom: 8 }} value={atmosphereEnvironment} onChange={e => setAtmosphereEnvironment(e.target.value)}>
              {getAtmosphereNames().map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <div style={{ padding: "10px 12px", background: co.accentBg, borderRadius: 8, border: "1px solid " + co.accent + "40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
              {ENV_DESCRIPTIONS[atmosphereEnvironment] ?? ""}
            </div>
          </div>
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating atmospheric scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>Select an environment and describe the scene below</div>}
      </div>

      {/* Insert / Discard bar */}
      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={sBtn} onClick={() => {
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
          placeholder="Describe the scene — what is happening in this environment?"
          onKeyDown={e => e.key === "Enter" && !generating && generateAtmosphere(atmosphereEnvironment, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1 }}
          disabled={generating}
          onClick={() => generateAtmosphere(atmosphereEnvironment, prompt)}
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
