"use client";
import { useState } from "react";
import { toast } from "@/lib/toast";

export function useProseTools({ activeChap, mode, updateChapter, buildFullContext }: {
  activeChap: any;
  mode: string;
  updateChapter: (f: string, v: any) => void;
  buildFullContext: (p?: any) => string;
}) {
  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [proseResult, setProseResult] = useState<{ mode: string; variants?: string[]; result?: string; chosen?: number } | null>(null);
  const [proseLoading, setProseLoading] = useState(false);

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const selected = el.value.substring(el.selectionStart, el.selectionEnd);
    if (selected.trim().length > 10) { setSelectedText(selected); setSelectedRange({ start: el.selectionStart, end: el.selectionEnd }); }
    else { setSelectedText(""); setSelectedRange(null); }
  };

  const runProse = async (proseMode: string) => {
    if (!selectedText || proseLoading) return;
    setProseLoading(true); setProseResult(null);
    try {
      const res = await fetch("/api/ai/prose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, mode: proseMode, projectContext: buildFullContext(), activeMode: mode }),
      });
      const data = await res.json();
      setProseResult({ mode: proseMode, ...data, chosen: 0 });
    } catch (e) { toast.error("Prose tool failed. Please try again."); }
    setProseLoading(false);
  };

  const replaceSelection = (newText: string) => {
    if (!selectedRange) return;
    const content = activeChap.content || "";
    const updated = content.substring(0, selectedRange.start) + newText + content.substring(selectedRange.end);
    updateChapter("content", updated);
    setProseResult(null); setSelectedText(""); setSelectedRange(null);
  };

  return { selectedText, setSelectedText, selectedRange, setSelectedRange, proseResult, setProseResult, proseLoading, handleTextareaSelect, runProse, replaceSelection };
}
