"use client";
import ComicStudio from "@/components/ComicStudio";
import ProductionStudio from "@/components/ProductionStudio";
import { getPipelines, AGENT_LABELS, type Pipeline } from "@/lib/ai/pipelines";
import { MODES, isStoryFormat } from "@/lib/formats";
import { co, sInput, sTextarea, sBtn, sBtnSm } from "@/lib/styles";

interface Props {
  project: any;
  higgsfieldKey: string;
  mode: string;
  setMode: (m: string) => void;
  activeChap: any;
  updateChapter: (f: string, v: any) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  expandedPrompt: boolean;
  setExpandedPrompt: (v: boolean) => void;
  showAgents: boolean;
  setShowAgents: (v: boolean | ((p: boolean) => boolean)) => void;
  showComicStudio: boolean;
  setShowComicStudio: (v: boolean | ((p: boolean) => boolean)) => void;
  showProductionStudio: boolean;
  setShowProductionStudio: (v: boolean | ((p: boolean) => boolean)) => void;
  generating: boolean;
  genTarget: string;
  streamText: string;
  setStreamText: (v: string) => void;
  undoStack: string[];
  undoGeneration: () => void;
  pipelineRunning: boolean;
  pipelineResults: { agent: string; output: string }[];
  setPipelineResults: (v: any) => void;
  expandedAgent: string | null;
  setExpandedAgent: (v: string | null) => void;
  activePipelineId: string | null;
  runPipeline: (p: Pipeline) => Promise<void>;
  usePipelineOutput: (output: string) => void;
  selectedText: string;
  setSelectedText: (v: string) => void;
  setSelectedRange: (v: any) => void;
  proseLoading: boolean;
  proseResult: any;
  setProseResult: (v: any) => void;
  runProse: (mode: string) => Promise<void>;
  replaceSelection: (text: string) => void;
  hookScore: { score: number; feedback: string } | null;
  hookScoring: boolean;
  scoreHook: () => Promise<void>;
  generate: () => Promise<void>;
  generateDialogue: (charAId: string, charBId: string, prompt: string) => Promise<void>;
  updateProject: (fn: any) => void;
  handleTextareaSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  setSavedMsg: (m: string) => void;
  dialogueCharA: string;
  setDialogueCharA: (id: string) => void;
  dialogueCharB: string;
  setDialogueCharB: (id: string) => void;
}

const modeLabel = (m: string) => ({ brainstorm: "Brainstorm", outline: "Outline", write: "Write", dialogue: "Dialogue" }[m] ?? m);

export default function ToolbarPanel(props: Props) {
  const {
    project, higgsfieldKey, mode, setMode, activeChap, updateChapter,
    prompt, setPrompt, expandedPrompt, setExpandedPrompt,
    showAgents, setShowAgents, showComicStudio, setShowComicStudio, showProductionStudio, setShowProductionStudio,
    generating, genTarget, streamText, setStreamText, undoStack, undoGeneration,
    pipelineRunning, pipelineResults, setPipelineResults, expandedAgent, setExpandedAgent, activePipelineId,
    runPipeline, usePipelineOutput,
    selectedText, setSelectedText, setSelectedRange, proseLoading, proseResult, setProseResult, runProse, replaceSelection,
    hookScore, hookScoring, scoreHook, generate, generateDialogue, updateProject, handleTextareaSelect, setSavedMsg,
    dialogueCharA, setDialogueCharA, dialogueCharB, setDialogueCharB,
  } = props;

  const wordCount = (activeChap.content || "").trim().split(/\s+/).filter(Boolean).length;
  const totalWords = project.chapters.reduce((a: number, c: any) => a + (c.content || "").trim().split(/\s+/).filter(Boolean).length, 0);
  const visibleModes = isStoryFormat(project.format) ? MODES : MODES.filter(m => m !== "dialogue");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: co.surface, borderBottom: "1px solid " + co.border, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4, background: co.surfaceAlt, borderRadius: 10, padding: 3 }}>
          {visibleModes.map(m => (
            <button key={m} style={{ padding: "6px 16px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, background: mode === m ? co.accent : "transparent", color: mode === m ? "#fff" : co.muted }} onClick={() => setMode(m)}>
              {modeLabel(m)}
            </button>
          ))}
        </div>
        <button style={{ ...sBtnSm, background: showAgents ? co.accentBg : co.surfaceAlt, color: showAgents ? co.accent : co.muted, fontWeight: showAgents ? 700 : 400, border: "1px solid " + (showAgents ? co.accent : co.border) }} onClick={() => { setShowAgents((v: boolean) => !v); setPipelineResults([]); setShowComicStudio(false); setShowProductionStudio(false); }}>⚡ Agents</button>
        {isStoryFormat(project.format) && <button style={{ ...sBtnSm, background: showComicStudio ? co.accentBg : co.surfaceAlt, color: showComicStudio ? co.accent : co.muted, fontWeight: showComicStudio ? 700 : 400, border: "1px solid " + (showComicStudio ? co.accent : co.border) }} onClick={() => { setShowComicStudio((v: boolean) => !v); setShowProductionStudio(false); setShowAgents(false); setPipelineResults([]); }}>🎨 Comics</button>}
        {isStoryFormat(project.format) && <button style={{ ...sBtnSm, background: showProductionStudio ? co.accentBg : co.surfaceAlt, color: showProductionStudio ? co.accent : co.muted, fontWeight: showProductionStudio ? 700 : 400, border: "1px solid " + (showProductionStudio ? co.accent : co.border) }} onClick={() => { setShowProductionStudio((v: boolean) => !v); setShowComicStudio(false); setShowAgents(false); setPipelineResults([]); }}>🎬 Studio</button>}
        <div style={{ flex: 1 }} />
        {mode === "write" && <span style={{ fontSize: 11, color: co.muted, background: co.surfaceAlt, padding: "4px 10px", borderRadius: 6 }}>{wordCount} words | {totalWords} total</span>}
        {mode === "write" && undoStack.length > 0 && <button style={{ ...sBtnSm, background: "#fff3e0", color: "#e65100" }} onClick={undoGeneration}>Undo AI</button>}
        {(mode === "brainstorm" || mode === "outline") && streamText && (
          <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 600 }} onClick={() => {
            updateProject((p: any) => ({ ...p, notes: p.notes + (p.notes ? "\n\n---\n\n" : "") + "[" + mode.toUpperCase() + "]\n" + streamText }));
            setSavedMsg("Saved to notes"); setTimeout(() => setSavedMsg(""), 1500);
          }}>Save to Notes</button>
        )}
      </div>

      {/* Agents panel */}
      {showAgents && (
        <div style={{ borderBottom: "1px solid " + co.border, background: co.surfaceAlt, padding: "12px 16px", maxHeight: 420, overflowY: "auto" }}>
          {pipelineResults.length === 0 ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Agent Pipelines — {project.format} / {mode}</div>
              {getPipelines(project.format, mode).length === 0
                ? <div style={{ fontSize: 12, color: co.muted }}>No pipelines available for this format + mode combination.</div>
                : getPipelines(project.format, mode).map((pipeline: Pipeline) => (
                  <div key={pipeline.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: co.surface, borderRadius: 10, marginBottom: 8, border: "1px solid " + co.border }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{pipeline.name}</div>
                      <div style={{ fontSize: 11, color: co.muted, marginTop: 2 }}>{pipeline.description}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {pipeline.agents.map((a: string) => <span key={a} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: co.accentBg, color: co.accent, fontWeight: 600 }}>{AGENT_LABELS[a]}</span>)}
                      </div>
                    </div>
                    <button style={{ ...sBtn, opacity: pipelineRunning || !prompt.trim() ? 0.5 : 1 }} disabled={pipelineRunning || !prompt.trim()} onClick={() => runPipeline(pipeline)}>
                      {pipelineRunning && activePipelineId === pipeline.id ? "Running..." : "Run ▶"}
                    </button>
                  </div>
                ))}
              {!prompt.trim() && <div style={{ fontSize: 11, color: co.muted, marginTop: 8 }}>Type a prompt below first, then run a pipeline.</div>}
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Pipeline Results</div>
                <button style={sBtnSm} onClick={() => { setPipelineResults([]); setExpandedAgent(null); }}>← Back</button>
              </div>
              {pipelineResults.map((r, i) => (
                <div key={r.agent} style={{ marginBottom: 8, border: "1px solid " + co.border, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: co.surface, cursor: "pointer" }} onClick={() => setExpandedAgent(expandedAgent === r.agent ? null : r.agent)}>
                    <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{AGENT_LABELS[r.agent as keyof typeof AGENT_LABELS] ?? r.agent}</span>
                    <span style={{ fontSize: 10, color: co.muted }}>{expandedAgent === r.agent ? "▲" : "▼"}</span>
                  </div>
                  {expandedAgent === r.agent && (
                    <div style={{ padding: 12, background: co.surfaceAlt }}>
                      <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap", marginBottom: 10 }}>{r.output}</div>
                      {i === pipelineResults.length - 1 && <button style={sBtn} onClick={() => usePipelineOutput(r.output)}>Use Final Output</button>}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Main content area */}
      {showComicStudio
        ? <ComicStudio project={project} higgsfieldKey={higgsfieldKey} onOpenStudio={() => { setShowComicStudio(false); setShowProductionStudio(true); }} />
        : showProductionStudio
        ? <ProductionStudio project={project} higgsfieldKey={higgsfieldKey} />
        : mode === "dialogue"
        ? (
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
                placeholder="Describe the scene — what do they want from each other?"
                onKeyDown={e => e.key === "Enter" && !generating && generateDialogue(dialogueCharA, dialogueCharB, prompt)}
              />
              <button
                style={{ ...sBtn, opacity: generating || !dialogueCharA || !dialogueCharB ? 0.5 : 1 }}
                disabled={generating || !dialogueCharA || !dialogueCharB}
                onClick={() => generateDialogue(dialogueCharA, dialogueCharB, prompt)}
              >
                {generating ? "..." : "Generate"}
              </button>
            </div>
          </div>
        )
        : <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Prose selection toolbar */}
          {mode === "write" && selectedText && (
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 110, zIndex: 50, display: "flex", gap: 4, background: co.surface, border: "1px solid " + co.border, borderRadius: 10, padding: "6px 8px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
              {proseLoading
                ? <span style={{ fontSize: 12, color: co.muted, padding: "4px 8px" }}>Generating...</span>
                : <>
                  <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("expand")}>✨ Expand</button>
                  <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("rewrite")}>🔄 Rewrite</button>
                  <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("show-dont-tell")}>👁 Show Don't Tell</button>
                  <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "0 4px" }} onClick={() => { setSelectedText(""); setSelectedRange(null); }}>×</button>
                </>}
            </div>
          )}

          {mode === "write" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "10px 24px 0" }}>
                <input style={{ background: "transparent", border: "none", fontSize: 20, fontWeight: 700, padding: 0, fontFamily: "Georgia,serif", color: co.text, outline: "none", width: "100%" }} value={activeChap.title} onChange={e => updateChapter("title", e.target.value)} />
              </div>
              {activeChap.summary && <div style={{ margin: "6px 24px", padding: "8px 12px", background: co.accentBg, borderRadius: 8, fontSize: 12, color: co.muted, borderLeft: "3px solid " + co.accent }}><strong style={{ color: co.accent }}>Continuity:</strong> {activeChap.summary}</div>}
              <textarea style={{ flex: 1, background: co.bg, padding: 24, overflow: "auto", fontSize: 15, lineHeight: 1.8, color: co.text, whiteSpace: "pre-wrap", outline: "none", fontFamily: "Georgia,serif", border: "none", resize: "none", boxSizing: "border-box" }} value={activeChap.content} onChange={e => updateChapter("content", e.target.value)} onSelect={handleTextareaSelect} onMouseUp={handleTextareaSelect} placeholder="Start writing..." />
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              {streamText ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 15 }}>{mode === "brainstorm" ? "Ask a what-if or describe what you need" : "Describe what to outline"}</div>}
            </div>
          )}

          {/* Prompt bar */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface }}>
            {expandedPrompt
              ? <textarea style={{ ...sTextarea, flex: 1, minHeight: 80 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe in detail..." />
              : <input style={{ ...sInput, flex: 1 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={mode === "brainstorm" ? "What if..." : mode === "outline" ? "Outline..." : "Write the next scene..."} onKeyDown={e => e.key === "Enter" && !generating && generate()} />}
            {["TikTok Script", "YouTube Short", "Instagram Reel"].includes(project.format) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button style={{ ...sBtnSm, opacity: hookScoring || !prompt.trim() ? 0.5 : 1 }} disabled={hookScoring || !prompt.trim()} onClick={scoreHook}>{hookScoring ? "Scoring..." : "Score Hook"}</button>
                {hookScore && (
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: hookScore.score >= 8 ? "#22c55e" : hookScore.score >= 5 ? "#eab308" : "#ef4444" }}>
                      {hookScore.score >= 8 ? "🟢" : hookScore.score >= 5 ? "🟡" : "🔴"} {hookScore.score}/10
                    </span>
                    <div style={{ fontSize: 10, color: co.muted, maxWidth: 100, lineHeight: 1.3, marginTop: 2 }}>{hookScore.feedback}</div>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} onClick={generate} disabled={generating}>{genTarget === "main" ? "..." : "Generate"}</button>
              <button style={{ padding: "2px 8px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, background: "transparent", color: co.muted }} onClick={() => setExpandedPrompt(!expandedPrompt)}>{expandedPrompt ? "Less" : "More"}</button>
            </div>
          </div>
        </div>}

      {/* Prose Result Modal */}
      {proseResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setProseResult(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 600, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{proseResult.mode === "expand" ? "✨ Expanded" : proseResult.mode === "rewrite" ? "🔄 Rewrites" : "👁 Show Don't Tell"}</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setProseResult(null)}>×</button>
            </div>
            {proseResult.mode === "rewrite" && proseResult.variants ? (
              <>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 12 }}>Select a variant to use:</div>
                {proseResult.variants.map((v: string, i: number) => (
                  <div key={i} onClick={() => setProseResult((r: any) => r ? { ...r, chosen: i } : r)} style={{ padding: 14, borderRadius: 10, marginBottom: 8, border: "2px solid " + (proseResult.chosen === i ? co.accent : co.border), cursor: "pointer", background: proseResult.chosen === i ? co.accentBg : co.surfaceAlt, fontSize: 14, lineHeight: 1.7, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: proseResult.chosen === i ? co.accent : co.muted, marginBottom: 6 }}>VARIANT {i + 1}</div>
                    {v}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                  <button style={sBtnSm} onClick={() => setProseResult(null)}>Discard</button>
                  <button style={sBtn} onClick={() => proseResult.variants && replaceSelection(proseResult.variants[proseResult.chosen ?? 0])}>Use This</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: 16, borderRadius: 10, background: co.surfaceAlt, fontSize: 14, lineHeight: 1.8, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap", marginBottom: 16 }}>{proseResult.result}</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={sBtnSm} onClick={() => setProseResult(null)}>Discard</button>
                  <button style={sBtn} onClick={() => proseResult.result && replaceSelection(proseResult.result)}>Replace Selection</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
