"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";

interface Props {
  project: any;
  activeChap: any;
}

export function AudioNovelPanel({ project, activeChap }: Props) {
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioExportId, setAudioExportId] = useState<string | null>(null);
  const [audioMsg, setAudioMsg] = useState("");
  const [lipsyncCharacterId, setLipsyncCharacterId] = useState<string>("");
  const [lipsyncStatus, setLipsyncStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [lipsyncVideoUrl, setLipsyncVideoUrl] = useState<string | null>(null);
  const [lipsyncMsg, setLipsyncMsg] = useState("");

  const generateAudio = async () => {
    if (audioGenerating || !activeChap?.content) return;
    const wc = (activeChap.content || "").split(/\s+/).filter(Boolean).length;
    const estimatedRs = Math.round(wc * 0.002 * 83);
    if (!window.confirm(`Generate audio for this chapter? Estimated cost: ~₹${estimatedRs}. Uses your OpenAI API key.`)) return;
    setAudioGenerating(true); setAudioMsg("Generating audio..."); setAudioUrl(null); setAudioExportId(null);
    setLipsyncStatus("idle"); setLipsyncVideoUrl(null); setLipsyncMsg("");
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setAudioExportId(data.exportId || null);
        setAudioMsg(`${Math.round(data.durationSeconds / 60)}m ${data.durationSeconds % 60}s · ${data.segments} segments`);
      } else { setAudioMsg(data.error || "Audio generation failed."); }
    } catch { setAudioMsg("Audio generation failed."); }
    setAudioGenerating(false);
  };

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: audioUrl ? `1px solid ${co.border}` : "none" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: co.text }}>🎧 Audio Novel</span>
        <button
          style={{ ...sBtnSm, background: audioGenerating ? co.surfaceAlt : co.surface, opacity: audioGenerating ? 0.7 : 1 }}
          onClick={generateAudio}
          disabled={audioGenerating || !activeChap?.content}
        >
          {audioGenerating ? "Generating…" : "Generate Audio"}
        </button>
      </div>

      {audioUrl && (
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${co.border}` }}>
          <audio controls style={{ width: "100%", height: 32 }} src={audioUrl} />
        </div>
      )}
      {audioMsg && (
        <div style={{ padding: "4px 14px", fontSize: 10, color: co.muted }}>{audioMsg}</div>
      )}

      {/* Lipsync Video Section — shown after audio is ready */}
      {audioUrl && audioExportId && (() => {
        const charsWithPortrait = (project.characters || []).filter((c: any) => c.portraitUrl);
        return (
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${co.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>🎬 Lipsync Video</div>

            {lipsyncVideoUrl ? (
              <div>
                <a
                  href={lipsyncVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#5b4ccc", textDecoration: "underline", display: "block", marginBottom: 4 }}
                >
                  Play Lipsync Video ↗
                </a>
              </div>
            ) : lipsyncStatus === "processing" ? (
              <div style={{ fontSize: 11, color: co.muted, fontStyle: "italic" }}>
                {lipsyncMsg || "Generating… this may take a minute."}
                <button
                  style={{ marginLeft: 8, padding: "2px 8px", fontSize: 10, border: `1px solid ${co.border}`, borderRadius: 4, background: co.surfaceAlt, cursor: "pointer", color: co.muted }}
                  onClick={async () => {
                    setLipsyncMsg("Checking status…");
                    try {
                      const r = await fetch(`/api/audio/lipsync?audioExportId=${audioExportId}`);
                      const d = await r.json();
                      if (d.status === "completed" && d.videoUrl) {
                        setLipsyncVideoUrl(d.videoUrl);
                        setLipsyncStatus("completed");
                        setLipsyncMsg("");
                      } else if (d.status === "failed") {
                        setLipsyncStatus("failed");
                        setLipsyncMsg("Lipsync generation failed.");
                      } else {
                        setLipsyncMsg("Still processing… check again in a moment.");
                      }
                    } catch { setLipsyncMsg("Status check failed."); }
                  }}
                >
                  Check status
                </button>
              </div>
            ) : lipsyncStatus === "failed" ? (
              <div style={{ fontSize: 11, color: co.danger }}>{lipsyncMsg || "Lipsync generation failed."}</div>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {charsWithPortrait.length === 0 ? (
                  <div style={{ fontSize: 11, color: co.muted, fontStyle: "italic" }}>
                    No character portraits found. Generate a portrait in the World Bible first.
                  </div>
                ) : (
                  <>
                    {charsWithPortrait.length > 1 && (
                      <select
                        value={lipsyncCharacterId}
                        onChange={e => setLipsyncCharacterId(e.target.value)}
                        style={{ fontSize: 11, padding: "3px 6px", border: `1px solid ${co.border}`, borderRadius: 4, background: co.surfaceAlt, color: co.text, cursor: "pointer" }}
                      >
                        <option value="">Select character…</option>
                        {charsWithPortrait.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      style={{ ...sBtnSm, fontSize: 10, padding: "3px 10px" }}
                      onClick={async () => {
                        const charId = charsWithPortrait.length === 1
                          ? charsWithPortrait[0].id
                          : lipsyncCharacterId;
                        if (!charId) { setLipsyncMsg("Select a character first."); return; }
                        setLipsyncStatus("processing");
                        setLipsyncMsg("Generating… this may take a minute.");
                        try {
                          const r = await fetch("/api/audio/lipsync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ audioExportId, characterId: charId, projectId: project.id }),
                          });
                          const d = await r.json();
                          if (d.error) {
                            setLipsyncStatus("failed");
                            setLipsyncMsg(d.error);
                          } else if (d.status === "processing") {
                            setLipsyncMsg("Generating… this may take a minute. Click 'Check status' when ready.");
                          }
                        } catch { setLipsyncStatus("failed"); setLipsyncMsg("Lipsync request failed."); }
                      }}
                      disabled={charsWithPortrait.length > 1 && !lipsyncCharacterId}
                    >
                      Create Lipsync Video
                    </button>
                    {lipsyncMsg && <div style={{ fontSize: 10, color: co.muted }}>{lipsyncMsg}</div>}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
