"use client";
import { useState } from "react";
import ComicStudio from "@/components/ComicStudio";
import ProductionStudio from "@/components/ProductionStudio";
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
import { HorrorPanel } from "./toolbar/modes/HorrorPanel";
import { ComedyPanel } from "./toolbar/modes/ComedyPanel";
import { MysteryPanel } from "./toolbar/modes/MysteryPanel";
import { RomancePanel } from "./toolbar/modes/RomancePanel";
import { ActionPanel } from "./toolbar/modes/ActionPanel";
import { MonologuePanel } from "./toolbar/modes/MonologuePanel";
import { VoicePanel } from "./toolbar/modes/VoicePanel";
import { ThrillerPanel } from "./toolbar/modes/ThrillerPanel";
import { SportsPanel } from "./toolbar/modes/SportsPanel";

// Tool panels
import { PipelinePanel } from "./toolbar/tools/PipelinePanel";
import { DissectPanel } from "./toolbar/tools/DissectPanel";
import { RetentionEditPanel } from "./toolbar/tools/RetentionEditPanel";
import { RepurposePanel } from "./toolbar/tools/RepurposePanel";
import { ResearchScaffoldPanel } from "./toolbar/tools/ResearchScaffoldPanel";
import { GuestIntelPanel } from "./toolbar/tools/GuestIntelPanel";
import { TrendAnglesPanel } from "./toolbar/tools/TrendAnglesPanel";
import { HookABPanel } from "./toolbar/tools/HookABPanel";
import { ThumbnailConceptsPanel } from "./toolbar/tools/ThumbnailConceptsPanel";

import type { HookScore, ProseResult } from "./toolbar/types";
import type { CompositionLayer } from "@/lib/ai/composer";
import type { Pipeline } from "@/lib/ai/pipelines";

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
  horrorArchetype: string;
  setHorrorArchetype: (v: string) => void;
  generateHorror: (archetypeName: string, prompt: string) => Promise<void>;
  comedyArchetype: string;
  setComedyArchetype: (v: string) => void;
  generateComedy: (archetypeName: string, prompt: string) => Promise<void>;
  mysteryArchetype: string;
  setMysteryArchetype: (v: string) => void;
  generateMystery: (archetypeName: string, prompt: string) => Promise<void>;
  romanceArchetype: string;
  setRomanceArchetype: (v: string) => void;
  generateRomance: (archetypeName: string, prompt: string) => Promise<void>;
  actionArchetype: string;
  setActionArchetype: (v: string) => void;
  generateAction: (archetypeName: string, prompt: string) => Promise<void>;
  monologueArchetype: string;
  setMonologueArchetype: (v: string) => void;
  generateMonologue: (archetypeName: string, prompt: string) => Promise<void>;
  voiceProfile: string;
  setVoiceProfile: (v: string) => void;
  generateVoice: (profileName: string, prompt: string) => Promise<void>;
  thrillerArchetype: string;
  setThrillerArchetype: (v: string) => void;
  generateThriller: (archetypeName: string, prompt: string) => Promise<void>;
  sportsArchetype: string;
  setSportsArchetype: (v: string) => void;
  generateSports: (archetypeName: string, prompt: string) => Promise<void>;
  setUpgradeRequired?: (feature: string) => void;
}

const modeLabel = (m: string) => (
  ({
    brainstorm: "Brainstorm", outline: "Outline", write: "Write",
    dialogue: "Dialogue", combat: "Combat", cohost: "Co-host",
    emotional: "Emotional", atmosphere: "Atmosphere", tension: "Tension",
    composition: "Composition", horror: "Horror", comedy: "Comedy",
    mystery: "Mystery", romance: "Romance", action: "Action",
    monologue: "Monologue", voice: "Voice", thriller: "Thriller", sports: "Sports",
  } as Record<string, string>)[m] ?? m
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
    horrorArchetype, setHorrorArchetype, generateHorror,
    comedyArchetype, setComedyArchetype, generateComedy,
    mysteryArchetype, setMysteryArchetype, generateMystery,
    romanceArchetype, setRomanceArchetype, generateRomance,
    actionArchetype, setActionArchetype, generateAction,
    monologueArchetype, setMonologueArchetype, generateMonologue,
    voiceProfile, setVoiceProfile, generateVoice,
    thrillerArchetype, setThrillerArchetype, generateThriller,
    sportsArchetype, setSportsArchetype, generateSports,
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
    : MODES.filter(m => m !== "dialogue" && m !== "combat" && m !== "horror" && m !== "comedy");

  const isCreator = isCreatorFormat(project.format);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>

      {/* ── Toolbar row ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: co.surface, borderBottom: "1px solid " + co.border, flexShrink: 0, flexWrap: "wrap" }}>

        {/* Mode selector */}
        <div style={{ display: "flex", gap: 4, background: co.surfaceAlt, borderRadius: 10, padding: 3, flexWrap: "wrap" }}>
          {visibleModes.map(m => (
            <button key={m}
              style={{ padding: "6px 14px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, background: mode === m ? co.accent : "transparent", color: mode === m ? "#fff" : co.muted }}
              onClick={() => setMode(m)}>
              {modeLabel(m)}
            </button>
          ))}
        </div>

        {/* Dissect Video — first for creator formats (Phase 5 reorder) */}
        {["YouTube Long-form", "YouTube Short"].includes(project.format) && (
          <button style={{ ...sBtnSm, background: showDissect ? co.accentBg : co.surfaceAlt, color: showDissect ? co.accent : co.muted, fontWeight: showDissect ? 700 : 400, border: "1px solid " + (showDissect ? co.accent : co.border) }}
            onClick={() => { setShowDissect(v => !v); setShowAgents(false); setPipelineResults([]); }}>
            🎬 Dissect Video
          </button>
        )}

        {/* Agent pipelines toggle */}
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

        {/* Hook A/B — creator only (Phase 5) */}
        <HookABPanel format={project.format} onUpgradeRequired={setUpgradeRequired} />

        {/* Thumbnail Concepts — YouTube only (Phase 5) */}
        <ThumbnailConceptsPanel format={project.format} onUpgradeRequired={setUpgradeRequired} />

        {/* Retention Edit */}
        <RetentionEditPanel
          format={project.format}
          mode={mode}
          content={activeChap.content}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Repurpose */}
        <RepurposePanel
          format={project.format}
          mode={mode}
          content={activeChap.content}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Research Scaffold */}
        <ResearchScaffoldPanel
          format={project.format}
          mode={mode}
          prompt={prompt}
          topic={activeChap.title}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Guest Intel */}
        <GuestIntelPanel
          format={project.format}
          mode={mode}
          prompt={prompt}
          topic={activeChap.title}
          setSavedMsg={setSavedMsg}
          updateProject={updateProject}
          onUpgradeRequired={setUpgradeRequired}
        />

        {/* Trend Angles */}
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

      {/* ── Agent pipelines panel (extracted) ───────────────────────────── */}
      <PipelinePanel
        show={showAgents}
        pipelineRunning={pipelineRunning}
        pipelineResults={pipelineResults}
        setPipelineResults={setPipelineResults}
        expandedAgent={expandedAgent}
        setExpandedAgent={setExpandedAgent}
        activePipelineId={activePipelineId}
        runPipeline={runPipeline}
        usePipelineOutput={usePipelineOutput}
        prompt={prompt}
        format={project.format}
        mode={mode}
      />

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
        : mode === "horror"
        ? <HorrorPanel
            horrorArchetype={horrorArchetype} setHorrorArchetype={setHorrorArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateHorror={generateHorror}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "comedy"
        ? <ComedyPanel
            comedyArchetype={comedyArchetype} setComedyArchetype={setComedyArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateComedy={generateComedy}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "mystery"
        ? <MysteryPanel
            mysteryArchetype={mysteryArchetype} setMysteryArchetype={setMysteryArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateMystery={generateMystery}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "romance"
        ? <RomancePanel
            romanceArchetype={romanceArchetype} setRomanceArchetype={setRomanceArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateRomance={generateRomance}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "action"
        ? <ActionPanel
            actionArchetype={actionArchetype} setActionArchetype={setActionArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateAction={generateAction}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "monologue"
        ? <MonologuePanel
            monologueArchetype={monologueArchetype} setMonologueArchetype={setMonologueArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateMonologue={generateMonologue}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "voice"
        ? <VoicePanel
            voiceProfile={voiceProfile} setVoiceProfile={setVoiceProfile}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateVoice={generateVoice}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "thriller"
        ? <ThrillerPanel
            thrillerArchetype={thrillerArchetype} setThrillerArchetype={setThrillerArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateThriller={generateThriller}
            updateChapter={updateChapter} activeChap={activeChap}
          />
        : mode === "sports"
        ? <SportsPanel
            sportsArchetype={sportsArchetype} setSportsArchetype={setSportsArchetype}
            generating={generating} streamText={streamText} setStreamText={setStreamText}
            prompt={prompt} setPrompt={setPrompt}
            generateSports={generateSports}
            updateChapter={updateChapter} activeChap={activeChap}
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
