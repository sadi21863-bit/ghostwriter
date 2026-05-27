"use client";
import { useState, useEffect, useRef } from "react";
import { co, sInput, sBtn } from "@/lib/styles";

interface Props {
  show: boolean;
  setPrompt: (v: string) => void;
}

/** Competitor video dissection panel. Owns all fetch + polling state. */
export function DissectPanel({ show, setPrompt }: Props) {
  const [dissectUrl, setDissectUrl] = useState("");
  const [dissectLoading, setDissectLoading] = useState(false);
  const [dissectResult, setDissectResult] = useState<any>(null);
  const [dissectJobId, setDissectJobId] = useState<string | null>(null);
  const [dissectStatus, setDissectStatus] = useState("");
  const dissectPollRef = useRef<any>(null);

  useEffect(() => {
    return () => { if (dissectPollRef.current) clearInterval(dissectPollRef.current); };
  }, []);

  if (!show) return null;

  const startDissect = async () => {
    if (!dissectUrl.trim() || dissectLoading) return;
    setDissectLoading(true);
    setDissectResult(null);
    setDissectJobId(null);
    setDissectStatus("Starting analysis...");

    try {
      const res = await fetch("/api/ai/dissect-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: dissectUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDissectStatus("");
        setDissectLoading(false);
        return;
      }

      setDissectJobId(data.jobId);
      setDissectStatus("Watching the video… this takes 1–2 minutes");

      const poll = async () => {
        try {
          const statusRes = await fetch(`/api/ai/dissect-video/status/${data.jobId}`);
          const statusData = await statusRes.json();

          if (statusData.status === "complete") {
            setDissectResult(statusData.analysis);
            setDissectLoading(false);
            setDissectStatus("");
            clearInterval(dissectPollRef.current);
            dissectPollRef.current = null;
          } else if (statusData.status === "error") {
            setDissectLoading(false);
            setDissectStatus("");
            clearInterval(dissectPollRef.current);
            dissectPollRef.current = null;
          } else if (statusData.status === "processing") {
            setDissectStatus("Analysing structure and techniques…");
          }
        } catch { /* keep polling */ }
      };

      dissectPollRef.current = setInterval(poll, 4000);
    } catch {
      setDissectLoading(false);
      setDissectStatus("");
    }
  };

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid " + co.border, background: co.surfaceAlt }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 8 }}>🎬 Competitor Video Dissection</div>
      <div style={{ fontSize: 11, color: co.muted, marginBottom: 10 }}>Paste any public YouTube URL to see exactly how it's structured, what retention techniques it uses, and which angles it left open.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          style={{ ...sInput, flex: 1 }}
          value={dissectUrl}
          onChange={e => setDissectUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
        />
        <button
          style={{ ...sBtn, opacity: dissectLoading || !dissectUrl.trim() ? 0.5 : 1 }}
          disabled={dissectLoading || !dissectUrl.trim()}
          onClick={startDissect}
        >
          {dissectLoading ? "Analysing..." : "Dissect"}
        </button>
      </div>
      {dissectLoading && (
        <div style={{ fontSize: 12, color: co.muted, padding: "12px 0" }}>
          <div style={{ marginBottom: 4 }}>⏳ {dissectStatus}</div>
          <div style={{ fontSize: 11, color: co.border }}>Processing in the background — results appear automatically</div>
        </div>
      )}
      {dissectResult && (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>Hook</div>
            <div style={{ fontSize: 12 }}><strong>{dissectResult.hookType}</strong> — "{dissectResult.openingLine}"</div>
          </div>
          {dissectResult.totalStructure?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Structure</div>
              {dissectResult.totalStructure.map((s: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: co.muted, minWidth: 60, fontFamily: "monospace" }}>{s.timestamp}</span>
                  <span><strong>{s.section}</strong> — {s.technique}</span>
                </div>
              ))}
            </div>
          )}
          {dissectResult.whatToSteal?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>Steal these techniques</div>
              {dissectResult.whatToSteal.map((t: string, i: number) => <div key={i} style={{ fontSize: 12, padding: "3px 0" }}>• {t}</div>)}
            </div>
          )}
          {dissectResult.freshAngles?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Angles this video left open</div>
              {dissectResult.freshAngles.map((a: string, i: number) => (
                <div key={i} style={{ fontSize: 12, padding: "3px 0", cursor: "pointer", color: co.accent }} onClick={() => { setPrompt(a); }}>→ {a}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
