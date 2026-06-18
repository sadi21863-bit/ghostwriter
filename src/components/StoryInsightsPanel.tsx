"use client";
import { useMemo, useState } from "react";
import { co, sBtnSm } from "@/lib/styles";
import { ArcHeatMap } from "@/components/ArcHeatMap";
import { TensionCurve } from "@/components/TensionCurve";
import { ConstellationView } from "@/components/ConstellationView";
import { analyzeProseRhythm } from "@/lib/analysis/rhythm";

interface Props {
  projectId: string;
  content?: string;
}

type Tab = "arc" | "tension" | "relationships" | "rhythm";

const TABS: { id: Tab; label: string }[] = [
  { id: "arc", label: "Character Arc" },
  { id: "tension", label: "Tension Curve" },
  { id: "relationships", label: "Relationships" },
  { id: "rhythm", label: "Prose Rhythm" },
];

// Extract plain text from a TipTap JSON document.
function tipTapToText(raw: string): string {
  if (!raw) return "";
  try {
    const doc = JSON.parse(raw);
    const walk = (n: any): string => {
      if (!n) return "";
      if (n.type === "text") return n.text || "";
      const children = (n.content || []).map(walk).join("");
      if (n.type === "paragraph" || n.type === "heading") return children + "\n\n";
      if (n.type === "hardBreak") return "\n";
      return children;
    };
    return (doc.content || []).map(walk).join("").trim();
  } catch {
    return raw;
  }
}

const SEV_COLOR: Record<string, string> = { high: co.danger, med: co.orange, low: co.muted };

function ProseRhythmView({ content }: { content?: string }) {
  const report = useMemo(() => analyzeProseRhythm(tipTapToText(content || "")), [content]);

  if (report.wordCount < 40) {
    return <p style={{ fontSize: 12, color: co.muted, margin: "4px 2px" }}>Write a bit more — prose rhythm analysis appears once the chapter has some prose.</p>;
  }

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div style={{ flex: 1, minWidth: 70, padding: "8px 10px", background: co.surfaceAlt, borderRadius: 8, border: `1px solid ${co.border}` }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: co.text }}>{value}</div>
      <div style={{ fontSize: 10, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );

  return (
    <div data-testid="prose-rhythm-view">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Stat label="Words" value={report.wordCount} />
        <Stat label="Sentences" value={report.sentenceCount} />
        <Stat label="Avg length" value={report.avgSentenceLen} />
        <Stat label="-ly adverbs" value={`${report.adverbPct}%`} />
      </div>
      {report.flags.length === 0 ? (
        <div style={{ padding: "10px 12px", background: co.accentBg, border: `1px solid ${co.border}`, borderRadius: 8, fontSize: 12, color: co.text }}>
          ✓ Clean rhythm — varied sentence lengths, no repeated openers or phrases detected.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {report.flags.map((f, i) => (
            <div key={i} style={{ padding: "8px 10px", background: co.surfaceAlt, borderRadius: 8, borderLeft: `3px solid ${SEV_COLOR[f.severity]}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: co.text }}>
                {f.label} <span style={{ fontSize: 10, color: SEV_COLOR[f.severity], textTransform: "uppercase" }}>· {f.severity}</span>
              </div>
              <div style={{ fontSize: 11, color: co.muted, lineHeight: 1.5, marginTop: 2 }}>{f.detail}</div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 10, color: co.muted, marginTop: 8, fontStyle: "italic" }}>Deterministic analysis — instant, runs locally, no AI cost.</p>
    </div>
  );
}

export function StoryInsightsPanel({ projectId, content }: Props) {
  const [tab, setTab] = useState<Tab>("arc");

  return (
    <div style={{ padding: "10px 12px", background: co.surface, border: `1px solid ${co.border}`, borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              ...sBtnSm,
              fontSize: 11,
              background: tab === t.id ? co.accent : "transparent",
              color: tab === t.id ? "#fffdf9" : co.muted,
              border: `1px solid ${tab === t.id ? co.accent : co.border}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "arc" && <ArcHeatMap projectId={projectId} />}
      {tab === "tension" && <TensionCurve projectId={projectId} />}
      {tab === "relationships" && <ConstellationView projectId={projectId} />}
      {tab === "rhythm" && <ProseRhythmView content={content} />}
    </div>
  );
}
