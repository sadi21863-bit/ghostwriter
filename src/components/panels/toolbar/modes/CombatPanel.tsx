"use client";
import { getCombatStyleNames } from "@/lib/combat";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";

interface Props {
  combatStyleA: string;
  setCombatStyleA: (v: string) => void;
  combatStyleB: string;
  setCombatStyleB: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateCombat: (styleA: string, styleB: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
}

export function CombatPanel({
  combatStyleA, setCombatStyleA, combatStyleB, setCombatStyleB,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateCombat, updateChapter, activeChap,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Style selectors */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Combat Mode — Select two fighting styles</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Fighter A Style</div>
            <select style={sInput} value={combatStyleA} onChange={e => setCombatStyleA(e.target.value)}>
              <option value="">Select style...</option>
              {getCombatStyleNames().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Fighter B Style</div>
            <select style={sInput} value={combatStyleB} onChange={e => setCombatStyleB(e.target.value)}>
              <option value="">Select style...</option>
              {getCombatStyleNames().filter(s => s !== combatStyleA).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Combat output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating combat scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>Select two fighting styles and describe the scene below</div>}
      </div>

      {/* Insert / Discard bar */}
      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={sBtn} onClick={() => {
            updateChapter("content", (activeChap?.content || "") + (activeChap?.content ? "\n\n" : "") + streamText);
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
          placeholder="Describe the fight — stakes, setting, who has the advantage?"
          onKeyDown={e => e.key === "Enter" && !generating && generateCombat(combatStyleA, combatStyleB, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating || !combatStyleA || !combatStyleB ? 0.5 : 1 }}
          disabled={generating || !combatStyleA || !combatStyleB}
          onClick={() => generateCombat(combatStyleA, combatStyleB, prompt)}
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
