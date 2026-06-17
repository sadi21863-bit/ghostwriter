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
  generateInterrogation: (interrogatorId: string, subjectId: string, goal: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function InterrogationPanel({
  project, generating, streamText, setStreamText,
  prompt, setPrompt, generateInterrogation, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  const [interrogatorId, setInterrogatorId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [goal, setGoal] = useState("");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Interrogation Mode — Psychological Pressure Architecture</div>
        {(!project.characters || project.characters.length < 2) ? (
          <div style={{ fontSize: 13, color: co.muted }}>Add at least 2 characters to use Interrogation Mode.</div>
        ) : (
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Interrogator</div>
              <select style={{ ...sInput, marginBottom: 8 }} value={interrogatorId} onChange={e => setInterrogatorId(e.target.value)}>
                <option value="">Select interrogator...</option>
                {project.characters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {interrogatorId && (() => {
                const c = project.characters.find((ch: any) => ch.id === interrogatorId);
                if (!c) return null;
                return (
                  <div style={{ padding: "10px 12px", background: co.surface, borderRadius: 8, border: "1px solid " + co.border, fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{c.name} <span style={{ fontWeight: 400, color: co.muted }}>— {c.role}</span></div>
                    {c.personality && <div style={{ color: co.muted, marginTop: 2 }}>{c.personality}</div>}
                  </div>
                );
              })()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Subject</div>
              <select style={{ ...sInput, marginBottom: 8 }} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                <option value="">Select subject...</option>
                {project.characters.filter((c: any) => c.id !== interrogatorId).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {subjectId && (() => {
                const c = project.characters.find((ch: any) => ch.id === subjectId);
                if (!c) return null;
                return (
                  <div style={{ padding: "10px 12px", background: co.surface, borderRadius: 8, border: "1px solid " + co.border, fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{c.name} <span style={{ fontWeight: 400, color: co.muted }}>— {c.role}</span></div>
                    {c.personality && <div style={{ color: co.muted, marginTop: 2 }}>{c.personality}</div>}
                  </div>
                );
              })()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Interrogation Goal</div>
              <input
                style={sInput}
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="What does the interrogator want to discover?"
              />
              <div style={{ marginTop: 8, padding: "10px 12px", background: co.accentBg, borderRadius: 8, border: "1px solid " + co.accent + "40", fontSize: 11, color: co.muted, lineHeight: 1.5 }}>
                Psychological pressure — false concessions, strategic silence, information display. No Q&A.
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Writing interrogation scene...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>Select two characters and set the interrogation goal below</div>}
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
          placeholder="Scene setup — where are they, what's at stake, what does the subject know?"
          onKeyDown={e => e.key === "Enter" && !generating && interrogatorId && subjectId && generateInterrogation(interrogatorId, subjectId, goal, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating || !interrogatorId || !subjectId ? 0.5 : 1 }}
          disabled={generating || !interrogatorId || !subjectId}
          onClick={() => generateInterrogation(interrogatorId, subjectId, goal, prompt)}
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
