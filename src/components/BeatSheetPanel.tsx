"use client";
import { useEffect, useRef, useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";
import { toast } from "@/lib/toast";
import type { GenerationMode } from "@/lib/modes/registry";
import type { StoryBeat } from "@/lib/types/story";

const PURPOSES: StoryBeat["purpose"][] = ["setup", "rising", "turn", "climax", "payoff", "transition"];

interface BeatSheetPanelProps {
  project: any;
  onSelectMode: (mode: GenerationMode) => void;
  setPrompt: (value: string) => void;
}

export default function BeatSheetPanel({ project, onSelectMode, setPrompt }: BeatSheetPanelProps) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [beats, setBeats] = useState<StoryBeat[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charName = (id: string) => project.characters?.find((c: any) => c.id === id)?.name ?? "?";
  const threadName = (id: string) => project.plotThreads?.find((t: any) => t.id === id)?.name ?? "?";

  useEffect(() => {
    fetch(`/api/projects/${project.id}/story-plans`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const latest = data?.plans?.[0];
        if (latest) { setPlanId(latest.id); setBeats(Array.isArray(latest.beats) ? latest.beats : []); }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [project.id]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/story-plans`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: project.controllingIdea ? `Story premise: ${project.controllingIdea}` : "" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Couldn't generate the beat sheet."); return; }
      setPlanId(data.plan.id);
      setBeats(Array.isArray(data.plan.beats) ? data.plan.beats : []);
    } catch {
      toast.error("Beat sheet generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const persist = (next: StoryBeat[]) => {
    if (!planId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${project.id}/story-plans`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, beats: next }),
      }).catch(() => {});
    }, 1200);
  };

  const updateBeat = (id: string, field: "summary" | "purpose", value: string) => {
    setBeats(prev => {
      const next = prev.map(b => b.id === id ? { ...b, [field]: value } : b);
      persist(next);
      return next;
    });
  };

  const draftBeat = (beat: StoryBeat) => {
    setPrompt(`Write this beat as a scene: ${beat.label}. ${beat.summary}`);
    onSelectMode("write");
  };

  if (!loaded) return null;

  if (beats.length === 0) {
    return (
      <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>📋 Beat Sheet · Director</div>
        <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, marginBottom: 12 }}>
          Generate a structured beat sheet — the story's spine. Each beat carries its structural purpose, the cast, and the threads it advances, and can be drafted straight into a chapter.
        </p>
        <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={generate}>
          {generating ? "Planning…" : "Generate beat sheet →"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>📋 Beat Sheet · Director</div>
        <button style={{ ...sBtnSm, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={generate}>{generating ? "Planning…" : "Regenerate"}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {beats.map((beat, i) => (
          <div key={beat.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, border: `1px solid ${co.border}`, background: co.bg }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: co.accent, flexShrink: 0, minWidth: 18 }}>{i + 1}</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: co.text }}>{beat.label}</span>
                <select value={beat.purpose} onChange={e => updateBeat(beat.id, "purpose", e.target.value)} style={{ ...sInput, width: "auto", padding: "2px 6px", fontSize: 10 }}>
                  {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <textarea value={beat.summary} onChange={e => updateBeat(beat.id, "summary", e.target.value)} rows={2}
                style={{ ...sInput, resize: "vertical", fontSize: 12, minHeight: 38 }} />
              {(beat.characterIds.length > 0 || beat.threadIds.length > 0) && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {beat.characterIds.map(id => <span key={id} style={chip(co.accentBg, co.accent)}>{charName(id)}</span>)}
                  {beat.threadIds.map(id => <span key={id} style={chip(co.surfaceAlt, co.muted)}>🧵 {threadName(id)}</span>)}
                </div>
              )}
            </div>
            <button style={{ ...sBtnSm, flexShrink: 0 }} onClick={() => draftBeat(beat)}>✍️ Draft this →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function chip(bg: string, color: string): React.CSSProperties {
  return { fontSize: 10, padding: "1px 7px", borderRadius: 20, background: bg, color };
}
