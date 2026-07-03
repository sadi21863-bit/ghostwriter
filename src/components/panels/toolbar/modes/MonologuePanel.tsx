"use client";
import { getMonologueArchetypeNames } from "@/lib/monologue";
import { co, sInput, sBtn, sBtnSm } from "@/lib/styles";
import { appendToTipTap } from "@/hooks/ai-shared";

const MONOLOGUE_DESCRIPTIONS: Record<string, string> = {
  "Interior Monologue": "Sokolov's 3:1 compression — organized, directed thought with dropped pronouns and implicit time. The character is thinking through something, not narrating it. Complete sentences permitted but not required.",
  "Stream of Consciousness": "William James's continuous current — thought, sensation, memory, and perception at the same level. Fully associative: sound, smell, feeling pull the stream, not logic. No hierarchy, no destination.",
  "Dissociation": "The character experiences themselves from outside. Third-person self-observation. Inappropriately calm tone for extreme content. One vivid detail amid fog. Events register after they occur.",
  "Intrusive Thought": "Wegner's ironic process — the thought the character is trying not to have returns, repeatedly, faster. The suppression attempt makes it worse. The cycle must escalate. End at peak, not resolution.",
  "Decision Spiral": "Kahneman's fast-and-slow failure — the same options loop rather than progress. Compression increases under time pressure. Full sentences early, fragments late. Resolves through interruption, not logic.",
};

interface Props {
  monologueArchetype: string;
  setMonologueArchetype: (v: string) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateMonologue: (archetypeName: string, prompt: string) => Promise<void>;
  updateChapter: (field: string, value: any) => void;
  activeChap: any;
  insertIntoEditor?: (text: string) => void;
}

export function MonologuePanel({
  monologueArchetype, setMonologueArchetype,
  generating, streamText, setStreamText,
  prompt, setPrompt, generateMonologue, updateChapter, activeChap, insertIntoEditor,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>
          Monologue Mode — Select an archetype
        </div>
        <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Archetype</div>
        <select
          style={{ ...sInput, marginBottom: 8 }}
          value={monologueArchetype}
          onChange={e => setMonologueArchetype(e.target.value)}
        >
          {getMonologueArchetypeNames().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ padding: "10px 12px", background: co.accentBg, borderRadius: 8, border: `1px solid color-mix(in srgb, ${co.accent} 25%, transparent)`, fontSize: 12, color: co.muted, lineHeight: 1.5 }}>
          {MONOLOGUE_DESCRIPTIONS[monologueArchetype] ?? ""}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {generating
          ? <div style={{ color: co.muted, fontSize: 14 }}>Generating interior monologue...</div>
          : streamText
          ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 14 }}>
              Select an archetype and describe the scene or character state below
            </div>
        }
      </div>

      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: co.accentBg, color: co.accent }} onClick={() => {
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
          placeholder="Describe the character's mental state — what are they trying to think through, suppress, or decide?"
          onKeyDown={e => e.key === "Enter" && !generating && generateMonologue(monologueArchetype, prompt)}
        />
        <button
          style={{ ...sBtn, opacity: generating ? 0.5 : 1, background: co.accent, color: "#fff" }}
          disabled={generating}
          onClick={() => generateMonologue(monologueArchetype, prompt)}
        >
          {generating ? "..." : "🧠 Generate"}
        </button>
      </div>
    </div>
  );
}
