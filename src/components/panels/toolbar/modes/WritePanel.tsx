"use client";
import { isCreatorFormat } from "@/lib/formats";
import { co, sInput, sTextarea, sBtn, sBtnSm } from "@/lib/styles";
import { ProsePanel } from "../tools/ProsePanel";
import { ScoreHookPanel } from "../tools/ScoreHookPanel";
import { TitleHookPanel } from "../tools/TitleHookPanel";
import type { HookScore, ProseResult } from "../types";

interface Props {
  mode: string;
  project: any;
  activeChap: any;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  genTarget: string;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  expandedPrompt: boolean;
  setExpandedPrompt: (v: boolean) => void;
  selectedText: string;
  setSelectedText: (v: string) => void;
  setSelectedRange: (v: any) => void;
  proseLoading: boolean;
  proseResult: ProseResult | null;
  setProseResult: (v: ProseResult | null) => void;
  runProse: (mode: string) => Promise<void>;
  replaceSelection: (text: string) => void;
  hookScore: HookScore | null;
  hookScoring: boolean;
  scoreHook: () => Promise<void>;
  generate: () => Promise<void>;
  cohostVoice: string;
  setCohostVoice: (v: string) => void;
  handleTextareaSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onUpgradeRequired?: (feature: string) => void;
}

export function WritePanel({
  mode, project, activeChap, updateChapter,
  generating, genTarget, streamText, setStreamText,
  prompt, setPrompt, expandedPrompt, setExpandedPrompt,
  selectedText, setSelectedText, setSelectedRange,
  proseLoading, proseResult, setProseResult, runProse, replaceSelection,
  hookScore, hookScoring, scoreHook,
  generate, cohostVoice, setCohostVoice, handleTextareaSelect, onUpgradeRequired,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Prose floating toolbar + modal */}
      <ProsePanel
        mode={mode}
        selectedText={selectedText}
        setSelectedText={setSelectedText}
        setSelectedRange={setSelectedRange}
        proseLoading={proseLoading}
        proseResult={proseResult}
        setProseResult={setProseResult}
        runProse={runProse}
        replaceSelection={replaceSelection}
      />

      {/* Write mode — editor */}
      {mode === "write" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 24px 0" }}>
            <input
              style={{ background: "transparent", border: "none", fontSize: 20, fontWeight: 700, padding: 0, fontFamily: "Georgia,serif", color: co.text, outline: "none", width: "100%" }}
              value={activeChap.title}
              onChange={e => updateChapter("title", e.target.value)}
            />
          </div>
          {activeChap.summary && (
            <div style={{ margin: "6px 24px", padding: "8px 12px", background: co.accentBg, borderRadius: 8, fontSize: 12, color: co.muted, borderLeft: "3px solid " + co.accent }}>
              <strong style={{ color: co.accent }}>Continuity:</strong> {activeChap.summary}
            </div>
          )}
          <textarea
            style={{ flex: 1, background: co.bg, padding: 24, overflow: "auto", fontSize: 15, lineHeight: 1.8, color: co.text, whiteSpace: "pre-wrap", outline: "none", fontFamily: "Georgia,serif", border: "none", resize: "none", boxSizing: "border-box" }}
            value={activeChap.content}
            onChange={e => updateChapter("content", e.target.value)}
            onSelect={handleTextareaSelect}
            onMouseUp={handleTextareaSelect}
            placeholder="Start writing..."
          />
        </div>
      ) : mode === "cohost" ? (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {streamText ? (
            <div>
              {streamText.split("\n").map((line: string, i: number) => (
                <div key={i} style={{
                  marginBottom: line.startsWith("[CO-HOST]") || line.startsWith("[HOST TALKING POINTS]") ? 8 : 2,
                  fontWeight: line.startsWith("[CO-HOST]") || line.startsWith("[HOST TALKING POINTS]") ? 700 : 400,
                  color: line.startsWith("[CO-HOST]") ? co.accent : co.text,
                  fontSize: 14, lineHeight: 1.7, fontFamily: "system-ui",
                }}>{line}</div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8, color: co.muted }}>
              <div style={{ fontSize: 15 }}>Co-host Simulator</div>
              <div style={{ fontSize: 12 }}>Output shows [CO-HOST] questions + [HOST TALKING POINTS] bullets — your recording guide.</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {streamText
            ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>
            : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 15 }}>
                {mode === "brainstorm" ? "Ask a what-if or describe what you need" : "Describe what to outline"}
              </div>}
        </div>
      )}

      {/* Co-host insert bar */}
      {mode === "cohost" && streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={sBtn} onClick={() => {
            updateChapter("content", (activeChap?.content || "") + (activeChap?.content ? "\n\n" : "") + streamText);
            setStreamText("");
          }}>Insert into Chapter</button>
        </div>
      )}

      {/* Prompt bar */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface }}>
        {mode === "cohost" && (
          <select style={{ ...sInput, width: 180, flexShrink: 0 }} value={cohostVoice} onChange={e => setCohostVoice(e.target.value)}>
            <option value="curious_generalist">Curious Generalist</option>
            <option value="skeptical_expert">Skeptical Expert</option>
            <option value="enthusiastic_newcomer">Enthusiastic Newcomer</option>
          </select>
        )}
        {expandedPrompt
          ? <textarea style={{ ...sTextarea, flex: 1, minHeight: 80 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe in detail..." />
          : <input
              style={{ ...sInput, flex: 1 }}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={
                mode === "cohost" ? "Episode topic or segment to simulate..."
                : mode === "brainstorm" ? "What if..."
                : mode === "outline" ? "Outline..."
                : "Write the next scene..."
              }
              onKeyDown={e => e.key === "Enter" && !generating && generate()}
            />
        }

        {/* Title Ideas (creator + has prompt + not cohost) */}
        <TitleHookPanel
          format={project.format}
          mode={mode}
          prompt={prompt}
          topic={activeChap.title}
          setSavedMsg={() => {}}
          onUpgradeRequired={onUpgradeRequired}
        />

        {/* Score Hook */}
        <ScoreHookPanel
          format={project.format}
          prompt={prompt}
          hookScore={hookScore}
          hookScoring={hookScoring}
          scoreHook={scoreHook}
        />

        {/* Generate button */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} onClick={generate} disabled={generating}>
            {genTarget === "main" ? "..." : "Generate"}
          </button>
          <button style={{ padding: "2px 8px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, background: "transparent", color: co.muted }} onClick={() => setExpandedPrompt(!expandedPrompt)}>
            {expandedPrompt ? "Less" : "More"}
          </button>
        </div>
      </div>
    </div>
  );
}
