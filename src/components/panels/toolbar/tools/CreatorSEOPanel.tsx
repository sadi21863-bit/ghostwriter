"use client";
import { useState } from "react";
import { isCreatorFormat } from "@/lib/formats";
import { co, sBtn, sBtnSm } from "@/lib/styles";

interface Props {
  format: string;
  mode: string;
  content: string;
  onUpgradeRequired?: (feature: string) => void;
}

const CTR_COLORS: Record<string, string> = {
  high:   "#10b981",
  medium: "#f59e0b",
  low:    "#ef4444",
};

const TRIGGER_COLORS: Record<string, string> = {
  curiosity:  "#3b82f6",
  fear:       "#ef4444",
  desire:     "#ec4899",
  surprise:   "#8b5cf6",
  validation: "#10b981",
};

export function CreatorSEOPanel({ format, mode, content, onUpgradeRequired }: Props) {
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [tab, setTab]           = useState<"titles" | "description" | "tags" | "keywords">("titles");
  const [removedTags, setRemovedTags] = useState<Set<number>>(new Set());
  const [copied, setCopied]     = useState<string | null>(null);

  const youtubeFormats = ["YouTube Long-form", "YouTube Short"];
  if (!youtubeFormats.includes(format) || mode !== "write" || !content?.trim()) return null;

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setRemovedTags(new Set());
    try {
      const res = await fetch("/api/ai/creator-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: content }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else { setResult(data); setShow(true); setTab("titles"); }
    } catch { /* silent */ }
    setLoading(false);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const TABS = [
    { key: "titles",      label: "Titles" },
    { key: "description", label: "Description" },
    { key: "tags",        label: "Tags" },
    { key: "keywords",    label: "Keywords" },
  ] as const;

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#ecfdf5", color: "#059669", fontWeight: 600, opacity: loading ? 0.5 : 1 }}
        disabled={loading}
        onClick={run}
      >
        {loading ? "Generating…" : "🔍 SEO Suite"}
      </button>

      {show && result && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShow(false)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 680, maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔍 YouTube SEO Suite</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setShow(false)}>×</button>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 14, flexShrink: 0 }}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  style={{ ...sBtnSm, background: tab === t.key ? "#ecfdf5" : co.surfaceAlt, color: tab === t.key ? "#059669" : co.muted, border: "1px solid " + (tab === t.key ? "#059669" : co.border) }}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>

              {tab === "titles" && result.titleVariants && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.titleVariants.map((v: any, i: number) => (
                    <div key={i} style={{ padding: "12px 14px", background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: (CTR_COLORS[v.ctrPrediction] ?? "#gray") + "22", color: CTR_COLORS[v.ctrPrediction] ?? co.muted, fontWeight: 700 }}>
                          {v.ctrPrediction?.toUpperCase()} CTR
                        </span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: (TRIGGER_COLORS[v.psychologicalTrigger] ?? co.accent) + "22", color: TRIGGER_COLORS[v.psychologicalTrigger] ?? co.accent, fontWeight: 600 }}>
                          {v.psychologicalTrigger}
                        </span>
                        <span style={{ fontSize: 10, color: v.characterCount > 70 ? "#ef4444" : co.muted, marginLeft: "auto" }}>
                          {v.characterCount} chars
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 8 }}>{v.title}</div>
                      <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(v.title, `title-${i}`)}>
                        {copied === `title-${i}` ? "✓ Copied!" : "Copy Title"}
                      </button>
                    </div>
                  ))}
                  {result.thumbnailTextSuggestion && (
                    <div style={{ padding: "10px 14px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fbbf24" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 4 }}>Thumbnail Text</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#78350f" }}>{result.thumbnailTextSuggestion}</div>
                    </div>
                  )}
                </div>
              )}

              {tab === "description" && result.description && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Above the Fold</div>
                      <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(result.description.aboveFold, "fold")}>
                        {copied === "fold" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                    <div style={{ padding: "10px 12px", background: "#ecfdf5", borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap", border: "1px solid #86efac" }}>
                      {result.description.aboveFold}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase" }}>Full Description</div>
                      <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(result.description.fullDescription, "desc")}>
                        {copied === "desc" ? "✓ Copied!" : "Copy Full"}
                      </button>
                    </div>
                    <div style={{ padding: "12px 14px", background: co.surfaceAlt, borderRadius: 10, fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", border: "1px solid " + co.border, maxHeight: 280, overflowY: "auto" }}>
                      {result.description.fullDescription}
                    </div>
                  </div>

                  {result.description.chapters?.length > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase" }}>Chapters</div>
                        <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(result.description.chapters.join("\n"), "chapters")}>
                          {copied === "chapters" ? "✓ Copied!" : "Copy Timestamps"}
                        </button>
                      </div>
                      {result.description.chapters.map((ch: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, padding: "3px 0", fontFamily: "monospace" }}>{ch}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "tags" && result.tags && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: co.muted }}>Click a tag to remove it before copying.</div>
                    <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(result.tags.filter((_: any, i: number) => !removedTags.has(i)).join(", "), "tags")}>
                      {copied === "tags" ? "✓ Copied!" : "Copy Tags"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.tags.map((tag: string, i: number) => !removedTags.has(i) && (
                      <button
                        key={i}
                        style={{ fontSize: 12, padding: "4px 12px", background: co.surfaceAlt, borderRadius: 20, border: "1px solid " + co.border, cursor: "pointer", color: co.text }}
                        onClick={() => setRemovedTags(prev => new Set([...prev, i]))}
                        title="Click to remove"
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, color: co.muted }}>
                    {result.tags.length - removedTags.size} tags remaining
                  </div>
                </div>
              )}

              {tab === "keywords" && result.keywordAnalysis && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: "14px", background: "#ecfdf5", borderRadius: 10, border: "1px solid #86efac" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", marginBottom: 4 }}>Primary Keyword</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{result.keywordAnalysis.primaryKeyword}</div>
                  </div>
                  {result.keywordAnalysis.secondaryKeywords?.length > 0 && (
                    <div style={{ padding: "12px 14px", background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 8 }}>Secondary Keywords</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {result.keywordAnalysis.secondaryKeywords.map((kw: string, i: number) => (
                          <span key={i} style={{ fontSize: 12, padding: "3px 10px", background: "#ecfdf5", color: "#059669", borderRadius: 20 }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.keywordAnalysis.longTailOpportunity && (
                    <div style={{ padding: "12px 14px", background: "#fffbeb", borderRadius: 10, border: "1px solid #fbbf24" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 4 }}>Long-Tail Opportunity</div>
                      <div style={{ fontSize: 13, color: "#78350f" }}>{result.keywordAnalysis.longTailOpportunity}</div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
