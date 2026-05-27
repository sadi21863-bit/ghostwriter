"use client";
import type { ProseResult } from "../types";
import { co, sBtnSm, sBtn } from "@/lib/styles";

interface Props {
  mode: string;
  selectedText: string;
  setSelectedText: (v: string) => void;
  setSelectedRange: (v: any) => void;
  proseLoading: boolean;
  proseResult: ProseResult | null;
  setProseResult: (v: ProseResult | null) => void;
  runProse: (mode: string) => Promise<void>;
  replaceSelection: (text: string) => void;
}

export function ProsePanel({
  mode, selectedText, setSelectedText, setSelectedRange,
  proseLoading, proseResult, setProseResult, runProse, replaceSelection,
}: Props) {
  return (
    <>
      {/* Floating selection toolbar — only in write mode */}
      {mode === "write" && selectedText && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 110, zIndex: 50, display: "flex", gap: 4, background: co.surface, border: "1px solid " + co.border, borderRadius: 10, padding: "6px 8px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
          {proseLoading
            ? <span style={{ fontSize: 12, color: co.muted, padding: "4px 8px" }}>Generating...</span>
            : <>
              <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("expand")}>✨ Expand</button>
              <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("rewrite")}>🔄 Rewrite</button>
              <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("show-dont-tell")}>👁 Show Don't Tell</button>
              <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("tighten")}>✂️ Tighten</button>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "0 4px" }} onClick={() => { setSelectedText(""); setSelectedRange(null); }}>×</button>
            </>}
        </div>
      )}

      {/* Prose Result Modal */}
      {proseResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setProseResult(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 600, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {proseResult.mode === "expand" ? "✨ Expanded" : proseResult.mode === "rewrite" ? "🔄 Rewrites" : proseResult.mode === "tighten" ? "✂️ Tightened" : "👁 Show Don't Tell"}
              </h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setProseResult(null)}>×</button>
            </div>
            {proseResult.mode === "rewrite" && proseResult.variants ? (
              <>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 12 }}>Select a variant to use:</div>
                {proseResult.variants.map((v: string, i: number) => (
                  <div key={i}
                    onClick={() => setProseResult({ ...proseResult, chosen: i })}
                    style={{ padding: 14, borderRadius: 10, marginBottom: 8, border: "2px solid " + (proseResult.chosen === i ? co.accent : co.border), cursor: "pointer", background: proseResult.chosen === i ? co.accentBg : co.surfaceAlt, fontSize: 14, lineHeight: 1.7, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: proseResult.chosen === i ? co.accent : co.muted, marginBottom: 6 }}>VARIANT {i + 1}</div>
                    {v}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                  <button style={sBtnSm} onClick={() => setProseResult(null)}>Discard</button>
                  <button style={{ ...sBtnSm, opacity: proseLoading ? 0.5 : 1 }} disabled={proseLoading} onClick={() => runProse("rewrite")}>{proseLoading ? "Regenerating..." : "↺ Regenerate"}</button>
                  <button style={sBtn} onClick={() => proseResult.variants && replaceSelection(proseResult.variants[proseResult.chosen ?? 0])}>Use This</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: 16, borderRadius: 10, background: co.surfaceAlt, fontSize: 14, lineHeight: 1.8, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap", marginBottom: 16 }}>{proseResult.result}</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={sBtnSm} onClick={() => setProseResult(null)}>Discard</button>
                  <button style={sBtn} onClick={() => proseResult.result && replaceSelection(proseResult.result)}>Replace Selection</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
