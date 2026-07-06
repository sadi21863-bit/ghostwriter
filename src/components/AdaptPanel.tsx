"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { co, sBtn, sBtnSm } from "@/lib/styles";

interface Props {
  project: any;
  onClose: () => void;
}

interface AdaptTarget {
  format: string;
  label: string;
  enabled: boolean;
}

// Client-side capability map — mirrors ADAPT_CAPABILITY_MAP in
// /api/projects/[projectId]/adapt/route.ts. Only Novel->Screenplay is wired;
// the rest render disabled "Coming soon" so the menu doesn't need rework
// when more targets ship.
const ADAPT_TARGETS: Record<string, AdaptTarget[]> = {
  Novel: [
    { format: "Screenplay", label: "Screenplay", enabled: true },
    { format: "Web Series", label: "Web Series", enabled: false },
    { format: "Comic", label: "Comic (use Comic Studio)", enabled: false },
    { format: "Higgsfield Series", label: "Higgsfield Series", enabled: false },
  ],
  Screenplay: [
    { format: "Comic", label: "Comic (use Comic Studio)", enabled: false },
    { format: "Higgsfield Series", label: "Higgsfield Film/Series", enabled: false },
    { format: "Novel", label: "Novelization", enabled: true },
  ],
  "Web Series": [
    { format: "Higgsfield Series", label: "Higgsfield Series", enabled: false },
    { format: "Comic", label: "Comic (use Comic Studio)", enabled: false },
  ],
};

type View = "menu" | "preview" | "converting" | "done" | "error";

export function AdaptPanel({ project, onClose }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("menu");
  const [selectedTarget, setSelectedTarget] = useState<AdaptTarget | null>(null);
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [convertedCount, setConvertedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const sortedChapters = [...(project.chapters || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const targets = ADAPT_TARGETS[project.format] ?? [];

  async function startConversion() {
    if (!selectedTarget) return;
    setView("converting");
    setErrorMsg("");

    try {
      const createRes = await fetch(`/api/projects/${project.id}/adapt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetFormat: selectedTarget.format }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setErrorMsg(createData.error === "upgrade_required" ? "Upgrade required to use Adapt." : (createData.error || "Could not create the new project."));
        setView("error");
        return;
      }
      setNewProjectId(createData.newProjectId);

      let converted = 0;
      for (const chapter of sortedChapters) {
        const res = await fetch(`/api/projects/${createData.newProjectId}/adapt-chapter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceProjectId: project.id, sourceChapterId: chapter.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error === "Monthly generation limit reached"
            ? `Monthly generation limit reached. ${converted} of ${sortedChapters.length} chapters converted — open the new project to continue, or upgrade for more.`
            : (data.error || "Chapter conversion failed."));
          setConvertedCount(converted);
          setView("error");
          return;
        }
        converted += 1;
        setConvertedCount(converted);
      }
      setView("done");
    } catch {
      setErrorMsg("Conversion failed. Please try again.");
      setView("error");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300 }} onClick={view === "converting" ? undefined : onClose}>
      <div style={{ background: co.surface, borderRadius: 14, width: 480, maxHeight: "85vh", overflow: "auto", padding: 24, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: `1px solid ${co.border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: co.text, marginBottom: 4 }}>🎭 Adapt this story</div>
        <div style={{ fontSize: 12, color: co.muted, marginBottom: 20 }}>Convert your {project.format} into a new format. Creates a separate, linked project — your original is never modified.</div>

        {view === "menu" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {targets.length === 0 && (
              <p style={{ fontSize: 13, color: co.muted }}>No adaptation targets available for {project.format} yet.</p>
            )}
            {targets.map(t => (
              <button
                key={t.format}
                disabled={!t.enabled}
                onClick={() => { setSelectedTarget(t); setView("preview"); }}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${co.border}`, background: t.enabled ? co.surfaceAlt : "transparent",
                  cursor: t.enabled ? "pointer" : "default", opacity: t.enabled ? 1 : 0.5,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, color: co.text, fontWeight: 600 }}>{t.label}</span>
                {!t.enabled && <span style={{ fontSize: 10, color: co.muted }}>Coming soon</span>}
              </button>
            ))}
            <button style={{ ...sBtnSm, marginTop: 8 }} onClick={onClose}>Cancel</button>
          </div>
        )}

        {view === "preview" && selectedTarget && (
          <div>
            <p style={{ fontSize: 13, color: co.text, lineHeight: 1.6, marginBottom: 16 }}>
              This will convert <strong>{sortedChapters.length} chapter{sortedChapters.length === 1 ? "" : "s"}</strong> into a new {selectedTarget.label} project.
              Estimated cost: <strong>~{sortedChapters.length} generation{sortedChapters.length === 1 ? "" : "s"}</strong> (1 per chapter) against your monthly limit.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={sBtnSm} onClick={() => setView("menu")}>← Back</button>
              <button style={sBtn} onClick={startConversion}>Start Conversion</button>
            </div>
          </div>
        )}

        {view === "converting" && (
          <div>
            <p style={{ fontSize: 13, color: co.text, marginBottom: 12 }}>
              Converting chapter {Math.min(convertedCount + 1, sortedChapters.length)} of {sortedChapters.length}…
            </p>
            <div style={{ height: 6, background: co.surfaceAlt, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(convertedCount / Math.max(sortedChapters.length, 1)) * 100}%`, background: co.accent, transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        {view === "done" && newProjectId && (
          <div>
            <p style={{ fontSize: 13, color: co.text, marginBottom: 16 }}>
              ✓ Done — {convertedCount} chapter{convertedCount === 1 ? "" : "s"} converted.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={sBtnSm} onClick={onClose}>Close</button>
              <button style={sBtn} onClick={() => router.push(`/project/${newProjectId}`)}>Open {selectedTarget?.label} project →</button>
            </div>
          </div>
        )}

        {view === "error" && (
          <div>
            <p style={{ fontSize: 13, color: co.danger, lineHeight: 1.6, marginBottom: 16 }}>{errorMsg}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={sBtnSm} onClick={onClose}>Close</button>
              {newProjectId && (
                <button style={sBtn} onClick={() => router.push(`/project/${newProjectId}`)}>Open partial project →</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
