"use client";
import { useState } from "react";

interface ProjectData {
  chapters: any[];
  characters: any[];
  productionShots: any[];
  comicPageCount: number;
}

interface StageStatus {
  id: string;
  done: number;
  total: number;
  ready: boolean;
}

interface Props {
  project: any;
  onNavigate: (route: string) => void;
}

function getProjectData(project: any): ProjectData {
  return {
    chapters: project.chapters || [],
    characters: project.characters || [],
    productionShots: project.productionShots || [],
    comicPageCount: (project.comicPages || []).length,
  };
}

const PIPELINE_STAGES = [
  {
    id: "story",
    label: "Story",
    icon: "✍️",
    description: "Write your chapters",
    check: (d: ProjectData): StageStatus => {
      const done = d.chapters.filter((c: any) => (c.content?.length ?? 0) > 500).length;
      return { id: "story", done, total: Math.max(d.chapters.length, 1), ready: done > 0 };
    },
    action: "Write",
    actionRoute: "editor",
    unitLabel: "chapters",
  },
  {
    id: "storyboard",
    label: "Storyboard",
    icon: "🎬",
    description: "Generate comic panels",
    check: (d: ProjectData): StageStatus => {
      const written = d.chapters.filter((c: any) => (c.content?.length ?? 0) > 500).length;
      return { id: "storyboard", done: d.comicPageCount, total: Math.max(written, 1), ready: d.comicPageCount > 0 };
    },
    action: "Generate Panels",
    actionRoute: "comics",
    unitLabel: "pages",
  },
  {
    id: "soul_ids",
    label: "Character Soul IDs",
    icon: "🎭",
    description: "Train character consistency",
    check: (d: ProjectData): StageStatus => {
      const done = d.characters.filter((c: any) => c.soulId && !c.soulId.startsWith("training:")).length;
      return { id: "soul_ids", done, total: Math.max(d.characters.length, 1), ready: done > 0 };
    },
    action: "Train Soul IDs",
    actionRoute: "world-bible",
    unitLabel: "characters",
  },
  {
    id: "shots",
    label: "Production Shots",
    icon: "📹",
    description: "Direct your video shots",
    check: (d: ProjectData): StageStatus => {
      const done = d.productionShots.filter((s: any) => s.generatedVideoUrl || s.finalVideoUrl).length;
      return { id: "shots", done, total: Math.max(d.productionShots.length, 1), ready: done > 0 };
    },
    action: "Go to Production",
    actionRoute: "production",
    unitLabel: "shots",
  },
  {
    id: "contest_ready",
    label: "Series Ready",
    icon: "🚀",
    description: "Export for Higgsfield Original Series",
    check: (d: ProjectData): StageStatus => {
      const storyReady = d.chapters.filter((c: any) => (c.content?.length ?? 0) > 500).length > 0;
      const soulReady = d.characters.some((c: any) => c.soulId && !c.soulId.startsWith("training:"));
      const videoReady = d.productionShots.filter((s: any) => s.generatedVideoUrl || s.finalVideoUrl).length > 0;
      const ready = storyReady && soulReady && videoReady;
      return { id: "contest_ready", done: ready ? 1 : 0, total: 1, ready };
    },
    action: "Export Contest Package",
    actionRoute: "contest-export",
    unitLabel: "package",
  },
];

const STAGE_DEPS: Record<string, string[]> = {
  storyboard:    ["story"],
  soul_ids:      ["story"],
  shots:         ["soul_ids"],
  contest_ready: ["story", "storyboard", "shots"],
};

const DEP_LABELS: Record<string, string> = {
  story:      "write at least one chapter",
  storyboard: "generate comic panels",
  soul_ids:   "train at least one character Soul ID",
  shots:      "generate production shots",
};

function getDependencyWarning(stageId: string, stages: StageStatus[]): string | null {
  const deps = STAGE_DEPS[stageId] ?? [];
  const unmet = deps.filter(dep => !stages.find(s => s.id === dep)?.ready);
  if (unmet.length === 0) return null;
  return `Complete first: ${unmet.map(u => DEP_LABELS[u]).join(", ")}.`;
}

export default function SeriesPipelinePanel({ project, onNavigate }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState("");
  const [exportError, setExportError] = useState("");

  const data = getProjectData(project);
  const stages = PIPELINE_STAGES.map(s => s.check(data));
  const allStagesReady = stages.every(s => s.ready);
  const hasNoChapters = data.chapters.length === 0;

  async function handleContestExport() {
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/export/higgsfield-contest`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) { setExportError(result.error || "Export failed"); return; }
      setExportUrl(result.downloadUrl);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>
          Series Pipeline
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          Track your progress toward a Higgsfield Original Series submission.
        </p>
      </div>

      {/* Empty state — no chapters yet */}
      {hasNoChapters && (
        <div style={{ textAlign: "center", padding: "32px 16px", background: "var(--surface)", borderRadius: 12, marginBottom: 24, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✍️</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, color: "var(--text)" }}>
            Start by writing your story
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, maxWidth: 280, margin: "0 auto 20px" }}>
            Write your chapters first. The visual pipeline unlocks as you build your story.
          </div>
          <button
            onClick={() => onNavigate("editor")}
            style={{ padding: "10px 24px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            Open editor →
          </button>
        </div>
      )}

      {/* All stages ready — export banner */}
      {allStagesReady && (
        <div style={{ padding: "16px 20px", marginBottom: 20, background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", borderRadius: 12, color: "#fff" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            🎬 Your series is ready to submit
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 14 }}>
            All stages complete. Export your contest package and submit to Higgsfield Original Series.
          </div>
          {exportUrl ? (
            <a
              href={exportUrl}
              download
              style={{ display: "inline-block", background: "#fff", color: "#4F46E5", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
            >
              ⬇ Download Package
            </a>
          ) : (
            <button
              onClick={handleContestExport}
              disabled={exporting}
              style={{ padding: "10px 24px", background: "#fff", color: "#4F46E5", border: "none", borderRadius: 8, fontWeight: 700, cursor: exporting ? "not-allowed" : "pointer", fontSize: 13, opacity: exporting ? 0.7 : 1 }}
            >
              {exporting ? "Generating package…" : "Export Contest Package →"}
            </button>
          )}
          {exportError && <div style={{ fontSize: 12, marginTop: 8, opacity: 0.9, color: "#fca5a5" }}>{exportError}</div>}
        </div>
      )}

      {/* Stage cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PIPELINE_STAGES.map((stage, i) => {
          const { done, total, ready } = stages[i];
          const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
          const warning = getDependencyWarning(stage.id, stages);

          return (
            <div
              key={stage.id}
              style={{
                background: "var(--surface)",
                border: `1px solid ${ready ? "#bbf7d0" : "var(--border)"}`,
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              {/* Step indicator */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: ready ? "#22c55e" : "var(--border)",
                color: ready ? "white" : "var(--muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ready ? 14 : 13, fontWeight: 700,
              }}>
                {ready ? "✓" : i + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 16 }}>{stage.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{stage.label}</span>
                  {ready && <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Done</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{stage.description}</div>

                {/* Progress bar */}
                {stage.id !== "contest_ready" && (
                  <>
                    <div style={{ marginTop: 8, background: "var(--border)", borderRadius: 4, height: 4 }}>
                      <div style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: ready ? "#4ade80" : "#4F46E5",
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {done} / {total} {stage.unitLabel}
                    </div>
                  </>
                )}

                {/* Dependency warning */}
                {warning && !ready && (
                  <div style={{ fontSize: 11, color: "#facc15", marginTop: 6 }}>
                    ⚠ {warning}
                  </div>
                )}

                {/* Action button */}
                {stage.id !== "contest_ready" && (
                  <button
                    onClick={() => onNavigate(stage.actionRoute)}
                    style={{
                      marginTop: 10,
                      background: ready ? "#f0fdf4" : "var(--bg)",
                      color: ready ? "#166534" : "var(--text)",
                      border: `1px solid ${ready ? "#bbf7d0" : "var(--border)"}`,
                      borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    → {stage.action}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
