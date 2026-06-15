"use client";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { type Pipeline } from "@/lib/ai/pipelines";
import { getWordCount } from "@/lib/editor/content-migration";
import { appendToTipTap } from "./ai-shared";

export function usePipelines({ project, prompt, mode, activeChap, updateChapter, setUndoStack, setStreamText, buildFullContext }: {
  project: any; prompt: string; mode: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  setUndoStack: React.Dispatch<React.SetStateAction<string[]>>;
  setStreamText: React.Dispatch<React.SetStateAction<string>>;
  buildFullContext: (p?: any) => string;
}) {
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<{ agent: string; output: string }[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [qualityReview, setQualityReview] = useState<any | null>(null);

  const runPipeline = async (pipeline: Pipeline) => {
    if (pipelineRunning || !prompt.trim()) return;
    setPipelineRunning(true); setActivePipelineId(pipeline.id); setPipelineResults([]); setExpandedAgent(null);
    try {
      const res = await fetch("/api/ai/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: pipeline.agents, prompt, context: buildFullContext(), format: project.format }),
      });
      const data = await res.json();
      if (data.results?.length) { setPipelineResults(data.results); setExpandedAgent(data.results[data.results.length - 1].agent); }
    } catch (e) { toast.error("Agent pipeline failed. Please try again."); }
    setPipelineRunning(false);
  };

  const usePipelineOutput = (output: string) => {
    if (mode === "write") {
      setUndoStack(s => [...s.slice(-9), activeChap.content]);
      const merged = appendToTipTap(activeChap.content, output);
      updateChapter("content", merged);
      updateChapter("wordCount", getWordCount(merged));
    } else { setStreamText(output); }
    setPipelineResults([]);
  };

  const runQualityCheck = async (output: string, projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/quality-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output,
          projectRules: project.aiRules?.map((r: any) => r.text) ?? [],
          involvedCharacters: project.characters
            ?.filter((c: any) => c.alwaysInContext !== false)
            ?.map((c: any) => ({
              name: c.name,
              knowledgeMap: c.knowledgeMap ?? {},
              nvcBaseline: c.kinesicsBaseline,
            })) ?? [],
          emotionalTone: activeChap.emotionalTone,
          arcPosition: activeChap.arcPosition,
        }),
      });
      const result = await res.json();
      if (result.hasIssues) setQualityReview(result);
    } catch { /* quality check must never break writing flow */ }
  };

  return {
    pipelineRunning, pipelineResults, setPipelineResults, expandedAgent, setExpandedAgent, activePipelineId,
    qualityReview, setQualityReview,
    runPipeline, usePipelineOutput, runQualityCheck,
  };
}
