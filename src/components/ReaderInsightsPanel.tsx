"use client";
import { useEffect, useState } from "react";
import { co, sBtnSm } from "@/lib/styles";
import type { ReaderInsights } from "@/lib/reader/insights";

interface Props { project: any; }

export default function ReaderInsightsPanel({ project }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReaderInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    fetch(`/api/projects/${project.id}/reader-insights`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, data, project.id]);

  const maxReactions = data ? Math.max(1, ...data.byChapter.map(c => c.reactions)) : 1;

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>📊 Reader Insights</div>
        <button style={sBtnSm} onClick={() => setOpen(o => !o)}>{open ? "Hide" : "Show"}</button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ fontSize: 12, color: co.muted }}>Loading…</div>}
          {!loading && data && data.totalSessions === 0 && (
            <div style={{ fontSize: 12, color: co.muted }}>No reader sessions yet. Share a draft to start collecting reactions.</div>
          )}
          {!loading && data && data.totalSessions > 0 && (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <Stat label="Readers" value={data.totalSessions} />
                <Stat label="Reactions" value={data.totalReactions} />
                <Stat label="Cold chapters" value={data.coldChapters.length} accent={data.coldChapters.length > 0 ? co.orange : undefined} />
              </div>

              {Object.keys(data.reactionTypeTotals).length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  {Object.entries(data.reactionTypeTotals).map(([t, n]) => (
                    <span key={t} style={{ fontSize: 11, color: co.text, background: co.surfaceAlt, borderRadius: 20, padding: "2px 10px" }}>{t} · {n}</span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.byChapter.map(ch => (
                  <div key={ch.chapterId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: co.text, width: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.title}</span>
                    <div style={{ flex: 1, height: 8, background: co.surfaceAlt, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(ch.reactions / maxReactions) * 100}%`, height: "100%", background: ch.chapterId === data.hottestChapterId ? co.green : ch.reactions === 0 ? co.orange : co.accent }} />
                    </div>
                    <span style={{ fontSize: 11, color: co.muted, width: 28, textAlign: "right" }}>{ch.reactions}</span>
                  </div>
                ))}
              </div>

              {data.coldChapters.length > 0 && (
                <div style={{ fontSize: 11, color: co.muted, marginTop: 10 }}>
                  ❄️ Cold (no reactions): {data.coldChapters.map(c => c.title).join(", ")} — candidates for an Editor pass.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? co.text }}>{value}</div>
      <div style={{ fontSize: 10, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}
