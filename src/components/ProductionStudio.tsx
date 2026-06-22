"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SHOT_TYPES, CAMERA_MOVEMENTS, LIGHTING_MOODS, TIME_OF_DAY, buildShotPromptFragment } from "@/lib/ai/shot-parameters";
import { CAMERA_PRESETS, CAMERA_PRESET_GROUPS, VIRAL_PRESETS } from "@/lib/higgsfield/presets";
import { ACTIVE_VIDEO_MODELS } from "@/lib/higgsfield/models";
import SeriesPipelinePanel from "@/components/panels/SeriesPipelinePanel";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/lib/toast";

type Shot = {
  id: string;
  sceneNumber: number;
  shotNumber: number;
  chapterId: string | null;
  shotType: string;
  cameraMovement: string;
  lightingMood: string;
  timeOfDay: string;
  subject: string;
  action: string;
  location: string;
  mood: string;
  soulPrompt: string;
  videoPrompt: string;
  dialogue: string;
  speaker: string;
  previewImageUrl: string;
  animatedVideoUrl: string;
  finalVideoUrl: string;
  generatedVideoUrl: string;
  generationStatus: string;
  cameraPreset: string;
  viralPreset: string;
  characterEmotion: string;
  focalLength: string;
  duration: number;
  aspectRatio: string;
  primaryCharacter?: { name: string; portraitUrl?: string } | null;
};

type Brief = {
  title: string; logline: string; format: string;
  genres: string[]; tone: string; styleNotes: string;
};

type CharSheet = { name: string; role: string; soulIdPrompt: string; voiceNotes: string };
type LocSheet = { name: string; visualDescription: string; moodKeywords: string[] };

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  generating_preview: "Generating preview…",
  preview_ready: "Preview ready",
  animating: "Animating (DoP)…",
  animated: "Animated",
  generating_final: "Generating video…",
  final_ready: "Final ready",
  error: "Error",
};

export default function ProductionStudio({ project, segmindKey }: { project: any; segmindKey: string }) {
  const [view, setView] = useState<"setup" | "shots" | "export" | "pipeline">("setup");
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [charSheets, setCharSheets] = useState<CharSheet[]>([]);
  const [locSheets, setLocSheets] = useState<LocSheet[]>([]);
  const [error, setError] = useState("");
  const [previewingAll, setPreviewingAll] = useState(false);
  const [videoModelMap, setVideoModelMap] = useState<Record<string, string>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    loadShots();
    return () => { Object.values(pollTimers.current).forEach(clearInterval); };
  }, []);

  async function loadShots() {
    const res = await fetch(`/api/projects/${project.id}/production/shots`);
    if (!res.ok) return;
    const { shots: s } = await res.json();
    if (s?.length) {
      setShots(s);
      setView("shots");
      s.filter((sh: Shot) => sh.generationStatus === "animating" || sh.generationStatus === "generating_final")
        .forEach((sh: Shot) => startPolling(sh.id, sh.generationStatus));
    }
  }

  async function generateShotList() {
    setGenerating(true);
    setError("");
    setGeneratingStep("Analyzing story…");
    setTimeout(() => setGeneratingStep("Building shot list…"), 5000);
    setTimeout(() => setGeneratingStep("Writing character profiles…"), 12000);
    try {
      const res = await fetch(`/api/projects/${project.id}/production/generate-package`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate shot list"); return; }
      setBrief(data.brief);
      setCharSheets(data.characterSheets ?? []);
      setLocSheets(data.locationSheets ?? []);
      await loadShots();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
      setGeneratingStep("");
    }
  }

  function startPolling(shotId: string, statusType: string) {
    if (pollTimers.current[shotId]) return;
    const endpoint = statusType === "animating"
      ? `/api/projects/${project.id}/production/shots/${shotId}/animate/status`
      : `/api/projects/${project.id}/production/shots/${shotId}/generate-video/status`;
    const timer = setInterval(async () => {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.status === "animated" || data.status === "final_ready" || data.status === "error") {
        clearInterval(pollTimers.current[shotId]);
        delete pollTimers.current[shotId];
        setShots(prev => prev.map(s => s.id === shotId
          ? { ...s, generationStatus: data.status, animatedVideoUrl: data.videoUrl || s.animatedVideoUrl, finalVideoUrl: data.videoUrl || s.finalVideoUrl }
          : s));
      }
    }, 3000);
    pollTimers.current[shotId] = timer;
  }

  async function previewShot(shotId: string) {
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, generationStatus: "generating_preview" } : s));
    const res = await fetch(`/api/projects/${project.id}/production/shots/${shotId}/preview`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setShots(prev => prev.map(s => s.id === shotId ? { ...s, ...data.shot } : s));
    } else {
      setShots(prev => prev.map(s => s.id === shotId ? { ...s, generationStatus: "error" } : s));
      setError(data.error || "Preview failed");
    }
  }

  async function animateShot(shotId: string) {
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, generationStatus: "animating" } : s));
    const res = await fetch(`/api/projects/${project.id}/production/shots/${shotId}/animate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dopModel: "dop-turbo" }),
    });
    const data = await res.json();
    if (res.ok) startPolling(shotId, "animating");
    else { setShots(prev => prev.map(s => s.id === shotId ? { ...s, generationStatus: "error" } : s)); setError(data.error || "Animation failed"); }
  }

  async function generateVideo(shotId: string) {
    const model = videoModelMap[shotId] || "kling";
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, generationStatus: "generating_final" } : s));
    const res = await fetch(`/api/projects/${project.id}/production/shots/${shotId}/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    const data = await res.json();
    if (res.ok) startPolling(shotId, "generating_final");
    else { setShots(prev => prev.map(s => s.id === shotId ? { ...s, generationStatus: "error" } : s)); setError(data.error || "Video generation failed"); }
  }

  async function previewAll() {
    setPreviewingAll(true);
    setError("");
    const res = await fetch(`/api/projects/${project.id}/production/preview-all`, { method: "POST" });
    const data = await res.json();
    setPreviewingAll(false);
    if (!res.ok) { setError(data.error || "Preview all failed"); return; }
    await loadShots();
    if (data.errors?.length) setError(`${data.errors.length} shot(s) failed to preview.`);
    if (data.remaining > 0) {
      toast.info(`${data.remaining} shot(s) still need previews. Click Preview All again to continue.`, {
        label: "Continue", onClick: previewAll,
      });
    }
  }

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function updateShot(shotId: string, updates: Partial<Shot>) {
    // Rebuild prompts client-side when parameters change
    const current = shots.find(s => s.id === shotId);
    if (!current) return;
    const merged = { ...current, ...updates };
    const paramFields: (keyof Shot)[] = ["shotType", "cameraMovement", "lightingMood", "timeOfDay", "subject", "action", "location"];
    if (paramFields.some(f => f in updates)) {
      const fragment = buildShotPromptFragment({
        shotType: merged.shotType, cameraMovement: merged.cameraMovement,
        lightingMood: merged.lightingMood, timeOfDay: merged.timeOfDay,
      });
      if (!("soulPrompt" in updates)) updates.soulPrompt = `${merged.subject}. ${merged.action}. ${merged.location}. ${fragment}. Photorealistic portrait quality.`;
      if (!("videoPrompt" in updates)) updates.videoPrompt = `${merged.action}. ${merged.location}. ${fragment}. Cinematic motion.`;
    }
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, ...updates } : s));
    clearTimeout(debounceTimers.current[shotId]);
    debounceTimers.current[shotId] = setTimeout(async () => {
      await fetch(`/api/projects/${project.id}/production/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    }, 1000);
  }

  function exportMarkdown() {
    let md = `# ${brief?.title ?? project.name} — Production Package\n\n`;
    if (brief) {
      md += `## Project Brief\n**Logline:** ${brief.logline}\n**Format:** ${brief.format}\n**Genres:** ${brief.genres?.join(", ")}\n**Tone:** ${brief.tone}\n**Style:** ${brief.styleNotes}\n\n`;
    }
    if (charSheets.length) {
      md += `## Character Sheets\n\n`;
      charSheets.forEach(c => { md += `### ${c.name} (${c.role})\n**Soul ID Prompt:** ${c.soulIdPrompt}\n**Voice:** ${c.voiceNotes}\n\n`; });
    }
    if (locSheets.length) {
      md += `## Locations\n\n`;
      locSheets.forEach(l => { md += `### ${l.name}\n${l.visualDescription}\n**Keywords:** ${l.moodKeywords?.join(", ")}\n\n`; });
    }
    md += `## Shot List\n\n`;
    const scenes = Array.from(new Set(shots.map(s => s.sceneNumber))).sort((a: number, b: number) => a - b);
    scenes.forEach(scene => {
      const sceneShots = shots.filter(s => s.sceneNumber === scene);
      md += `### Scene ${scene}\n\n`;
      sceneShots.forEach(shot => {
        md += `**Shot ${shot.shotNumber}** — ${shot.shotType} | ${shot.cameraMovement} | ${shot.lightingMood} | ${shot.timeOfDay}\n`;
        md += `Subject: ${shot.subject}\nAction: ${shot.action}\nLocation: ${shot.location}\nMood: ${shot.mood}\n`;
        md += `Soul Prompt: ${shot.soulPrompt}\nVideo Prompt: ${shot.videoPrompt}\n`;
        if (shot.dialogue) md += `Dialogue: "${shot.dialogue}" — ${shot.speaker}\n`;
        md += "\n";
      });
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${project.name.replace(/\s+/g, "-")}-production.md`; a.click();
    URL.revokeObjectURL(url);
  }

  const sel: CSSProperties = {
    border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", fontSize: 12,
    background: "white", cursor: "pointer", width: "100%",
  };
  const btn = (color = "#6c47ff"): CSSProperties => ({
    background: color, color: "white", border: "none", borderRadius: 6,
    padding: "5px 10px", fontSize: 12, fontWeight: "600", cursor: "pointer",
  });
  const outBtn: CSSProperties = {
    background: "white", border: "1px solid #e5e7eb", borderRadius: 6,
    padding: "5px 10px", fontSize: 12, fontWeight: "600", cursor: "pointer", color: "#374151",
  };

  // ── SETUP VIEW ───────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 20 }}>
        <div style={{ fontSize: 40 }}>🎬</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Production Studio</h2>
        <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 420, textAlign: "center", lineHeight: 1.6, margin: 0 }}>
          GhostWriter will analyze all your chapters and generate a complete shot list with Soul ID character profiles and Higgsfield-ready prompts.
        </p>
        {!segmindKey && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 16px", maxWidth: 420, textAlign: "center", fontSize: 13, color: "#92400e" }}>
            ⚠️ Add your Segmind API key in Settings to enable image and video generation. The shot list will still be generated.
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", maxWidth: 420, textAlign: "center", fontSize: 13, color: "#991b1b" }}>
            {error}
          </div>
        )}
        {generating ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #6c47ff", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "#6c47ff", fontWeight: 600 }}>{generatingStep}</p>
          </div>
        ) : (
          <button onClick={generateShotList} style={{ ...btn(), padding: "12px 28px", fontSize: 15, borderRadius: 10 }}>
            ⚡ Generate Shot List
          </button>
        )}
        <p style={{ fontSize: 12, color: "#9ca3af" }}>~20-30 seconds</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── EXPORT VIEW ──────────────────────────────────────────────────────────────
  if (view === "export") {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => setView("shots")} style={outBtn}>← Back</button>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, flex: 1 }}>Production Package</h2>
          <button onClick={exportMarkdown} style={btn()}>📥 Download Markdown</button>
        </div>

        {brief && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#374151" }}>PROJECT BRIEF</div>
            <p style={{ margin: "4px 0", fontSize: 13 }}><b>Logline:</b> {brief.logline}</p>
            <p style={{ margin: "4px 0", fontSize: 13 }}><b>Format:</b> {brief.format} | <b>Genres:</b> {brief.genres?.join(", ")}</p>
            <p style={{ margin: "4px 0", fontSize: 13 }}><b>Tone:</b> {brief.tone}</p>
            <p style={{ margin: "4px 0", fontSize: 13 }}><b>Style:</b> {brief.styleNotes}</p>
          </div>
        )}

        {charSheets.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#374151" }}>CHARACTER SHEETS</div>
            {charSheets.map((c, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name} <span style={{ fontWeight: 400, color: "#6b7280" }}>({c.role})</span></div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}><b>Soul ID:</b> {c.soulIdPrompt}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}><b>Voice:</b> {c.voiceNotes}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#374151" }}>SHOT LIST</div>
        {Array.from(new Set(shots.map(s => s.sceneNumber))).sort((a: number, b: number) => a - b).map(scene => {
          const sceneShots = shots.filter(s => s.sceneNumber === scene);
          return (
            <div key={scene} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6c47ff", marginBottom: 6 }}>━━ Scene {scene} ━━</div>
              {sceneShots.map(shot => (
                <div key={shot.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 700 }}>Shot {shot.shotNumber} — {shot.shotType} | {shot.cameraMovement} | {shot.lightingMood} | {shot.timeOfDay}</div>
                  <div style={{ color: "#374151", marginTop: 4 }}>{shot.subject}. {shot.action}. {shot.location}.</div>
                  <div style={{ color: "#6b7280", marginTop: 2 }}><b>Soul:</b> {shot.soulPrompt}</div>
                  <div style={{ color: "#6b7280", marginTop: 2 }}><b>Video:</b> {shot.videoPrompt}</div>
                  {shot.dialogue && <div style={{ color: "#374151", marginTop: 4, fontStyle: "italic" }}>"{shot.dialogue}" — {shot.speaker}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── PIPELINE VIEW ────────────────────────────────────────────────────────────
  if (view === "pipeline") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8, background: "#fff" }}>
          <button onClick={() => setView("shots")} style={outBtn}>← Back</button>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#111827" }}>Series Pipeline</h2>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          <SeriesPipelinePanel project={project} onNavigate={(route) => {
            if (route === "production") setView("shots");
            else if (route === "export") setView("export");
            else if (route === "contest-export") setView("pipeline");
          }} />
        </div>
      </div>
    );
  }

  // ── SHOT LIST VIEW ───────────────────────────────────────────────────────────
  const scenes = Array.from(new Set(shots.map(s => s.sceneNumber))).sort((a: number, b: number) => a - b);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#fff" }}>
        <button onClick={() => setView("setup")} style={outBtn}>← Back</button>
        <button onClick={previewAll} disabled={previewingAll || !segmindKey} style={{ ...btn("#059669"), opacity: !segmindKey ? 0.5 : 1 }}>
          {previewingAll ? "Previewing…" : "🖼 Preview All Shots"}
        </button>
        <button onClick={generateShotList} disabled={generating} style={outBtn}>
          {generating ? "Regenerating…" : "♻️ Regenerate Shot List"}
        </button>
        <button onClick={() => setView("export")} style={outBtn}>📥 Export</button>
        <button onClick={() => setView("pipeline")} style={{ ...outBtn, color: "#6c47ff", borderColor: "#6c47ff" }}>🚀 Series Pipeline</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
          {shots.length} shots / {scenes.length} scenes
        </span>
      </div>

      {error && (
        <div style={{ padding: "8px 16px", background: "#fef2f2", borderBottom: "1px solid #fca5a5", fontSize: 13, color: "#991b1b" }}>
          {error} <button onClick={() => setError("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Shots */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {shots.length === 0 && (
          <EmptyState icon="🎬" title="No shots yet"
            description="Generate a production package from your chapters to start directing." />
        )}
        {scenes.map(scene => {
          const sceneShots = shots.filter(s => s.sceneNumber === scene);
          const chapterTitle = sceneShots[0]?.chapterId
            ? (project.chapters?.find((c: any) => c.id === sceneShots[0].chapterId)?.title ?? "")
            : "";
          return (
            <div key={scene} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6c47ff", marginBottom: 10, borderBottom: "2px solid #ede9fe", paddingBottom: 4 }}>
                ━━ Scene {scene}{chapterTitle ? ` — ${chapterTitle}` : ""} ━━
              </div>
              {sceneShots.map(shot => <ShotCard key={shot.id} shot={shot} projectId={project.id} segmindKey={segmindKey} onUpdate={updateShot} onPreview={previewShot} onAnimate={animateShot} onGenerateVideo={generateVideo} videoModel={videoModelMap[shot.id] || "kling"} onModelChange={m => setVideoModelMap(prev => ({ ...prev, [shot.id]: m }))} />)}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function WhatsNextButton({
  shot, onUpdate,
}: {
  shot: Shot;
  onUpdate: (id: string, updates: Partial<Shot>) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleWhatsNext() {
    if (!shot.videoPrompt && !shot.soulPrompt) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/scene-to-video-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneText: shot.videoPrompt || shot.soulPrompt || "",
          shotNumber: shot.shotNumber + 1,
          previousShot: shot.videoPrompt,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.videoPrompt) onUpdate(shot.id, { videoPrompt: data.videoPrompt } as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleWhatsNext}
      disabled={loading}
      style={{ fontSize: 11, fontWeight: 600, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 6, padding: "4px 10px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
    >
      {loading ? "Generating…" : "→ What's Next Shot"}
    </button>
  );
}

function ShotCard({
  shot, projectId, segmindKey, onUpdate, onPreview, onAnimate, onGenerateVideo, videoModel, onModelChange,
}: {
  shot: Shot; projectId: string; segmindKey: string;
  onUpdate: (id: string, updates: Partial<Shot>) => void;
  onPreview: (id: string) => void;
  onAnimate: (id: string) => void;
  onGenerateVideo: (id: string) => void;
  videoModel: string;
  onModelChange: (m: string) => void;
}) {
  const status = shot.generationStatus || "idle";
  const sel: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 6px", fontSize: 11, background: "white", cursor: "pointer", width: "100%" };
  const btn = (color = "#6c47ff"): React.CSSProperties => ({ background: color, color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" });
  const outBtn: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: "600", cursor: "pointer", color: "#374151", whiteSpace: "nowrap" };

  const [viralityScore, setViralityScore] = useState<any>(null);
  const [viralityLoading, setViralityLoading] = useState(false);

  const predictEngagement = async () => {
    setViralityLoading(true);
    try {
      const res = await fetch("/api/ai/virality-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPrompt: shot.videoPrompt || shot.soulPrompt }),
      });
      if (res.status === 403) { setViralityScore({ error: "upgrade_required" }); return; }
      const data = await res.json();
      setViralityScore(data);
    } catch { setViralityScore({ error: "Failed. Please try again." }); }
    setViralityLoading(false);
  };

  return (
    <div style={{ border: status === "error" ? "2px solid #f87171" : "1px solid #e5e7eb", borderRadius: 10, background: "white", marginBottom: 12, overflow: "hidden", display: "flex" }}>
      {/* Image / video column */}
      <div style={{ width: 200, minWidth: 200, background: "#f9fafb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10, gap: 8 }}>
        {status === "generating_preview" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #6c47ff", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 6px" }} />
            <div style={{ fontSize: 11, color: "#6c47ff" }}>Generating preview…</div>
          </div>
        ) : status === "animating" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #059669", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 6px" }} />
            <div style={{ fontSize: 11, color: "#059669" }}>Animating (DoP)…</div>
          </div>
        ) : status === "generating_final" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #d97706", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 6px" }} />
            <div style={{ fontSize: 11, color: "#d97706" }}>Generating video…</div>
          </div>
        ) : shot.finalVideoUrl ? (
          <video src={shot.finalVideoUrl} controls style={{ width: "100%", borderRadius: 6 }} />
        ) : shot.animatedVideoUrl ? (
          <video src={shot.animatedVideoUrl} controls style={{ width: "100%", borderRadius: 6 }} />
        ) : shot.previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.previewImageUrl} alt="preview" style={{ width: "100%", borderRadius: 6, objectFit: "cover" }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: "100%", aspectRatio: "16/9", background: "#e5e7eb", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 24 }}>🎬</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
          {(status === "idle" || status === "error") && segmindKey && (
            <button onClick={() => onPreview(shot.id)} style={btn()}>🖼 Preview</button>
          )}
          {status === "preview_ready" && segmindKey && (
            <button onClick={() => onAnimate(shot.id)} style={btn("#059669")}>🎬 Animate</button>
          )}
          {status === "animated" && (
            <>
              <select value={videoModel} onChange={e => onModelChange(e.target.value)} style={sel}>
                {ACTIVE_VIDEO_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}{m.badge ? ` [${m.badge}]` : ""}</option>)}
              </select>
              {videoModel === "veo" && (
                <div style={{ fontSize: 9, color: "#d97706", marginTop: 2 }}>Veo 3.1 generates native audio alongside video.</div>
              )}
              {segmindKey && <button onClick={() => onGenerateVideo(shot.id)} style={btn("#d97706")}>⚡ Generate Video</button>}
            </>
          )}
          {status === "final_ready" && (
            <a href={shot.finalVideoUrl} download style={{ ...btn("#059669"), textDecoration: "none", textAlign: "center" }}>⬇ Download</a>
          )}
          {status === "error" && (
            <button onClick={() => onPreview(shot.id)} style={btn("#ef4444")}>Retry</button>
          )}
        </div>

        <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>Shot {shot.shotNumber}</div>
      </div>

      {/* Details column */}
      <div style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Parameter row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>SHOT TYPE</div>
            <select value={shot.shotType} onChange={e => onUpdate(shot.id, { shotType: e.target.value })} style={sel}>
              {SHOT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>CAMERA</div>
            <select value={shot.cameraMovement} onChange={e => onUpdate(shot.id, { cameraMovement: e.target.value })} style={sel}>
              {CAMERA_MOVEMENTS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>LIGHTING</div>
            <select value={shot.lightingMood} onChange={e => onUpdate(shot.id, { lightingMood: e.target.value })} style={sel}>
              {LIGHTING_MOODS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>TIME OF DAY</div>
            <select value={shot.timeOfDay} onChange={e => onUpdate(shot.id, { timeOfDay: e.target.value })} style={sel}>
              {TIME_OF_DAY.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Subject / Action / Mood */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {(["subject", "action", "mood"] as const).map(field => (
            <div key={field}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2, textTransform: "uppercase" }}>{field}</div>
              <input value={(shot as any)[field] || ""} onChange={e => onUpdate(shot.id, { [field]: e.target.value } as any)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 6px", fontSize: 11, background: "white" }} />
            </div>
          ))}
        </div>

        {/* Soul Prompt */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>SOUL PROMPT</div>
          <textarea value={shot.soulPrompt || ""} onChange={e => onUpdate(shot.id, { soulPrompt: e.target.value })} rows={2}
            style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 6px", fontSize: 11, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {/* Video Prompt */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>VIDEO PROMPT</div>
          <textarea value={shot.videoPrompt || ""} onChange={e => onUpdate(shot.id, { videoPrompt: e.target.value })} rows={2}
            style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 6px", fontSize: 11, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {/* Camera Preset */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>CAMERA PRESET</div>
          <select value={shot.cameraPreset || ""} onChange={e => onUpdate(shot.id, { cameraPreset: e.target.value })} style={sel}>
            <option value="">No camera preset</option>
            {CAMERA_PRESET_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.presets.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {shot.cameraPreset && CAMERA_PRESETS[shot.cameraPreset] && (
            <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{CAMERA_PRESETS[shot.cameraPreset].description}</div>
          )}
        </div>

        {/* Viral Preset */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>VIRAL PRESET</div>
          <select value={shot.viralPreset || ""} onChange={e => onUpdate(shot.id, { viralPreset: e.target.value })} style={sel}>
            <option value="">No viral preset</option>
            {VIRAL_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {shot.viralPreset && VIRAL_PRESETS.find(p => p.id === shot.viralPreset) && (
            <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{VIRAL_PRESETS.find(p => p.id === shot.viralPreset)!.description}</div>
          )}
        </div>

        {/* Director fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>CHARACTER EMOTION</div>
            <input
              value={(shot as any).characterEmotion || ""}
              onChange={e => onUpdate(shot.id, { characterEmotion: e.target.value } as any)}
              placeholder="determined, afraid…"
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 6px", fontSize: 11, background: "white" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 2 }}>FOCAL LENGTH</div>
            <select value={(shot as any).focalLength || ""} onChange={e => onUpdate(shot.id, { focalLength: e.target.value } as any)} style={sel}>
              <option value="">Default</option>
              {["35mm", "70mm", "85mm", "Wide"].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 4 }}>DURATION</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[5, 10, 15].map(d => (
                <button
                  key={d}
                  onClick={() => onUpdate(shot.id, { duration: d } as any)}
                  style={{ flex: 1, padding: "3px 0", fontSize: 11, fontWeight: 600, border: `1px solid ${(shot as any).duration === d || (!((shot as any).duration) && d === 5) ? "#6c47ff" : "#e5e7eb"}`, borderRadius: 6, background: (shot as any).duration === d || (!((shot as any).duration) && d === 5) ? "#ede9fe" : "white", color: (shot as any).duration === d || (!((shot as any).duration) && d === 5) ? "#6c47ff" : "#374151", cursor: "pointer" }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 4 }}>ASPECT RATIO</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["16:9", "9:16", "1:1"].map(ar => (
                <button
                  key={ar}
                  onClick={() => onUpdate(shot.id, { aspectRatio: ar } as any)}
                  style={{ flex: 1, padding: "3px 0", fontSize: 10, fontWeight: 600, border: `1px solid ${((shot as any).aspectRatio || "16:9") === ar ? "#6c47ff" : "#e5e7eb"}`, borderRadius: 6, background: ((shot as any).aspectRatio || "16:9") === ar ? "#ede9fe" : "white", color: ((shot as any).aspectRatio || "16:9") === ar ? "#6c47ff" : "#374151", cursor: "pointer" }}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* What's Next */}
        <WhatsNextButton shot={shot} onUpdate={onUpdate} />

        {/* Dialogue */}
        {(shot.dialogue || shot.speaker) && (
          <div style={{ fontSize: 12, color: "#374151", fontStyle: "italic", borderTop: "1px solid #f3f4f6", paddingTop: 6 }}>
            {shot.dialogue && <span>"{shot.dialogue}"</span>}
            {shot.speaker && <span style={{ color: "#6b7280" }}> — {shot.speaker}</span>}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <div style={{ fontSize: 10, color: "#9ca3af" }}>Status: {STATUS_LABELS[status] || status}</div>
          {(status === "final_ready" || status === "animated") && (
            <button onClick={predictEngagement} disabled={viralityLoading} style={{ ...outBtn, fontSize: 10, padding: "2px 8px" }}>
              {viralityLoading ? "Analysing…" : "📊 Predict Engagement"}
            </button>
          )}
        </div>

        {viralityScore && !viralityScore.error && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginTop: 4 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-end" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: viralityScore.overallScore >= 7 ? "#059669" : viralityScore.overallScore >= 4 ? "#d97706" : "#ef4444" }}>{viralityScore.overallScore}<span style={{ fontSize: 14 }}>/10</span></div>
                <div style={{ fontSize: 9, color: "#6b7280" }}>Overall</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#374151" }}>{viralityScore.hookStrength}/10</div>
                <div style={{ fontSize: 9, color: "#6b7280" }}>Hook</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: viralityScore.retentionRisk === "low" ? "#059669" : viralityScore.retentionRisk === "medium" ? "#d97706" : "#ef4444", background: viralityScore.retentionRisk === "low" ? "#dcfce7" : viralityScore.retentionRisk === "medium" ? "#fef3c7" : "#fee2e2", padding: "2px 6px", borderRadius: 4 }}>{viralityScore.retentionRisk} risk</div>
                <div style={{ fontSize: 9, color: "#6b7280" }}>Retention</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>{viralityScore.estimatedWatchPercent}%</div>
                <div style={{ fontSize: 9, color: "#6b7280" }}>Watch %</div>
              </div>
            </div>
            {viralityScore.strengths?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 4 }}>
                {viralityScore.strengths.map((s: string, i: number) => (
                  <span key={i} style={{ fontSize: 9, background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 3 }}>✓ {s}</span>
                ))}
              </div>
            )}
            {viralityScore.improvements?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {viralityScore.improvements.map((s: string, i: number) => (
                  <span key={i} style={{ fontSize: 9, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 3 }}>⚡ {s}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {viralityScore?.error === "upgrade_required" && (
          <div style={{ fontSize: 10, color: "#d97706", background: "#fef3c7", padding: "4px 8px", borderRadius: 6, marginTop: 4 }}>Upgrade to Creator Pro to use Virality Predictor.</div>
        )}
      </div>
    </div>
  );
}
