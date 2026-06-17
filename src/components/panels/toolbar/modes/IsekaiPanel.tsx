"use client";
import { useState } from "react";
import { getIsekaiArchetypeNames, ISEKAI_ARCHETYPES } from "@/lib/isekai";
import { co, panel, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const PANEL_BG = "#1a0533";
const PANEL_ACCENT = "#a855f7";

interface Props {
  isekaiArchetype: string;
  setIsekaiArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateIsekai: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function IsekaiPanel({
  isekaiArchetype, setIsekaiArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateIsekai, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const arch = ISEKAI_ARCHETYPES[isekaiArchetype];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: PANEL_BG, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: PANEL_ACCENT, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          ⚔️ Isekai / LitRPG Mode
        </div>

        <div style={{ fontSize: 11, color: "#c4b5fd", marginBottom: 4 }}>Subgenre</div>
        <select
          style={{ ...sInput, marginBottom: 8, background: "#2d1354", color: "#e9d5ff", border: "1px solid " + PANEL_ACCENT + "60" }}
          value={isekaiArchetype}
          onChange={e => setIsekaiArchetype(e.target.value)}
        >
          {getIsekaiArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {arch && (
          <div style={{ background: PANEL_ACCENT + "18", border: "1px solid " + PANEL_ACCENT + "40", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "#c4b5fd", lineHeight: 1.5, marginBottom: 8 }}>
              <strong style={{ color: PANEL_ACCENT }}>Promise:</strong> {arch.corePromise.split(".")[0]}.
            </div>
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{ fontSize: 10, color: PANEL_ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              {showDetails ? "Hide genre guide ▲" : "Show genre guide ▼"}
            </button>
            {showDetails && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: PANEL_ACCENT, textTransform: "uppercase", marginBottom: 4 }}>Non-Negotiables</div>
                  {arch.nonNegotiables.map((n, i) => <div key={i} style={{ fontSize: 10, color: "#c4b5fd", marginBottom: 2 }}>• {n}</div>)}
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: panel.success, textTransform: "uppercase", marginBottom: 4 }}>Fresh Angles (2025-2026)</div>
                  {arch.freshAngles.map((f, i) => <div key={i} style={{ fontSize: 10, color: panel.success, marginBottom: 2 }}>• {f}</div>)}
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: panel.orange, textTransform: "uppercase", marginBottom: 4 }}>Avoid (Oversaturated)</div>
                  {arch.oversaturatedTropes.map((t, i) => <div key={i} style={{ fontSize: 10, color: panel.orange, marginBottom: 2 }}>⚠ {t}</div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Writing isekai scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>
              Select a subgenre, describe your scene below, then generate.
            </div>
        }
      </div>

      {/* Insert bar */}
      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: PANEL_BG, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: PANEL_ACCENT + "30", color: PANEL_ACCENT, border: "1px solid " + PANEL_ACCENT }} onClick={() => {
            if (insertIntoEditor) { insertIntoEditor(streamText); } else { updateChapter("content", appendToTipTap(activeChap?.content || "", streamText)); }
            setStreamText("");
          }}>Insert into Chapter</button>
        </div>
      )}

      {/* Prompt bar */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: PANEL_BG, flexShrink: 0 }}>
        <input
          style={{ ...sInput, flex: 1, background: "#2d1354", color: "#e9d5ff", border: "1px solid " + PANEL_ACCENT + "60" }}
          placeholder="Describe the scene — system notification, power awakening, decision moment..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !generating && generateIsekai(isekaiArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, background: PANEL_ACCENT, color: "#fff", opacity: generating ? 0.5 : 1 }}
          disabled={generating || !prompt.trim()}
          onClick={() => generateIsekai(isekaiArchetype, prompt)}
        >
          {generating ? "Writing..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
