"use client";
import { getSettingArchetypeNames } from "@/lib/setting";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const SETTING_DESCRIPTIONS: Record<string, string> = {
  "Prospect-Refuge": "Appleton (1975) — spatial behavior as character revelation. Where they position themselves tells you who they are. The paranoid and the open character don't enter the same room the same way.",
  "Restorative": "Kaplan ART (1989) — the natural environment actively restores cognition. The insight arrives in the body before it arrives as thought. Write the restoration process, not just the peaceful backdrop.",
  "Olfactory Anchor": "The Proust Effect — smell bypasses cortical analysis and arrives directly at emotion and memory. Involuntary, specific, precise. Not 'the sea' — the exact compound of kelp, diesel, and mineral air.",
  "Place-Attached": "Scannell & Gifford (2010) — place is identity. Displacement is always an identity event, not just a location event. Return always measures the gap between selves.",
  "Hostile Environment": "Inverse Prospect-Refuge — no sightlines, no cover, no refuge. The environment is the antagonist. Accumulate spatial constraints: each paragraph removes one more option.",
};

interface Props {
  settingArchetype: string;
  setSettingArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateSetting: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function SettingPanel({
  settingArchetype, setSettingArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateSetting, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#0F4C5C", marginBottom: 10, textTransform: "uppercase" }}>
          World/Setting Mode — Select an archetype
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={settingArchetype}
          onChange={e => setSettingArchetype(e.target.value)}
        >
          {getSettingArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: "#e6f4f1", borderRadius: 8, border: "1px solid #0F4C5C40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {SETTING_DESCRIPTIONS[settingArchetype] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating setting scene...</div>
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
          <button style={{ ...sBtn, background: "#e6f4f1", color: "#0F4C5C" }} onClick={() => {
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
          placeholder="Describe the space — who enters it, what they carry in, what the environment must do to them"
          onKeyDown={e => e.key === "Enter" && !generating && generateSetting(settingArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: "#0F4C5C", color: "#fff" }}
          disabled={generating}
          onClick={() => generateSetting(settingArchetype, prompt)}
        >
          {generating ? "..." : "🌍 Generate"}
        </button>
      </div>
    </div>
  );
}
