"use client";
import { useState, useEffect } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";

interface Job {
  id: string;
  youtubeUrl: string;
  status: string;
  createdAt: string;
}

interface Props {
  format: string;
  onUpgradeRequired?: (feature: string) => void;
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    return v ? `youtube.com/watch?v=${v.slice(0, 8)}…` : url.slice(0, 40) + "…";
  } catch { return url.slice(0, 40); }
}

export function ChannelAutopsyPanel({ format, onUpgradeRequired }: Props) {
  const [show, setShow]             = useState(false);
  const [jobs, setJobs]             = useState<Job[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(false);
  const [fetching, setFetching]     = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!show) return;
    const ctrl = new AbortController();
    setFetching(true);
    fetch("/api/ai/dissect-video", { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setJobs((d.jobs ?? []).filter((j: Job) => j.status === "completed")))
      .catch(e => { if (e.name !== "AbortError") {} })
      .finally(() => setFetching(false));
    return () => ctrl.abort();
  }, [show]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const run = async () => {
    if (selected.size < 2 || loading) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/ai/channel-autopsy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: [...selected] }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); setShow(false); }
      else if (data.error) setError(data.error);
      else setResult(data);
    } catch { setError("Autopsy failed. Try again."); }
    setLoading(false);
  };

  if (!["YouTube Long-form", "YouTube Short"].includes(format)) return null;

  return (
    <>
      <button
        style={{ ...sBtnSm, background: show ? co.accentBg : co.surfaceAlt, color: show ? co.accent : co.muted, border: "1px solid " + (show ? co.accent : co.border) }}
        onClick={() => { setShow(v => !v); setResult(null); setSelected(new Set()); }}
      >
        🔬 Channel Autopsy
      </button>

      {show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 620, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>🔬 Channel Autopsy</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: co.muted }} onClick={() => setShow(false)}>×</button>
            </div>

            {!result && (
              <>
                <div style={{ fontSize: 12, color: co.muted, marginBottom: 14 }}>
                  Select 2–10 completed video dissections to find your channel's structural DNA and content gaps.
                </div>

                {fetching && <div style={{ fontSize: 12, color: co.muted, padding: "12px 0" }}>Loading your dissection history…</div>}

                {!fetching && jobs.length === 0 && (
                  <div style={{ fontSize: 12, color: co.muted, padding: "16px 0", textAlign: "center" }}>
                    No completed video analyses yet. Run Video Dissection on 2+ videos first.
                  </div>
                )}

                {jobs.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
                    {jobs.map(j => (
                      <label key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: selected.has(j.id) ? co.accentBg : co.surfaceAlt, borderRadius: 8, border: "1px solid " + (selected.has(j.id) ? co.accent : co.border), cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={selected.has(j.id)}
                          onChange={() => toggle(j.id)}
                          style={{ accentColor: co.accent }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: co.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortUrl(j.youtubeUrl)}</div>
                          <div style={{ fontSize: 10, color: co.muted }}>{new Date(j.createdAt).toLocaleDateString()}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {error && <div style={{ fontSize: 12, color: co.danger, marginBottom: 10 }}>{error}</div>}

                <button
                  style={{ ...sBtn, width: "100%", opacity: selected.size < 2 || loading ? 0.5 : 1 }}
                  disabled={selected.size < 2 || loading}
                  onClick={run}
                >
                  {loading ? "Analysing patterns…" : `Analyse ${selected.size} video${selected.size !== 1 ? "s" : ""}`}
                </button>
              </>
            )}

            {result && (
              <div>
                {result.channelDNA && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 10 }}>Channel DNA</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {result.channelDNA.dominantHookTypes?.length > 0 && (
                        <div style={{ padding: "10px 12px", background: co.surfaceAlt, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 4 }}>Dominant Hook Types</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {result.channelDNA.dominantHookTypes.map((h: string, i: number) => (
                              <span key={i} style={{ fontSize: 11, padding: "2px 8px", background: co.accentBg, color: co.accent, borderRadius: 20, fontWeight: 600 }}>{h}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.channelDNA.typicalStructure && (
                        <div style={{ padding: "10px 12px", background: co.surfaceAlt, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 4 }}>Typical Structure</div>
                          <div style={{ fontSize: 12 }}>{result.channelDNA.typicalStructure}</div>
                        </div>
                      )}
                      {result.channelDNA.voiceSignature && (
                        <div style={{ padding: "10px 12px", background: co.surfaceAlt, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 4 }}>Voice Signature</div>
                          <div style={{ fontSize: 12 }}>{result.channelDNA.voiceSignature}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {result.contentGaps?.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>Content Gaps</div>
                    {result.contentGaps.map((g: any, i: number) => (
                      <div key={i} style={{ padding: "10px 12px", background: "#fffbeb", borderRadius: 8, marginBottom: 8, border: "1px solid #fbbf24" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{g.gap}</div>
                        <div style={{ fontSize: 11, color: "#92400e", marginBottom: 4 }}>{g.evidence}</div>
                        <div style={{ fontSize: 11, color: "#d97706", fontStyle: "italic" }}>Angle: {g.suggestedAngle}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                  {result.strengths?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>Strengths</div>
                      {result.strengths.map((s: string, i: number) => <div key={i} style={{ fontSize: 11, padding: "3px 0", color: co.text }}>✓ {s}</div>)}
                    </div>
                  )}
                  {result.weaknesses?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 6 }}>Weaknesses</div>
                      {result.weaknesses.map((w: string, i: number) => <div key={i} style={{ fontSize: 11, padding: "3px 0", color: co.text }}>✗ {w}</div>)}
                    </div>
                  )}
                </div>

                {result.nextVideoRecommendation && (
                  <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #86efac", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>Next Video Recommendation</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{result.nextVideoRecommendation.title}</div>
                    <div style={{ fontSize: 12, color: "#166534", marginBottom: 4, fontStyle: "italic" }}>Hook: {result.nextVideoRecommendation.hook}</div>
                    <div style={{ fontSize: 11, color: "#15803d" }}>{result.nextVideoRecommendation.rationale}</div>
                  </div>
                )}

                <button style={{ ...sBtnSm }} onClick={() => { setResult(null); setSelected(new Set()); }}>← Run Another</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
