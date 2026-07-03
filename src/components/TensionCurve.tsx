"use client";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface ChapterScore {
  chapterId: string;
  title: string;
  suspense: number;
  curiosity: number;
  emotionalIntensity: number;
  dialogueDensity: number;
  note: string;
}

interface TensionCurveProps {
  projectId: string;
}

const CustomDot = (props: any) => {
  const { cx, cy, payload, onDotClick } = props;
  return (
    <circle
      cx={cx} cy={cy} r={4}
      fill="currentColor"
      style={{ cursor: "pointer" }}
      onClick={() => onDotClick && onDotClick(payload.note)}
    />
  );
};

export function TensionCurve({ projectId }: TensionCurveProps) {
  const [data, setData] = useState<ChapterScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeNote, setActiveNote] = useState<string>("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/tension-curve`, { method: "POST" });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setData(json.scores ?? []);
    } catch { setError("Failed to generate curve."); }
    finally { setLoading(false); }
  };

  const chartData = data.map((d) => ({
    name: d.title.length > 14 ? d.title.slice(0, 14) + "…" : d.title,
    Suspense: d.suspense,
    Curiosity: d.curiosity,
    "Emotional Intensity": d.emotionalIntensity,
    note: d.note,
  }));

  return (
    <div style={{ padding: "24px", background: "var(--color-bg-surface)", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Story Tension Curve
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Brewer & Lichtenstein structural affect scoring across all chapters
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "#333" : "var(--color-accent)",
            color: "var(--color-accent-fg)", fontSize: 13, fontWeight: 500,
          }}
        >
          {loading ? "Scoring…" : data.length ? "Re-score" : "Generate Curve"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#2a1010", borderRadius: 8, color: "#f87171", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {data.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9898A6" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9898A6" }} />
              <Tooltip
                contentStyle={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--color-text-primary)", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={7} stroke="var(--color-border-default)" strokeDasharray="4 4"
                label={{ value: "High", position: "right", fontSize: 10, fill: "#9898A6" }} />
              <Line type="monotone" dataKey="Suspense"
                stroke="#EF4444" strokeWidth={2}
                dot={(p: any) => <CustomDot {...p} onDotClick={setActiveNote} />}
                activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Curiosity"
                stroke="#F59E0B" strokeWidth={2}
                dot={(p: any) => <CustomDot {...p} onDotClick={setActiveNote} />}
                activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Emotional Intensity"
                stroke="#8B5CF6" strokeWidth={2}
                dot={(p: any) => <CustomDot {...p} onDotClick={setActiveNote} />}
                activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>

          {activeNote && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--color-bg-elevated)", borderRadius: 8, fontSize: 13, color: "#D1D5DB", borderLeft: "3px solid var(--color-accent)" }}>
              {activeNote}
            </div>
          )}

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "Avg Suspense", value: (data.reduce((s, d) => s + d.suspense, 0) / data.length).toFixed(1), color: "#EF4444" },
              { label: "Avg Curiosity", value: (data.reduce((s, d) => s + d.curiosity, 0) / data.length).toFixed(1), color: "#F59E0B" },
              { label: "Avg Intensity", value: (data.reduce((s, d) => s + d.emotionalIntensity, 0) / data.length).toFixed(1), color: "#8B5CF6" },
            ].map(stat => (
              <div key={stat.label} style={{ padding: "10px 14px", background: "var(--color-bg-elevated)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {data.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-secondary)", fontSize: 14 }}>
          Generate the curve to see how your story's tension, curiosity, and emotional intensity develop across chapters.
        </div>
      )}
    </div>
  );
}
