"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";

interface Props {
  project: any;
  activeChap: any;
}

const TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export function AudioNovelPanel({ project, activeChap }: Props) {
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioExportId, setAudioExportId] = useState<string | null>(null);
  const [audioMsg, setAudioMsg] = useState("");
  const [lipsyncCharacterId, setLipsyncCharacterId] = useState<string>("");
  const [lipsyncStatus, setLipsyncStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [lipsyncVideoUrl, setLipsyncVideoUrl] = useState<string | null>(null);
  const [lipsyncMsg, setLipsyncMsg] = useState("");
  const [voiceOverrides, setVoiceOverrides] = useState<Record<string, string>>({});
  const [savingVoiceFor, setSavingVoiceFor] = useState<string | null>(null);

  const setCharacterVoice = async (characterId: string, voiceId: string) => {
    setSavingVoiceFor(characterId);
    setVoiceOverrides(prev => ({ ...prev, [characterId]: voiceId }));
    try {
      await fetch(`/api/projects/${project.id}/characters/${characterId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
    } finally {
      setSavingVoiceFor(null);
    }
  };

  const generateAudio = async (mode: "narration" | "podcast" = "narration") => {
    if (audioGenerating || !activeChap?.content) return;
    const wc = (activeChap.content || "").split(/\s+/).filter(Boolean).length;
    const estimatedRs = Math.round(wc * 0.002 * 83);
    const confirmMsg = mode === "podcast"
      ? `Generate a two-host podcast discussion of this chapter? Estimated cost: ~₹${estimatedRs} (plus a script-writing call). Uses your OpenAI API key.`
      : `Generate audio for this chapter? Estimated cost: ~₹${estimatedRs}. Uses your OpenAI API key.`;
    if (!window.confirm(confirmMsg)) return;
    setAudioGenerating(true);
    setAudioMsg(mode === "podcast" ? "Writing the discussion script and generating audio… this can take a minute or two." : "Generating audio… this can take a minute for a full chapter.");
    setAudioUrl(null); setAudioExportId(null);
    setLipsyncStatus("idle"); setLipsyncVideoUrl(null); setLipsyncMsg("");
    // Bounded to the server route's own maxDuration (300s) so the button —
    // and the page — always recover with a visible message instead of
    // waiting indefinitely if the server, network, or platform hangs.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, chapterId: activeChap.id, mode }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setAudioExportId(data.exportId || null);
        const label = data.mode === "podcast" ? "🎙️ Podcast" : "Narration";
        setAudioMsg(`${label} · ${Math.round(data.durationSeconds / 60)}m ${data.durationSeconds % 60}s · ${data.segments} segments`);
      } else { setAudioMsg(data.error || "Audio generation failed."); }
    } catch (err: any) {
      setAudioMsg(err?.name === "AbortError" ? "Audio generation timed out. Please try again." : "Audio generation failed.");
    } finally {
      clearTimeout(timeout);
    }
    setAudioGenerating(false);
  };

  const castCharacters: { id: string; name: string; voiceId?: string }[] = project.characters || [];

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: audioUrl ? `1px solid ${co.border}` : "none" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: co.text }}>🎧 Audio Novel</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            style={{ ...sBtnSm, background: audioGenerating ? co.surfaceAlt : co.surface, opacity: audioGenerating ? 0.7 : 1 }}
            onClick={() => generateAudio("narration")}
            disabled={audioGenerating || !activeChap?.content}
            title="Read this chapter aloud, in-character"
          >
            {audioGenerating ? "Generating…" : "Generate Audio"}
          </button>
          <button
            style={{ ...sBtnSm, background: audioGenerating ? co.surfaceAlt : co.surface, opacity: audioGenerating ? 0.7 : 1 }}
            onClick={() => generateAudio("podcast")}
            disabled={audioGenerating || !activeChap?.content}
            title="Two AI hosts discuss this chapter, NotebookLM-style"
          >
            {audioGenerating ? "Generating…" : "🎙️ Podcast Discussion"}
          </button>
        </div>
      </div>

      {castCharacters.length > 0 && (
        <div style={{ padding: "8px 14px", borderBottom: `1px solid ${co.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Voice Casting</div>
          {castCharacters.map((c) => {
            const effectiveVoice = voiceOverrides[c.id] ?? c.voiceId ?? "";
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "2px 0" }}>
                <span>{effectiveVoice ? "✅" : "⚠️"}</span>
                <span style={{ fontWeight: 600, color: co.text, minWidth: 80 }}>{c.name}</span>
                <select
                  value={effectiveVoice}
                  onChange={e => setCharacterVoice(c.id, e.target.value)}
                  disabled={savingVoiceFor === c.id}
                  style={{ fontSize: 11, padding: "2px 6px", border: `1px solid ${co.border}`, borderRadius: 4, background: co.surfaceAlt, color: co.text, cursor: "pointer" }}
                >
                  <option value="">Narrator voice (default)</option>
                  {TTS_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}

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
