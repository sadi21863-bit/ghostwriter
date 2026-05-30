"use client";
import { useState } from "react";

interface ProjectData {
  chapters: any[];
  characters: any[];
  productionShots: any[];
  comicPageCount: number;
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
    check: (d: ProjectData) => {
      const done = d.chapters.filter((c: any) => (c.content?.length ?? 0) > 500).length;
      return { done, total: Math.max(d.chapters.length, 1), ready: done > 0 };
    },
    action: "Write",
    actionRoute: "editor",
  },
  {
    id: "storyboard",
    label: "Storyboard",
    icon: "🎬",
    description: "Generate comic panels",
    check: (d: ProjectData) => {
      const written = d.chapters.filter((c: any) => (c.content?.length ?? 0) > 500).length;
      return { done: d.comicPageCount, total: Math.max(written, 1), ready: d.comicPageCount > 0 };
    },
    action: "Generate Panels",
    actionRoute: "comics",
  },
  {
    id: "soul_ids",
    label: "Character Soul IDs",
    icon: "🎭",
    description: "Train character consistency",
    check: (d: ProjectData) => {
      const done = d.characters.filter((c: any) => c.soulId && !c.soulId.startsWith("training:")).length;
      return { done, total: Math.max(d.characters.length, 1), ready: done > 0 };
    },
    action: "Train Soul IDs",
    actionRoute: "world-bible",
  },
  {
    id: "shots",
    label: "Production Shots",
    icon: "📹",
    description: "Direct your video shots",
    check: (d: ProjectData) => {
      const done = d.productionShots.filter((s: any) => s.generatedVideoUrl || s.finalVideoUrl).length;
      return { done, total: Math.max(d.productionShots.length, 1), ready: done > 0 };
    },
    action: "Go to Production",
    actionRoute: "production",
  },
  {
    id: "export",
    label: "Series Ready",
    icon: "🚀",
    description: "Export for Higgsfield Original Series",
    check: (d: ProjectData) => {
      const storyReady = d.chapters.filter((c: any) => (c.content?.length ?? 0) > 500).length > 0;
      const soulReady = d.characters.some((c: any) => c.soulId && !c.soulId.startsWith("training:"));
      const videoReady = d.productionShots.filter((s: any) => s.generatedVideoUrl || s.finalVideoUrl).length > 0;
      const ready = storyReady && soulReady && videoReady;
      return { done: ready ? 1 : 0, total: 1, ready };
    },
    action: "Export Contest Package",
    actionRoute: "contest-export",
  },
];

export default function SeriesPipelinePanel({ project, onNavigate }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState("");
  const [exportError, setExportError] = useState("");

  const data = getProjectData(project);
  const allReady = PIPELINE_STAGES.every(s => s.check(data).ready);

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
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
          Series Pipeline
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Track your progress toward a Higgsfield Original Series submission.
        </p>
      </div>

      {allReady && (
        <div style={{ background: "linear-gradient(135deg, #6c47ff 0%, #a855f7 100%)", borderRadius: 12, padding: "16px 20px", marginBottom: 24, color: "white" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🎉 Ready to Submit!</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
            All pipeline stages complete. Export your contest package for Higgsfield Original Series.
          </div>
          {exportUrl ? (
            <a
              href={exportUrl}
              download
              style={{ display: "inline-block", background: "white", color: "#6c47ff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
            >
              ⬇ Download Package
            </a>
          ) : (
            <button
              onClick={handleContestExport}
              disabled={exporting}
              style={{ background: "white", color: "#6c47ff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.7 : 1 }}
            >
              {exporting ? "Exporting…" : "🚀 Export Contest Package"}
            </button>
          )}
          {exportError && <div style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>{exportError}</div>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PIPELINE_STAGES.map((stage, i) => {
          const { done, total, ready } = stage.check(data);
          const pct = Math.round((done / total) * 100);
          return (
            <div
              key={stage.id}
              style={{
                background: "white",
                border: `1px solid ${ready ? "#bbf7d0" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              {/* Step number */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: ready ? "#22c55e" : "#f3f4f6",
                color: ready ? "white" : "#9ca3af",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ready ? 14 : 13, fontWeight: 700,
              }}>
                {ready ? "✓" : i + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 16 }}>{stage.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{stage.label}</span>
                  {ready && <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Done</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{stage.description}</div>

                {/* Progress bar */}
                {stage.id !== "export" && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{done}/{total}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: ready ? "#22c55e" : "#6c47ff", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (stage.id === "export") {
                      if (ready) handleContestExport();
                    } else {
                      onNavigate(stage.actionRoute);
                    }
                  }}
                  disabled={stage.id === "export" && (!ready || exporting)}
                  style={{
                    background: ready ? "#f0fdf4" : "#f9fafb",
                    color: ready ? "#166534" : "#374151",
                    border: `1px solid ${ready ? "#bbf7d0" : "#e5e7eb"}`,
                    borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                    cursor: (stage.id === "export" && (!ready || exporting)) ? "not-allowed" : "pointer",
                    opacity: (stage.id === "export" && !ready) ? 0.5 : 1,
                  }}
                >
                  {stage.id === "export" ? (exporting ? "Exporting…" : stage.action) : `→ ${stage.action}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
