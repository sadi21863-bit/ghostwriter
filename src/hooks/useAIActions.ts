"use client";
import { useState } from "react";
import { buildStaticContext, buildDynamicContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { isCreatorFormat } from "@/lib/formats";
import { callAI, buildNeighbourContext } from "./ai-shared";
import { useEntitySync } from "./useEntitySync";
import { usePipelines } from "./usePipelines";
import { useProseTools } from "./useProseTools";
import { useGeneration } from "./useGeneration";

export function useAIActions({
  project, mode, prompt, activeChap,
  updateChapter, updateProject, setErrorMsg, setSavedMsg,
  creatorBible, cohostVoice, setUpgradeRequired,
  activeInfluence, activePatterns, writingRoomEnabled,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  updateProject?: (fn: (p: any) => any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSavedMsg: (msg: string) => void;
  creatorBible: any;
  cohostVoice?: string;
  setUpgradeRequired?: (feature: string) => void;
  activeInfluence?: any;
  activePatterns?: any[];
  writingRoomEnabled?: boolean;
}) {
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [streamText, setStreamText] = useState("");

  const buildFullContext = (p = project) => {
    const extended = { ...p, activeMode: mode, currentPrompt: prompt, activeInfluence, activePatterns };
    let base: string;
    if (isCreatorFormat(p.format)) { base = buildCreatorContext({ ...extended, creatorBible }); }
    else { base = p.skillLevel === "beginner" ? buildBeginnerContext(extended) : (buildStaticContext(extended, mode) + '\n' + buildDynamicContext(extended, mode)); }
    const neighbourContext = buildNeighbourContext(p);
    return neighbourContext ? base + "\n\n" + neighbourContext : base;
  };

  const undoGeneration = () => {
    if (!undoStack.length) return;
    updateChapter("content", undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
  };

  const entitySync = useEntitySync({ project, updateProject });
  const pipelines = usePipelines({ project, prompt, mode, activeChap, updateChapter, setUndoStack, setStreamText, buildFullContext });
  const proseTools = useProseTools({ activeChap, mode, updateChapter, buildFullContext });
  const generation = useGeneration({
    project, mode, prompt, activeChap, updateChapter, updateProject, setUpgradeRequired,
    creatorBible, cohostVoice, activeInfluence, activePatterns, writingRoomEnabled,
    setUndoStack, setStreamText, buildFullContext,
    runQualityCheck: pipelines.runQualityCheck,
    runEntityExtraction: entitySync.runEntityExtraction,
  });

  return {
    ...generation,
    ...pipelines,
    ...proseTools,
    ...entitySync,
    undoStack, undoGeneration,
    streamText, setStreamText,
    callAI, buildNeighbourContext, buildFullContext,
  };
}
