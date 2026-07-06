"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { toast } from "@/lib/toast";

interface BetaReaderResult {
  persona: string;
  reaction: string;
  highlights: string[];
  concerns: string[];
  verdict: string;
  dnfPoint?: string;
}

interface BetaPanelSummary {
  continueCount: number;
  mightStopCount: number;
  dnfCount: number;
  headline: string;
}

const VERDICT_COLOR: Record<string, string> = {
  would_continue: co.green,
  might_stop: co.orange,
  would_dnf: co.danger,
};

const VERDICT_LABEL: Record<string, string> = {
  would_continue: "Would continue",
  might_stop: "Might stop",
  would_dnf: "Would DNF",
};

interface BetaReaderPanelProps {
  text: string;
  format: string;
}

// Deliberate, user-triggered simulated-reader feedback — never automatic
// (unlike the quality-check stack, which auto-fires after generation). Sends
// only the passage itself, no World Bible / promise-ledger context, so the
// 3 personas read cold like a real reader would. See
// src/lib/roles/editor.ts's BETA_READER_PERSONAS for the persona definitions.
export default function BetaReaderPanel({ text, format }: BetaReaderPanelProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BetaReaderResult[] | null>(null);
  const [summary, setSummary] = useState<BetaPanelSummary | null>(null);

  const runBetaRead = async () => {
    if (running || !text.trim()) return;
    setRunning(true);
    try {
      const res = await fetch("/api/ai/beta-read", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, format }),
      });
      if (res.status === 403) { toast.error("Beta Reader Panel needs a Story Pro plan."); return; }
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setResults(data.results); setSummary(data.summary);
    } catch {
      toast.error("Beta read failed. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>🎭 Beta Reader Panel</div>
        <button style={{ ...sBtnSm, opacity: running ? 0.6 : 1 }} disabled={running || !text.trim()} onClick={runBetaRead}>
          {running ? "Reading…" : "Run Beta Read"}
        </button>
      </div>

      {summary && (
        <p style={{ fontSize: 13, color: co.text, lineHeight: 1.6, margin: "0 0 10px" }}>{summary.headline}</p>
      )}

      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map(r => (
            <div key={r.persona} style={{ border: `1px solid ${co.border}`, borderRadius: 8, padding: "10px 12px", background: co.bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: co.text, flex: 1 }}>{r.persona}</span>
                <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 20, background: `color-mix(in srgb, ${VERDICT_COLOR[r.verdict] ?? co.muted} 12%, transparent)`, color: VERDICT_COLOR[r.verdict] ?? co.muted }}>
                  {VERDICT_LABEL[r.verdict] ?? r.verdict}
                </span>
              </div>
              <p style={{ fontSize: 12, color: co.text, lineHeight: 1.5, margin: "0 0 6px", fontStyle: "italic" }}>&ldquo;{r.reaction}&rdquo;</p>
              {r.highlights?.length > 0 && (
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 2 }}>👍 {r.highlights.join(" · ")}</div>
              )}
              {r.concerns?.length > 0 && (
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 2 }}>⚠️ {r.concerns.join(" · ")}</div>
              )}
              {r.dnfPoint && (
                <div style={{ fontSize: 11, color: co.danger, marginTop: 4, padding: "6px 8px", background: co.surfaceAlt, borderRadius: 6 }}>
                  Stopped at: &ldquo;{r.dnfPoint}&rdquo;
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!results && !running && (
        <p style={{ fontSize: 12, color: co.muted, lineHeight: 1.5, margin: 0 }}>
          Get simulated reader reactions from 3 distinct reader personas, cold — no story bible context, just the passage.
        </p>
      )}
    </div>
  );
}
