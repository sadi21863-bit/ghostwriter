"use client";
import { useState } from "react";
import { isCreatorFormat } from "@/lib/formats";
import { co, sBtnSm, sBtn } from "@/lib/styles";

interface Props {
  format: string;
  mode: string;
  content: string;
  setSavedMsg: (m: string) => void;
  updateProject: (fn: any) => void;
  onUpgradeRequired?: (feature: string) => void;
}

const PLATFORMS = [
  { key: "youtube_short",       label: "YT Short" },
  { key: "tiktok",              label: "TikTok" },
  { key: "instagram",           label: "Instagram" },
  { key: "twitter_thread",      label: "Thread" },
  { key: "linkedin",            label: "LinkedIn" },
  { key: "newsletter",          label: "Newsletter" },
  { key: "youtube_description", label: "YT Desc" },
];

function platformText(key: string, data: any): string {
  if (!data) return "";
  switch (key) {
    case "instagram":
      return [data.caption, "", ...(data.carouselSlides ?? []).map((s: string, i: number) => `Slide ${i + 1}: ${s}`), "", ...(data.hashtags ?? [])].join("\n");
    case "twitter_thread":
      return Array.isArray(data) ? data.map((t: string, i: number) => `${i + 1}/ ${t}`).join("\n\n") : data;
    case "newsletter":
      return `Subject: ${data.subject}\nPreview: ${data.preview}\n\n${data.body}`;
    default:
      return typeof data === "string" ? data : JSON.stringify(data, null, 2);
  }
}

export function RepurposePanel({ format, mode, content, setSavedMsg, updateProject, onUpgradeRequired }: Props) {
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<Record<string, any> | null>(null);
  const [activeTab, setActiveTab] = useState("youtube_short");
  const [copied, setCopied]     = useState(false);

  if (mode !== "write" || !isCreatorFormat(format) || !content?.trim()) return null;

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: content, format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else {
        setResult(data);
        const firstAvail = PLATFORMS.find(p => data[p.key]);
        if (firstAvail) setActiveTab(firstAvail.key);
        setShow(true);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const copyActive = () => {
    if (!result) return;
    navigator.clipboard.writeText(platformText(activeTab, result[activeTab]));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyAll = () => {
    if (!result) return;
    const all = PLATFORMS
      .filter(p => result[p.key])
      .map(p => `=== ${p.label.toUpperCase()} ===\n\n${platformText(p.key, result[p.key])}`)
      .join("\n\n\n");
    navigator.clipboard.writeText(all);
    setSavedMsg("All platforms copied!"); setTimeout(() => setSavedMsg(""), 1800);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#ede9fe", color: "#7c3aed", fontWeight: 600, opacity: loading ? 0.5 : 1 }}
        disabled={loading}
        onClick={run}
      >
        {loading ? "..." : "♻️ Atomise"}
      </button>

      {show && result && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShow(false)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 680, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>♻️ Content Atomiser</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setShow(false)}>×</button>
            </div>

            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14, flexShrink: 0 }}>
              {PLATFORMS.filter(p => result[p.key]).map(p => (
                <button
                  key={p.key}
                  style={{ ...sBtnSm, fontSize: 11, background: activeTab === p.key ? co.accentBg : co.surfaceAlt, color: activeTab === p.key ? co.accent : co.muted, border: "1px solid " + (activeTab === p.key ? co.accent : co.border) }}
                  onClick={() => setActiveTab(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
              {platformText(activeTab, result[activeTab])}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexShrink: 0 }}>
              <button style={sBtnSm} onClick={() => setShow(false)}>Close</button>
              <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent }} onClick={copyActive}>
                {copied ? "✓ Copied!" : `Copy ${PLATFORMS.find(p => p.key === activeTab)?.label ?? ""}`}
              </button>
              <button style={{ ...sBtn }} onClick={copyAll}>Copy All Platforms</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
