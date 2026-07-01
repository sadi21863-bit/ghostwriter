"use client";
import { useEffect, useRef, useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";
import { toast } from "@/lib/toast";
import type { StoryBeat } from "@/lib/types/story";

interface ChapterPlanPanelProps {
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  onClose: () => void;
  onSelectMode: (mode: "write") => void;
  setPrompt: (value: string) => void;
  onDismissGuide: () => void;
}

type Research = { openPromises: string; priorChapterSummary: string };

export default function ChapterPlanPanel({ projectId, chapterId, chapterTitle, onClose, onSelectMode, setPrompt, onDismissGuide }: ChapterPlanPanelProps) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [beat, setBeat] = useState<StoryBeat | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [research, setResearch] = useState<Research | null>(null);
  const [researching, setResearching] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/story-plans`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const plans = Array.isArray(data?.plans) ? data.plans : [];
        const chapterPlan = plans.find((p: any) => p.kind === "chapter_plan" && (p.beats?.[0]?.chapterId === chapterId));
        if (chapterPlan) {
          setPlanId(chapterPlan.id);
          setBeat(chapterPlan.beats[0] ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [projectId, chapterId]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/story-plans`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "chapter_plan", chapterId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Couldn't draft a scene plan."); return; }
      setPlanId(data.plan.id);
      setBeat(data.plan.beats?.[0] ?? null);
    } catch {
      toast.error("Scene plan generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const fetchResearch = async () => {
    if (researching) return;
    setResearching(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/chapter-research?chapterId=${chapterId}`);
      if (res.ok) setResearch(await res.json());
    } catch {
      // Research is a display-only aid — a failed fetch just leaves the pane empty.
    } finally {
      setResearching(false);
    }
  };

  const persist = (nextBeat: StoryBeat) => {
    if (!planId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}/story-plans`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, beats: [nextBeat] }),
      }).catch(() => {});
    }, 1200);
  };

  const updateSummary = (value: string) => {
    setBeat(prev => {
      if (!prev) return prev;
      const next = { ...prev, summary: value };
      persist(next);
      return next;
    });
  };

  const draftChapter = () => {
    if (beat) setPrompt(`Write "${chapterTitle}" following this scene plan:\n${beat.summary}`);
    onSelectMode("write");
    onClose();
  };

  const skip = () => {
    onDismissGuide();
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1500, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ width: 460, maxWidth: "100%", height: "100%", background: co.surface, overflow: "auto", padding: 20, position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: co.muted }} aria-label="Close">×</button>

        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>📝 Plan · {chapterTitle}</div>

        {!loaded && <p style={{ fontSize: 13, color: co.muted }}>Loading…</p>}

        {loaded && !beat && (
          <>
            <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
              Generate a tight scene plan — goal, obstacle, turn, and how the story changes by the end — before you draft.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={generate}>
                {generating ? "Planning…" : "Idea — generate a scene plan"}
              </button>
              <button style={sBtnSm} onClick={fetchResearch} disabled={researching}>
                {researching ? "Loading…" : "Research — what must this chapter honor?"}
              </button>
              <button style={{ ...sBtnSm, background: "transparent" }} onClick={skip}>Skip — start writing</button>
            </div>
          </>
        )}

        {research && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: `1px solid ${co.border}`, background: co.bg }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Research</div>
            {research.priorChapterSummary && (
              <p style={{ fontSize: 12, color: co.text, lineHeight: 1.6, marginBottom: 8 }}><strong>Previously:</strong> {research.priorChapterSummary}</p>
            )}
            {research.openPromises && (
              <p style={{ fontSize: 12, color: co.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{research.openPromises}</p>
            )}
            {!research.priorChapterSummary && !research.openPromises && (
              <p style={{ fontSize: 12, color: co.muted }}>Nothing specific to honor yet — this is a clean slate.</p>
            )}
          </div>
        )}

        {beat && (
          <div style={{ marginTop: 12 }}>
            <textarea
              value={beat.summary}
              onChange={(e) => updateSummary(e.target.value)}
              rows={8}
              style={{ ...sInput, resize: "vertical", fontSize: 13, lineHeight: 1.6, width: "100%" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button style={sBtn} onClick={draftChapter}>✍️ Draft this chapter →</button>
              <button style={sBtnSm} onClick={fetchResearch} disabled={researching}>
                {researching ? "Loading…" : "Research"}
              </button>
              <button style={{ ...sBtnSm, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={generate}>
                {generating ? "Planning…" : "Regenerate"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
