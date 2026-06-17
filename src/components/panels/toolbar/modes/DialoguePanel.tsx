"use client";
import { getDialogueArchetypeNames } from "@/lib/dialogue";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

interface Props {
  project: any;
  dialogueCharA: string;
  setDialogueCharA: (id: string) => void;
  dialogueCharB: string;
  setDialogueCharB: (id: string) => void;
  dialogueArchetype: string;
  setDialogueArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateDialogue: (charAId: string, charBId: string, prompt: string, archetypeName: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

const DESCRIPTIONS: Record<string, string> = {
  "Argument": "Surface fight concealing a deeper wound. Power shifts. Something true gets said.",
  "Interrogation": "One extracts, one protects. Tactics, tells, and the question of who breaks.",
  "Confession": "A truth transferred — the confessor circles before landing. Aftermath changes everything.",
  "Reunion": "Shared history collides with who they've become. Stilted, then raw.",
  "Negotiation": "Both want what the other has. Real bottom lines never stated.",
  "Seduction": "Desire disguised as conversation. Plausible deniability until it isn't.",
  "Farewell": "The last chance to say it — and what doesn't get said.",
  "Group Scene": "Alliances form and shift. Someone gets silenced. The group is its own character.",
};

export function DialoguePanel({
  project, dialogueCharA, setDialogueCharA, dialogueCharB, setDialogueCharB,
  dialogueArchetype, setDialogueArchetype, generating, streamText, setStreamText,
  prompt, setPrompt, generateDialogue, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Character selector + profile cards */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Dialogue Mode — Select two characters</div>
        {(!project.characters || project.characters.length < 2) ? (
          <div style={{ fontSize: 13, color: co.muted, padding: "8px 0" }}>Add at least 2 characters in the World Bible to use Dialogue Mode.</div>
        ) : (
          <div style={{ display: "flex", gap: 16 }}>
            {/* Character A */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Character A</div>
              <select style={{ ...sInput, marginBottom: 8 }} value={dialogueCharA} onChange={e => setDialogueCharA(e.target.value)}>
                <option value="">Select character...</option>
                {project.characters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {dialogueCharA && (() => {
                const c = project.characters.find((ch: any) => ch.id === dialogueCharA);
                if (!c) return null;
                return (
                  <div style={{ padding: "10px 12px", background: co.surface, borderRadius: 8, border: "1px solid " + co.border, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.name} <span style={{ fontWeight: 400, color: co.muted }}>— {c.role}</span></div>
                    {c.speechPattern && <div style={{ color: co.muted, marginBottom: 2 }}><strong>Speech:</strong> {c.speechPattern}</div>}
                    {c.personality && <div style={{ color: co.muted, marginBottom: 2 }}><strong>Personality:</strong> {c.personality}</div>}
                    {c.desires && <div style={{ color: co.muted }}><strong>Wants:</strong> {c.desires}</div>}
                  </div>
                );
              })()}
            </div>
            {/* Character B */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Character B</div>
              <select style={{ ...sInput, marginBottom: 8 }} value={dialogueCharB} onChange={e => setDialogueCharB(e.target.value)}>
                <option value="">Select character...</option>
                {project.characters.filter((c: any) => c.id !== dialogueCharA).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {dialogueCharB && (() => {
                const c = project.characters.find((ch: any) => ch.id === dialogueCharB);
                if (!c) return null;
                return (
                  <div style={{ padding: "10px 12px", background: co.surface, borderRadius: 8, border: "1px solid " + co.border, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.name} <span style={{ fontWeight: 400, color: co.muted }}>— {c.role}</span></div>
                    {c.speechPattern && <div style={{ color: co.muted, marginBottom: 2 }}><strong>Speech:</strong> {c.speechPattern}</div>}
                    {c.personality && <div style={{ color: co.muted, marginBottom: 2 }}><strong>Personality:</strong> {c.personality}</div>}
                    {c.desires && <div style={{ color: co.muted }}><strong>Wants:</strong> {c.desires}</div>}
                  </div>
                );
              })()}
            </div>
            {/* Scene Archetype */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Scene Archetype</div>
              <select style={{ ...sInput, marginBottom: 8 }} value={dialogueArchetype} onChange={e => setDialogueArchetype(e.target.value)}>
                {getDialogueArchetypeNames().map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {dialogueArchetype && (
                <div style={{ padding: "10px 12px", background: co.accentBg, borderRadius: 8, border: "1px solid " + co.accent + "40", fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
                  {DESCRIPTIONS[dialogueArchetype] ?? ""}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Generated dialogue output */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating dialogue...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>Select two characters and describe the scene below</div>}
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
          placeholder="Describe the scene — what do they want from each other?"
          onKeyDown={e => e.key === "Enter" && !generating && generateDialogue(dialogueCharA, dialogueCharB, prompt, dialogueArchetype)}
        />
        <button
          style={{ ...sBtn, opacity: generating || !dialogueCharA || !dialogueCharB ? 0.5 : 1 }}
          disabled={generating || !dialogueCharA || !dialogueCharB}
          onClick={() => generateDialogue(dialogueCharA, dialogueCharB, prompt, dialogueArchetype)}
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
