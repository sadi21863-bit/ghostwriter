"use client";
import { useState, useEffect, useRef } from "react";
import ComicStudio from "@/components/ComicStudio";
import ProductionStudio from "@/components/ProductionStudio";
import { getPipelines, AGENT_LABELS, type Pipeline } from "@/lib/ai/pipelines";
import { MODES, PODCAST_MODES, isStoryFormat, isCreatorFormat } from "@/lib/formats";
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
  cohostVoice: string;
  setCohostVoice: (v: string) => void;
}

const modeLabel = (m: string) => ({ brainstorm: "Brainstorm", outline: "Outline", write: "Write", dialogue: "Dialogue", cohost: "Co-host" }[m] ?? m);

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
    cohostVoice, setCohostVoice,
  } = props;

  const [retentionEdit, setRetentionEdit] = useState<any>(null);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [titleIdeas, setTitleIdeas] = useState<any>(null);
  const [titleLoading, setTitleLoading] = useState(false);
  const [repurposeResult, setRepurposeResult] = useState<any>(null);
  const [repurposeLoading, setRepurposeLoading] = useState(false);
  const [repurposeTarget, setRepurposeTarget] = useState("YouTube Short");
  const [showDissect, setShowDissect] = useState(false);
  const [dissectUrl, setDissectUrl] = useState("");
  const [dissectLoading, setDissectLoading] = useState(false);
  const [dissectResult, setDissectResult] = useState<any>(null);
  const [dissectJobId, setDissectJobId] = useState<string | null>(null);
  const [dissectStatus, setDissectStatus] = useState("");
  const dissectPollRef = useRef<any>(null);

  const REPURPOSE_TARGETS: Record<string, string[]> = {
    "YouTube Long-form": ["YouTube Short", "TikTok Script", "Instagram Reel", "Twitter/X Thread"],
    "Podcast Episode": ["YouTube Short", "TikTok Script", "Instagram Reel", "Twitter/X Thread"],
    "YouTube Short": ["TikTok Script", "Instagram Reel", "Twitter/X Thread"],
    "TikTok Script": ["YouTube Short", "Instagram Reel", "Twitter/X Thread"],
    "Instagram Reel": ["YouTube Short", "TikTok Script", "Twitter/X Thread"],
  };

  // D6 — Research scaffold
  const [researchScaffold, setResearchScaffold] = useState<any>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const runResearchScaffold = async () => {
    if (!prompt.trim() || researchLoading) return;
    setResearchLoading(true); setResearchScaffold(null);
    try {
      const res = await fetch("/api/ai/research-scaffold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: activeChap.title || prompt, angle: prompt }) });
      const data = await res.json();
      if (data.scaffold) setResearchScaffold(data.scaffold);
      else if (data.error) setResearchScaffold({ error: data.error });
    } catch { /* silent */ }
    setResearchLoading(false);
  };

  // D7 — Guest intel
  const [guestIntel, setGuestIntel] = useState<any>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const runGuestIntel = async () => {
    if (!prompt.trim() || guestLoading) return;
    setGuestLoading(true); setGuestIntel(null);
    try {
      const res = await fetch("/api/ai/guest-intel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestName: prompt, topic: activeChap.title }) });
      const data = await res.json();
      if (data.intel) setGuestIntel(data.intel);
      else if (data.error) setGuestIntel({ error: data.error });
    } catch { /* silent */ }
    setGuestLoading(false);
  };

  // D9 — Trend angles
  const [trendAngles, setTrendAngles] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const runTrendAngles = async () => {
    if (!prompt.trim() || trendLoading) return;
    setTrendLoading(true); setTrendAngles(null);
    try {
      const res = await fetch("/api/ai/trend-angles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: prompt, format: project.format }) });
      const data = await res.json();
      if (data.trends) setTrendAngles(data.trends);
      else if (data.error) setTrendAngles({ error: data.error });
    } catch { /* silent */ }
    setTrendLoading(false);
  };

  const runRepurpose = async (target: string) => {
    const script = activeChap.content;
    if (!script?.trim() || repurposeLoading) return;
    setRepurposeLoading(true); setRepurposeResult(null);
    try {
      const res = await fetch("/api/ai/repurpose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: script, sourceFormat: project.format, targetFormat: target }) });
      const data = await res.json();
      if (data.repurposed) setRepurposeResult(data);
    } catch { /* silent */ }
    setRepurposeLoading(false);
  };

  const runTitleHook = async () => {
    if (!prompt.trim() || titleLoading) return;
    setTitleLoading(true); setTitleIdeas(null);
    try {
      const res = await fetch("/api/ai/title-hook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hook: prompt, format: project.format, topic: activeChap.title }) });
      const data = await res.json();
      if (data.titles) setTitleIdeas(data.titles);
    } catch { /* silent */ }
    setTitleLoading(false);
  };

  const runRetentionEdit = async () => {
    const script = activeChap.content;
    if (!script?.trim() || retentionLoading) return;
    setRetentionLoading(true); setRetentionEdit(null);
    try {
      const res = await fetch("/api/ai/retention-edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, format: project.format }) });
      const data = await res.json();
      if (data.edit) setRetentionEdit(data.edit);
    } catch { /* silent */ }
    setRetentionLoading(false);
  };

  useEffect(() => {
    return () => { if (dissectPollRef.current) clearInterval(dissectPollRef.current); };
  }, []);

  const startDissect = async () => {
    if (!dissectUrl.trim() || dissectLoading) return;
    setDissectLoading(true);
    setDissectResult(null);
    setDissectJobId(null);
    setDissectStatus("Starting analysis...");

    try {
      const res = await fetch("/api/ai/dissect-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: dissectUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDissectStatus("");
        setDissectLoading(false);
        return;
      }

      setDissectJobId(data.jobId);
      setDissectStatus("Watching the video… this takes 1–2 minutes");

      const poll = async () => {
        try {
          const statusRes = await fetch(`/api/ai/dissect-video/status/${data.jobId}`);
          const statusData = await statusRes.json();

          if (statusData.status === "complete") {
            setDissectResult(statusData.analysis);
            setDissectLoading(false);
            setDissectStatus("");
            clearInterval(dissectPollRef.current);
            dissectPollRef.current = null;
          } else if (statusData.status === "error") {
            setDissectLoading(false);
            setDissectStatus("");
            clearInterval(dissectPollRef.current);
            dissectPollRef.current = null;
          } else if (statusData.status === "processing") {
            setDissectStatus("Analysing structure and techniques…");
          }
        } catch { /* keep polling */ }
      };

      dissectPollRef.current = setInterval(poll, 4000);
    } catch {
      setDissectLoading(false);
      setDissectStatus("");
    }
  };

  const wordCount = (activeChap.content || "").trim().split(/\s+/).filter(Boolean).length;
  const totalWords = project.chapters.reduce((a: number, c: any) => a + (c.content || "").trim().split(/\s+/).filter(Boolean).length, 0);
  const visibleModes = project.format === "Podcast Episode"
    ? PODCAST_MODES
    : isStoryFormat(project.format)
    ? MODES
    : MODES.filter(m => m !== "dialogue");

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
        {["YouTube Long-form", "YouTube Short"].includes(project.format) && (
          <button style={{ ...sBtnSm, background: showDissect ? co.accentBg : co.surfaceAlt, color: showDissect ? co.accent : co.muted, fontWeight: showDissect ? 700 : 400, border: "1px solid " + (showDissect ? co.accent : co.border) }} onClick={() => { setShowDissect(v => !v); setShowAgents(false); setPipelineResults([]); }}>🎬 Dissect Video</button>
        )}
        <div style={{ flex: 1 }} />
        {mode === "write" && <span style={{ fontSize: 11, color: co.muted, background: co.surfaceAlt, padding: "4px 10px", borderRadius: 6 }}>{wordCount} words | {totalWords} total</span>}
        {mode === "write" && undoStack.length > 0 && <button style={{ ...sBtnSm, background: "#fff3e0", color: "#e65100" }} onClick={undoGeneration}>Undo AI</button>}
        {mode === "write" && isCreatorFormat(project.format) && activeChap.content?.trim() && (
          <>
            <button style={{ ...sBtnSm, background: "#fef3c7", color: "#d97706", fontWeight: 600, opacity: retentionLoading ? 0.5 : 1 }} disabled={retentionLoading} onClick={runRetentionEdit}>
              {retentionLoading ? "Analyzing..." : "📊 Retention Edit"}
            </button>
            {REPURPOSE_TARGETS[project.format]?.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <select style={{ ...sBtnSm, border: "1px solid " + co.border, background: co.surfaceAlt, color: co.text, padding: "4px 6px", fontSize: 11, cursor: "pointer" } as any} value={repurposeTarget} onChange={e => setRepurposeTarget(e.target.value)}>
                  {(REPURPOSE_TARGETS[project.format] || []).map(t => <option key={t}>{t}</option>)}
                </select>
                <button style={{ ...sBtnSm, background: "#ede9fe", color: "#7c3aed", fontWeight: 600, opacity: repurposeLoading ? 0.5 : 1 }} disabled={repurposeLoading} onClick={() => runRepurpose(repurposeTarget)}>
                  {repurposeLoading ? "..." : "♻️ Repurpose"}
                </button>
              </div>
            )}
          </>
        )}
        {project.format === "YouTube Long-form" && (mode === "brainstorm" || mode === "outline") && prompt.trim() && (
          <button style={{ ...sBtnSm, background: "#f0fdf4", color: "#15803d", fontWeight: 600, opacity: researchLoading ? 0.5 : 1 }} disabled={researchLoading} onClick={runResearchScaffold}>{researchLoading ? "Researching..." : "🔬 Research"}</button>
        )}
        {project.format === "Podcast Episode" && (mode === "brainstorm" || mode === "cohost") && prompt.trim() && (
          <button style={{ ...sBtnSm, background: "#fdf4ff", color: "#7e22ce", fontWeight: 600, opacity: guestLoading ? 0.5 : 1 }} disabled={guestLoading} onClick={runGuestIntel}>{guestLoading ? "Researching..." : "🎙 Guest Intel"}</button>
        )}
        {["TikTok Script", "YouTube Short", "Instagram Reel"].includes(project.format) && prompt.trim() && (
          <button style={{ ...sBtnSm, background: "#fef9c3", color: "#854d0e", fontWeight: 600, opacity: trendLoading ? 0.5 : 1 }} disabled={trendLoading} onClick={runTrendAngles}>{trendLoading ? "Searching..." : "📈 Trends"}</button>
        )}
        {(mode === "brainstorm" || mode === "outline") && streamText && (
          <>
            <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 600 }} onClick={() => {
              updateProject((p: any) => ({ ...p, notes: p.notes + (p.notes ? "\n\n---\n\n" : "") + "[" + mode.toUpperCase() + "]\n" + streamText }));
              setSavedMsg("Saved to notes"); setTimeout(() => setSavedMsg(""), 1500);
            }}>Save to Notes</button>
            <button style={{ ...sBtnSm, background: "#f0e6ff", color: "#7c3aed", fontWeight: 600 }} onClick={() => {
              const firstIdea = streamText.split("\n").find((l: string) => l.trim().length > 20) || streamText.substring(0, 150);
              setPrompt(firstIdea.replace(/^[-*•]\s*/, "").trim());
              setMode("write");
              setStreamText("");
            }}>✍️ Write This</button>
          </>
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

      {/* Dissect Video panel */}
      {showDissect && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 8 }}>🎬 Competitor Video Dissection</div>
          <div style={{ fontSize: 11, color: co.muted, marginBottom: 10 }}>Paste any public YouTube URL to see exactly how it's structured, what retention techniques it uses, and which angles it left open.</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input style={{ ...sInput, flex: 1 }} value={dissectUrl} onChange={e => setDissectUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            <button style={{ ...sBtn, opacity: dissectLoading || !dissectUrl.trim() ? 0.5 : 1 }} disabled={dissectLoading || !dissectUrl.trim()} onClick={startDissect}>{dissectLoading ? "Analysing..." : "Dissect"}</button>
          </div>
          {dissectLoading && (
            <div style={{ fontSize: 12, color: co.muted, padding: "12px 0" }}>
              <div style={{ marginBottom: 4 }}>⏳ {dissectStatus}</div>
              <div style={{ fontSize: 11, color: co.border }}>Processing in the background — results appear automatically</div>
            </div>
          )}
          {dissectResult && (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>Hook</div>
                <div style={{ fontSize: 12 }}><strong>{dissectResult.hookType}</strong> — "{dissectResult.openingLine}"</div>
              </div>
              {dissectResult.totalStructure?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Structure</div>
                  {dissectResult.totalStructure.map((s: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: co.muted, minWidth: 60, fontFamily: "monospace" }}>{s.timestamp}</span>
                      <span><strong>{s.section}</strong> — {s.technique}</span>
                    </div>
                  ))}
                </div>
              )}
              {dissectResult.whatToSteal?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>Steal these techniques</div>
                  {dissectResult.whatToSteal.map((t: string, i: number) => <div key={i} style={{ fontSize: 12, padding: "3px 0" }}>• {t}</div>)}
                </div>
              )}
              {dissectResult.freshAngles?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Angles this video left open</div>
                  {dissectResult.freshAngles.map((a: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, padding: "3px 0", cursor: "pointer", color: co.accent }} onClick={() => { setPrompt(a); setShowDissect(false); }}>→ {a}</div>
                  ))}
                </div>
              )}
            </div>
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
                  <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("tighten")}>✂️ Tighten</button>
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
          ) : mode === "cohost" ? (
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              {streamText ? (
                <div>
                  {streamText.split("\n").map((line: string, i: number) => (
                    <div key={i} style={{ marginBottom: line.startsWith("[CO-HOST]") || line.startsWith("[HOST TALKING POINTS]") ? 8 : 2, fontWeight: line.startsWith("[CO-HOST]") || line.startsWith("[HOST TALKING POINTS]") ? 700 : 400, color: line.startsWith("[CO-HOST]") ? co.accent : co.text, fontSize: 14, lineHeight: 1.7, fontFamily: "system-ui" }}>{line}</div>
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
              {streamText ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 15 }}>{mode === "brainstorm" ? "Ask a what-if or describe what you need" : "Describe what to outline"}</div>}
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
              : <input style={{ ...sInput, flex: 1 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={mode === "cohost" ? "Episode topic or segment to simulate..." : mode === "brainstorm" ? "What if..." : mode === "outline" ? "Outline..." : "Write the next scene..."} onKeyDown={e => e.key === "Enter" && !generating && generate()} />}
            {isCreatorFormat(project.format) && prompt.trim() && mode !== "cohost" && (
              <button style={{ ...sBtnSm, background: "#e0f2fe", color: "#0369a1", opacity: titleLoading ? 0.5 : 1 }} disabled={titleLoading} onClick={runTitleHook}>{titleLoading ? "..." : "💡 Title Ideas"}</button>
            )}
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{proseResult.mode === "expand" ? "✨ Expanded" : proseResult.mode === "rewrite" ? "🔄 Rewrites" : proseResult.mode === "tighten" ? "✂️ Tightened" : "👁 Show Don't Tell"}</h3>
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
                  <button style={{ ...sBtnSm, opacity: proseLoading ? 0.5 : 1 }} disabled={proseLoading} onClick={() => runProse("rewrite")}>{proseLoading ? "Regenerating..." : "↺ Regenerate"}</button>
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

      {/* Title Ideas Modal */}
      {titleIdeas && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setTitleIdeas(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 540, maxHeight: "70vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>💡 Title Ideas</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setTitleIdeas(null)}>×</button>
            </div>
            {titleIdeas.map((t: any, i: number) => (
              <div key={i} style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: co.text, flex: 1 }}>{t.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.ctrScore >= 8 ? "#16a34a" : t.ctrScore >= 5 ? "#d97706" : "#dc2626" }}>{t.ctrScore}/10</span>
                    <button style={{ ...sBtnSm, fontSize: 10 }} onClick={() => { navigator.clipboard.writeText(t.title); }}>Copy</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: co.muted, lineHeight: 1.5 }}>{t.alignment}</div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setTitleIdeas(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Research Scaffold Modal (D6) */}
      {researchScaffold && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setResearchScaffold(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 640, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔬 Research Brief</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setResearchScaffold(null)}>×</button>
            </div>
            {researchScaffold.error ? <div style={{ color: co.danger, fontSize: 13 }}>{researchScaffold.error}</div> : <>
              {researchScaffold.claims?.length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: 6 }}>Supporting Claims</div>{researchScaffold.claims.map((c: any, i: number) => <div key={i} style={{ background: "#f0fdf4", borderRadius: 6, padding: "8px 10px", marginBottom: 4, fontSize: 12 }}><div style={{ fontWeight: 600, marginBottom: 2 }}>{c.claim}</div><div style={{ color: co.muted, fontSize: 10 }}>{c.source}</div></div>)}</div>}
              {researchScaffold.counterArguments?.length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 6 }}>Counter-Arguments to Address</div>{researchScaffold.counterArguments.map((a: string, i: number) => <div key={i} style={{ background: "#fef2f2", borderRadius: 6, padding: "6px 10px", marginBottom: 3, fontSize: 12 }}>⚡ {a}</div>)}</div>}
              {researchScaffold.quotes?.length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Quotes & Expert Views</div>{researchScaffold.quotes.map((q: string, i: number) => <div key={i} style={{ background: co.accentBg, borderRadius: 6, padding: "6px 10px", marginBottom: 3, fontSize: 12, fontStyle: "italic" }}>"{q}"</div>)}</div>}
              {researchScaffold.angles?.length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 6 }}>Fresh Angles</div>{researchScaffold.angles.map((a: string, i: number) => <div key={i} style={{ background: "#fffbeb", borderRadius: 6, padding: "6px 10px", marginBottom: 3, fontSize: 12 }}>→ {a}</div>)}</div>}
            </>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setResearchScaffold(null)}>Close</button>
              {!researchScaffold.error && <button style={sBtn} onClick={() => { const text = [researchScaffold.claims?.map((c: any) => `• ${c.claim} (${c.source})`).join("\n"), researchScaffold.counterArguments?.map((a: string) => `Counter: ${a}`).join("\n")].filter(Boolean).join("\n\n"); updateProject((p: any) => ({ ...p, notes: (p.notes || "") + (p.notes ? "\n---\n" : "") + "[RESEARCH]\n" + text })); setSavedMsg("Saved to Notes"); setTimeout(() => setSavedMsg(""), 1500); setResearchScaffold(null); }}>Save to Notes</button>}
            </div>
          </div>
        </div>
      )}

      {/* Guest Intel Modal (D7) */}
      {guestIntel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setGuestIntel(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 620, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🎙 Guest Intel: {prompt}</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setGuestIntel(null)}>×</button>
            </div>
            {guestIntel.error ? <div style={{ color: co.danger, fontSize: 13 }}>{guestIntel.error}</div> : <>
              {guestIntel.background && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>Background</div><div style={{ fontSize: 12, lineHeight: 1.6, color: co.text }}>{guestIntel.background}</div></div>}
              {guestIntel.recentWork?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: 4 }}>Recent Work</div>{guestIntel.recentWork.map((w: string, i: number) => <div key={i} style={{ fontSize: 12, background: "#f0fdf4", borderRadius: 4, padding: "4px 8px", marginBottom: 2 }}>• {w}</div>)}</div>}
              {guestIntel.strongOpinions?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 4 }}>Strong Opinions</div>{guestIntel.strongOpinions.map((o: string, i: number) => <div key={i} style={{ fontSize: 12, background: "#fffbeb", borderRadius: 4, padding: "4px 8px", marginBottom: 2 }}>⚡ {o}</div>)}</div>}
              {guestIntel.questions?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>Questions to Ask</div>{guestIntel.questions.map((q: string, i: number) => <div key={i} style={{ background: co.accentBg, borderRadius: 6, padding: "8px 10px", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Q{i+1}: {q}</div>)}</div>}
              {guestIntel.topicsToAvoid?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 4 }}>Avoid</div>{guestIntel.topicsToAvoid.map((t: string, i: number) => <div key={i} style={{ fontSize: 12, background: "#fef2f2", borderRadius: 4, padding: "4px 8px", marginBottom: 2 }}>✕ {t}</div>)}</div>}
            </>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setGuestIntel(null)}>Close</button>
              {!guestIntel.error && <button style={sBtn} onClick={() => { const text = `Guest: ${prompt}\n\nQuestions:\n${guestIntel.questions?.map((q: string, i: number) => `${i+1}. ${q}`).join("\n") || ""}${guestIntel.topicsToAvoid?.length ? "\n\nAvoid: " + guestIntel.topicsToAvoid.join(", ") : ""}`; updateProject((p: any) => ({ ...p, notes: (p.notes || "") + (p.notes ? "\n---\n" : "") + "[GUEST INTEL]\n" + text })); setSavedMsg("Saved to Notes"); setTimeout(() => setSavedMsg(""), 1500); setGuestIntel(null); }}>Save to Notes</button>}
            </div>
          </div>
        </div>
      )}

      {/* Trend Angles Modal (D9) */}
      {trendAngles && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setTrendAngles(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 560, maxHeight: "75vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📈 Trend Angles</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setTrendAngles(null)}>×</button>
            </div>
            {trendAngles.error ? <div style={{ color: co.danger, fontSize: 13 }}>{trendAngles.error}</div> : <>
              {trendAngles.angles?.map((a: any, i: number) => (
                <div key={i} style={{ background: co.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8, border: "1px solid " + co.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: co.text, flex: 1 }}>{a.angle}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: a.trendScore >= 8 ? "#16a34a" : a.trendScore >= 5 ? "#d97706" : "#dc2626", marginLeft: 8 }}>🔥 {a.trendScore}/10</span>
                  </div>
                  <div style={{ fontSize: 12, color: co.accent, fontStyle: "italic", marginBottom: 4 }}>Hook: "{a.hook}"</div>
                  <div style={{ fontSize: 11, color: co.muted }}>{a.why}</div>
                  <button style={{ ...sBtnSm, marginTop: 8, fontSize: 10 }} onClick={() => { setPrompt(a.hook); setTrendAngles(null); }}>Use Hook</button>
                </div>
              ))}
            </>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setTrendAngles(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Repurpose Modal */}
      {repurposeResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setRepurposeResult(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 620, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>♻️ Repurposed for {repurposeResult.targetFormat}</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setRepurposeResult(null)}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 6 }}>Best Moment Extracted</div>
              <div style={{ padding: 12, background: co.accentBg, borderRadius: 8, fontSize: 12, color: co.muted, lineHeight: 1.6, fontStyle: "italic", borderLeft: "3px solid " + co.accent }}>{repurposeResult.bestMoment}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Repurposed Script</div>
              <div style={{ padding: 16, background: co.surfaceAlt, borderRadius: 10, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", border: "1px solid " + co.border }}>{repurposeResult.repurposed}</div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={sBtnSm} onClick={() => setRepurposeResult(null)}>Discard</button>
              <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent }} onClick={() => { navigator.clipboard.writeText(repurposeResult.repurposed); setSavedMsg("Copied!"); setTimeout(() => setSavedMsg(""), 1500); }}>Copy</button>
              <button style={sBtn} onClick={() => {
                updateProject((p: any) => ({ ...p, notes: (p.notes || "") + (p.notes ? "\n---\n" : "") + "[REPURPOSE:" + repurposeResult.targetFormat.toUpperCase() + "]\n" + repurposeResult.repurposed }));
                setSavedMsg("Saved to Notes"); setTimeout(() => setSavedMsg(""), 1500);
                setRepurposeResult(null);
              }}>Save to Notes</button>
            </div>
          </div>
        </div>
      )}

      {/* Retention Edit Modal */}
      {retentionEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setRetentionEdit(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 620, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 Retention Edit</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setRetentionEdit(null)}>×</button>
            </div>
            {retentionEdit.strongPoints?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>What's Working</div>
                {retentionEdit.strongPoints.map((p: string, i: number) => <div key={i} style={{ fontSize: 12, color: co.text, background: "#f0fdf4", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>✓ {p}</div>)}
              </div>
            )}
            {retentionEdit.missingElements?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 6 }}>Missing Elements</div>
                {retentionEdit.missingElements.map((p: string, i: number) => <div key={i} style={{ fontSize: 12, color: co.text, background: "#fffbeb", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>⚠ {p}</div>)}
              </div>
            )}
            {retentionEdit.issues?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 6 }}>Line-Level Issues</div>
                {retentionEdit.issues.map((issue: any, i: number) => (
                  <div key={i} style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: "3px solid " + co.danger }}>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>📍 "{issue.location}"</div>
                    <div style={{ fontSize: 12, color: co.text, marginBottom: 4 }}><strong>Problem:</strong> {issue.problem}</div>
                    <div style={{ fontSize: 12, color: co.accent }}><strong>Fix:</strong> {issue.fix}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={sBtnSm} onClick={() => setRetentionEdit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
