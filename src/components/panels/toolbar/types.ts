// src/components/panels/toolbar/types.ts
// Shared prop types used across ToolbarPanel subcomponents.

export interface HookScore {
  score: number;
  feedback: string;
}

export interface ProseResult {
  mode: string;
  variants?: string[];
  result?: string;
  chosen?: number;
}
