"use client";
import { useState } from "react";
import ComicStudio from "@/components/ComicStudio";
import ProductionStudio from "@/components/ProductionStudio";
import { getPipelines, AGENT_LABELS, type Pipeline, type AgentKey } from "@/lib/ai/pipelines";
import { MODES, PODCAST_MODES, isStoryFormat, isCreatorFormat } from "@/lib/formats";
import { co, sBtn, sBtnSm } from "@/lib/styles";

// Mode panels
import { DialoguePanel } from "./toolbar/modes/DialoguePanel";
import { CombatPanel } from "./toolbar/modes/CombatPanel";
import { EmotionalPanel } from "./toolbar/modes/EmotionalPanel";
import { AtmospherePanel } from "./toolbar/modes/AtmospherePanel";
import { TensionPanel } from "./toolbar/modes/TensionPanel";
import { WritePanel } from "./toolbar/modes/WritePanel";
import { CompositionPanel } from "./toolbar/modes/CompositionPanel";

// Tool panels
import { DissectPanel } from "./toolbar/tools/DissectPanel";
import { RetentionEditPanel } from "./toolbar/tools/RetentionEditPanel";
import { RepurposePanel } from "./toolbar/tools/RepurposePanel";
import { ResearchScaffoldPanel } from "./toolbar/tools/ResearchScaffoldPanel";
import { GuestIntelPanel } from "./toolbar/tools/GuestIntelPanel";
import { TrendAnglesPanel } from "./toolbar/tools/TrendAnglesPanel";

import type { HookScore, ProseResult } from "./toolbar/types";
import type { CompositionLayer } from "@/lib/ai/composer";

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
  proseResult: ProseResult | null;
  setProseResult: (v: ProseResult | null) => void;
  runProse: (mode: string) => Promise<void>;
  replaceSelection: (text: string) => void;
  hookScore: HookScore | null;
  hookScoring: boolean;
  scoreHook: () => Promise<void>;
  generate: () => Promise<void>;
  generateDialogue: (charAId: string, charBId: string, prompt: string, archetypeName: string) => Promise<void>;
  generateCombat: (styleA: string, styleB: string, prompt: string) => Promise<void>;
  updateProject: (fn: any) => void;
  handleTextareaSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  setSavedMsg: (m: string) => void;
  dialogueCharA: string;
  setDialogueCharA: (id: string) => void;
  dialogueCharB: string;
  setDialogueCharB: (id: string) => void;
  dialogueArchetype: string;
  setDialogueArchetype: (v: string) => void;
  combatStyleA: string;
  setCombatStyleA: (v: string) => void;
  combatStyleB: string;
  setCombatStyleB: (v: string) => void;
  cohostVoice: string;
  setCohostVoice: (v: string) => void;
  emotionalEmotion: string;
  setEmotionalEmotion: (v: string) => void;
  atmosphereEnvironment: string;
  setAtmosphereEnvironment: (v: string) => void;
  tensionType: string;
  setTensionType: (v: string) => void;
  generateEmotionalScene: (emotionName: string, prompt: string) => Promise<void>;
  generateAtmosphere: (environmentName: string, prompt: string) => Promise<void>;
  generateTension: (tensionType: string, prompt: string) => Promise<void>;
  compositionLayers: CompositionLayer[];
  setCompositionLayers: (layers: CompositionLayer[]) => void;
  generateComposition: (layers: CompositionLayer[], prompt: string) => Promise<void>;
  setUpgradeRequired?: (feature: string) => void;
}

const modeLabel = (m: string) => (
  ({ brainstorm: "Brainstorm", outline: "Outline", write: "Write", dialogue: "Dialogue", combat: "Combat", cohost: "Co-host", emotional: "Emotional", atmosphere: "Atmosphere", tension: "Tension", composition: "Composition" } as Record<string, string>)[m] ?? m
);

export default function ToolbarPanel(props: Props) {
  const {
    project, higgsfieldKey, mode, setMode, activeChap, updateChapter,
    prompt, setPrompt, expandedPrompt, setExpandedPrompt,
    showAgents, setShowAgents, showComicStudio, setShowComicStudio, showProductionStudio, setShowProductionStudio,
    generating, genTarget, streamText, setStreamText, undoStack, undoGeneration,
    pipelineRunning, pipelineResults, setPipelineResults, expandedAgent, setExpandedAgent, activePipelineId,
    runPipeline, usePipelineOutput,
    selectedText, setSelectedText, setSelectedRange, proseLoading, proseResult, setProseResult, runProse, replaceSelection,
    hookScore, hookScoring, scoreHook, generate, generateDialogue, generateCombat, updateProject, handleTextareaSelect, setSavedMsg,
    dialogueCharA, setDialogueCharA, dialogueCharB, setDialogueCharB,
    dialogueArchetype, setDialogueArchetype,
    combatStyleA, setCombatStyleA, combatStyleB, setCombatStyleB,
    cohostVoice, setCohostVoice,
    emotionalEmotion, setEmotionalEmotion,
    atmosphereEnvironment, setAtmosphereEnvironment,
    tensionType, setTensionType,
    generateEmotionalScene, generateAtmosphere, generateTension,
    compositionLayers, setCompositionLayers, generateComposition,
    setUpgradeRequired,
  } = props;

  // Local UI toggle (not business logic)
  const [showDissect, setShowDissect] = useState(false);

  const wordCount = (activeChap.content || "").trim().split(/\s+/).filter(Boolean).length;
  const totalWords = project.chapters.reduce((a: number, c: any) => a + (c.content || "").trim().split(/\s+/).filter(Boolean).length, 0);

  const visibleModes = project.format === "Podcast Episode"
    ? PODCAST_MODES
    : isStoryFormat(project.format)
    ? MODES
    : MODES.filter(m => m !== "dialogue" && m !== "combat");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>

      {/* ── Toolbar row ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: co.surface, borderBottom: "1px solid " + co.border, flexShrink: 0 }}>

        {/* Mode selector */}
        <div style={{ display: "flex", gap: 4, background: co.surfaceAlt, borderRadius: 10, padding: 3 }}>
          {visibleModes.map(m => (
            <button key={m}
              style={{ padding: "6px 16px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, background: mode === m ? co.accent : "transparent", color: mode === m ? "#fff" : co.muted }}
              onClick={() => setMode(m)}>
              {modeLabel(m)}
            </button>
          ))}
        </div>

        {/* View toggles */}
        <button style={{ ...sBtnSm, background: showAgents ? co.accentBg : co.surfaceAlt, color: showAgents ? co.accent : co.muted, fontWeight: showAgents ? 700 : 400, border: "1px solid " + (showAgents ? co.accent : co.border) }}
          onClick={() => { setShowAgents((v: boolean) => !v); setPipelineResults([]); setShowComicStudio(false); setShowProductionStudio(false); }}>
          ⚡ Agents
        </button>
        {isStoryFormat(project.format) && (
          <button style={{ ...sBtnSm, background: showComicStudio ? co.accentBg : co.surfaceAlt, color: showComicStudio ? co.accent : co.muted, fontWeight: showComicStudio ? 700 : 400, border: "1px solid " + (showComicStudio ? co.accent : co.border) }}
            onClick={() => { setShowComicStudio((v: boolean) => !v); setShowProductionStudio(false); setShowAgents(false); setPipelineResults([]); }}>
            🎨 Comics
          </button>
        )}
        {isStoryFormat(project.format) && (
          <button style={{ ...sBtnSm, background: showProductionStudio ? co.accentBg : co.surfaceAlt, color: showProductionStudio ? co.accent : co.muted, fontWeight: showProductionStudio ? 700 : 400, border: "1px solid " + (showProductionStudio ? co.accent : co.border) }}
            onClick={() => { setShowProductionStudio((v: boolean) => !v); setShowComicStudio(false); setShowAgents(false); setPipelineResults([]); }}>
            🎬 Studio
          </button>
        )}
        {["YouTube Long-form", "YouTube Short"].includes(project.format) && (
          <button style={{ ...sBtnSm, background: showDissect ? co.accentBg : co.surfaceAlt, color: showDissect ? co.accent : co.muted, fontWeight: showDissect ? 700 : 400, border: "1px solid " + (showDissect ? co.accent : co.border) }}
            onClick={() => { setShowDissect(v => !v); setShowAgents(false); setPipelineResults([]); }}>
            🎬 Dissect Video
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Word count */}
        {mode === "write" && (
          <span style={{ fontSize: 11, color: co.muted, background: co.surfaceAlt, padding: "4px 10px", borderRadius: 6 }}>
            {wordCount} words | {totalWords} total
          </span>
        )}

        {/* Undo AI */}
        {mode === "write" && undoStack.length > 0 && (
          <button style={{ ...sBtnSm, background: "#fff3e0", color: "#e65100" }} onClick={undoGeneration}>Undo AI</button>
        )}

        {/* Retention Edit (owns state, renders button + modal) */}
        <RetentionEditPanel
          format={project.format}
          mode={mode}
          content={activeChap.content}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Repurpose (owns state, renders select + button + modal) */}
        <RepurposePanel
          format={project.format}
          mode={mode}
          content={activeChap.content}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Research Scaffold (owns state, renders button + modal) */}
        <ResearchScaffoldPanel
          format={project.format}
          mode={mode}
          prompt={prompt}
          topic={activeChap.title}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Guest Intel (owns state, renders button + modal) */}
        <GuestIntelPanel
          format={project.format}
          mode={mode}
          prompt={prompt}
          topic={activeChap.title}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Trend Angles (owns state, renders button + modal) */}
        <TrendAnglesPanel
          format={project.format}
          prompt={prompt}
          setPrompt={setPrompt}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Save to Notes / Write This — brainstorm + outline result actions */}
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

      {/* ── Agent pipelines panel ────────────────────────────────────────── */}
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
                        {pipeline.agents.map((a: AgentKey) => <span key={a} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: co.accentBg, color: co.accent, fontWeight: 600 }}>{AGENT_LABELS[a]}</span>)}
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

      {/* ── Dissect Video panel ──────────────────────────────────────────── */}
      <DissectPanel show={showDissect} setPrompt={setPrompt} />

      {/* ── Main content area — mode routing ────────────────────────────── */}
      {showComicStudio
        ? <ComicStudio project={project} higgsfieldKey={higgsfieldKey} onOpenStudio={() => { setShowComicStudio(false); setShowProductionStudio(true); }} />
        : showProductionStudio
        ? <ProductionStudio project={project} higgsfieldKey={higgsfieldKey} />
        : mode === "dialogue"
        ? <DialoguePanel
            project={project}
            dialogueCharA={dialogueCharA} setDialogueCharA={setDialogueCharA}
            dialogueCharB={dialogueCharB} setDialogueCharB={setDialogueCharB}
            dialogueArchetype={dialogueArchetype} setDialogueArchetype={setDialogueArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateDialogue={generateDialogue}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "combat"
        ? <CombatPanel
            combatStyleA={combatStyleA} setCombatStyleA={setCombatStyleA}
            combatStyleB={combatStyleB} setCombatStyleB={setCombatStyleB}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateCombat={generateCombat}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "emotional"
        ? <EmotionalPanel
            emotionalEmotion={emotionalEmotion} setEmotionalEmotion={setEmotionalEmotion}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateEmotionalScene={generateEmotionalScene}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "atmosphere"
        ? <AtmospherePanel
            atmosphereEnvironment={atmosphereEnvironment} setAtmosphereEnvironment={setAtmosphereEnvironment}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateAtmosphere={generateAtmosphere}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "tension"
        ? <TensionPanel
            tensionType={tensionType} setTensionType={setTensionType}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateTension={generateTension}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "composition"
        ? <CompositionPanel
            compositionLayers={compositionLayers}
            setCompositionLayers={setCompositionLayers}
            generating={generating}
            streamText={streamText}
            setStreamText={setStreamText}
            prompt={prompt}
            setPrompt={setPrompt}
            generateComposition={generateComposition}
            updateChapter={updateChapter}
            activeChap={activeChap}
          />
        : <WritePanel
            mode={mode}
            project={project}
            activeChap={activeChap}
            updateChapter={updateChapter}
            generating={generating}
            genTarget={genTarget}
            streamText={streamText}
            setStreamText={setStreamText}
            prompt={prompt}
            setPrompt={setPrompt}
            expandedPrompt={expandedPrompt}
            setExpandedPrompt={setExpandedPrompt}
            selectedText={selectedText}
            setSelectedText={setSelectedText}
            setSelectedRange={setSelectedRange}
            proseLoading={proseLoading}
            proseResult={proseResult}
            setProseResult={setProseResult}
            runProse={runProse}
            replaceSelection={replaceSelection}
            hookScore={hookScore}
            hookScoring={hookScoring}
            scoreHook={scoreHook}
            generate={generate}
            cohostVoice={cohostVoice}
            setCohostVoice={setCohostVoice}
            handleTextareaSelect={handleTextareaSelect}
            onUpgradeRequired={setUpgradeRequired}
          />
      }
    </div>
  );
}
