"use client";
import type { HookScore } from "../types";
import { sBtnSm } from "@/lib/styles";

interface Props {
  format: string;
  prompt: string;
  hookScore: HookScore | null;
  hookScoring: boolean;
  scoreHook: () => Promise<void>;
}

const SCORE_FORMATS = ["TikTok Script", "YouTube Short", "Instagram Reel"];

/** Renders the Score Hook button + score display in the prompt bar. */
export function ScoreHookPanel({ format, prompt, hookScore, hookScoring, scoreHook }: Props) {
  if (!SCORE_FORMATS.includes(format) || !prompt.trim()) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <button
        style={{ ...sBtnSm, opacity: hookScoring || !prompt.trim() ? 0.5 : 1 }}
        disabled={hookScoring || !prompt.trim()}
        onClick={scoreHook}
      >
        {hookScoring ? "Scoring..." : "Score Hook"}
      </button>
      {hookScore && (
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: hookScore.score >= 8 ? "#22c55e" : hookScore.score >= 5 ? "#eab308" : "#ef4444" }}>
            {hookScore.score >= 8 ? "🟢" : hookScore.score >= 5 ? "🟡" : "🔴"} {hookScore.score}/10
          </span>
          <div style={{ fontSize: 10, color: "#777", maxWidth: 100, lineHeight: 1.3, marginTop: 2 }}>{hookScore.feedback}</div>
        </div>
      )}
    </div>
  );
}
