"use client";
import { useState } from "react";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

interface Props {
  project: any;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateChase: (pursuedId: string, pursuerId: string, terrain: string, stakes: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function ChasePanel({
  project, generating, streamText, setStreamText,
  prompt, setPrompt, generateChase, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  const [pursuedId, setPursuedId] = useState("");
  const [pursuerId, setPursuerId] = useState("");
  const [terrain, setTerrain] = useState("");
  const [stakes, setStakes] = useState("");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Chase/Escape Mode — Terrain Logic &amp; Resource Management</div>
        {(!project.characters || project.characters.length < 2) ? (
          <div style={{ fontSize: 13, color: co.muted }}>Add at least 2 characters to use Chase Mode.</div>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Pursued</div>
              <select style={{ ...sInput, marginBottom: 8 }} value={pursuedId} onChange={e => setPursuedId(e.target.value)}>
                <option value="">Select pursued...</option>
                {project.characters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Pursuer</div>
              <select style={{ ...sInput, marginBottom: 8 }} value={pursuerId} onChange={e => setPursuerId(e.target.value)}>
                <option value="">Select pursuer...</option>
                {project.characters.filter((c: any) => c.id !== pursuedId).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Terrain</div>
              <input style={{ ...sInput, marginBottom: 8 }} value={terrain} onChange={e => setTerrain(e.target.value)} placeholder="Crowded market, subway tunnels, rooftops..." />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Stakes if caught</div>
              <input style={sInput} value={stakes} onChange={e => setStakes(e.target.value)} placeholder="What happens if caught?" />
            </div>
          </div>
        )}
        <div style={{ marginTop: 8, padding: "8px 10px", background: co.accentBg, borderRadius: 6, fontSize: 11, color: co.muted, border: "1px solid " + co.accent + "40" }}>
          Terrain logic • Resource depletion • Decision points • Gap tracking
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Writing chase scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>Select characters, terrain, and stakes below</div>}
      </div>

      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={sBtn} onClick={() => {
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
          placeholder="What triggers the chase? Any specific beats or obstacles to include?"
          onKeyDown={e => e.key === "Enter" && !generating && pursuedId && pursuerId && generateChase(pursuedId, pursuerId, terrain, stakes, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating || !pursuedId || !pursuerId ? 0.5 : 1 }}
          disabled={generating || !pursuedId || !pursuerId}
          onClick={() => generateChase(pursuedId, pursuerId, terrain, stakes, prompt)}
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
