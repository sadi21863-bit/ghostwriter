"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sInput, sTextarea } from "@/lib/styles";
import {
  COMPOSITION_PRESETS,
  LAYER_OPTIONS,
  LAYER_LABELS,
  LAYER_COLORS,
  type CompositionLayer,
  type CompositionLayerType,
} from "@/lib/ai/composer";

interface Props {
  compositionLayers: CompositionLayer[];
  setCompositionLayers: (layers: CompositionLayer[]) => void;
  generating: boolean;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  generateComposition: (layers: CompositionLayer[], prompt: string) => Promise<void>;
  updateChapter: (f: string, v: any) => void;
  activeChap: any;
}

const LAYER_TYPES: CompositionLayerType[] = ["emotional", "tension", "atmosphere", "combat"];

const TYPE_ICONS: Record<CompositionLayerType, string> = {
  emotional:   "💜",
  tension:     "⚡",
  atmosphere:  "🌿",
  combat:      "⚔️",
};

export function CompositionPanel({
  compositionLayers, setCompositionLayers,
  generating, streamText, setStreamText,
  prompt, setPrompt,
  generateComposition, updateChapter, activeChap,
}: Props) {
  const [addType, setAddType] = useState<CompositionLayerType>("emotional");
  const [addParam, setAddParam] = useState(LAYER_OPTIONS["emotional"][0]);
  const [expandedPrompt, setExpandedPrompt] = useState(false);

  const addLayer = () => {
    if (compositionLayers.length >= 3) return;
    if (compositionLayers.some(l => l.type === addType && l.param === addParam)) return;
    setCompositionLayers([...compositionLayers, { type: addType, param: addParam }]);
  };

  const removeLayer = (idx: number) => {
    setCompositionLayers(compositionLayers.filter((_, i) => i !== idx));
  };

  const applyPreset = (layers: CompositionLayer[]) => {
    setCompositionLayers(layers);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Output area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {streamText ? (
          <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>
            {streamText}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Active layers */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>
                Active Layers {compositionLayers.length > 0 ? `(${compositionLayers.length}/3)` : ""}
              </div>

              {compositionLayers.length === 0 ? (
                <div style={{ padding: "20px 16px", background: co.surfaceAlt, borderRadius: 10, border: "1px dashed " + co.border, color: co.muted, fontSize: 13, textAlign: "center" }}>
                  Add layers below to compose a multi-library scene
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {compositionLayers.map((layer, idx) => {
                    const colors = LAYER_COLORS[layer.type];
                    return (
                      <div key={idx} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 8,
                        background: colors.bg, border: `1px solid ${colors.text}33`,
                      }}>
                        <span style={{ fontSize: 16 }}>{TYPE_ICONS[layer.type]}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: colors.text, textTransform: "uppercase" }}>{LAYER_LABELS[layer.type]}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: co.text }}>{layer.param}</div>
                        </div>
                        <button
                          onClick={() => removeLayer(idx)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: co.muted, fontSize: 16, padding: "0 4px" }}
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add layer */}
            {compositionLayers.length < 3 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 8 }}>Add a Layer</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    style={{ ...sBtnSm, border: "1px solid " + co.border, background: co.surfaceAlt, color: co.text, padding: "6px 8px", fontSize: 12 } as any}
                    value={addType}
                    onChange={e => {
                      const t = e.target.value as CompositionLayerType;
                      setAddType(t);
                      setAddParam(LAYER_OPTIONS[t][0]);
                    }}
                  >
                    {LAYER_TYPES.map(t => (
                      <option key={t} value={t}>{TYPE_ICONS[t]} {LAYER_LABELS[t]}</option>
                    ))}
                  </select>

                  <select
                    style={{ ...sBtnSm, border: "1px solid " + co.border, background: co.surfaceAlt, color: co.text, padding: "6px 8px", fontSize: 12, flex: 1 } as any}
                    value={addParam}
                    onChange={e => setAddParam(e.target.value)}
                  >
                    {LAYER_OPTIONS[addType].map(opt => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>

                  <button
                    style={{ ...sBtn, flexShrink: 0, opacity: compositionLayers.some(l => l.type === addType && l.param === addParam) ? 0.4 : 1 }}
                    disabled={compositionLayers.some(l => l.type === addType && l.param === addParam)}
                    onClick={addLayer}
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Presets */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 8 }}>Presets</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {COMPOSITION_PRESETS.map((preset, i) => (
                  <div key={i} style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: co.surfaceAlt, border: "1px solid " + co.border,
                    display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  }}
                    onClick={() => applyPreset(preset.layers)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{preset.name}</div>
                      <div style={{ fontSize: 11, color: co.muted, marginTop: 2 }}>{preset.description}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {preset.layers.map((l, j) => {
                          const c = LAYER_COLORS[l.type];
                          return (
                            <span key={j} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: c.bg, color: c.text, fontWeight: 600 }}>
                              {TYPE_ICONS[l.type]} {l.param}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button style={{ ...sBtnSm, flexShrink: 0 }} onClick={e => { e.stopPropagation(); applyPreset(preset.layers); }}>
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Output actions ────────────────────────────────────────────────── */}
      {streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={{ ...sBtn, background: "#f0e6ff", color: "#7c3aed" }} onClick={() => {
            updateChapter("content", (activeChap?.content || "") + (activeChap?.content ? "\n\n" : "") + streamText);
            setStreamText("");
          }}>Insert into Chapter</button>
        </div>
      )}

      {/* ── Prompt bar ────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface, flexShrink: 0 }}>
        {expandedPrompt
          ? <textarea
              style={{ ...sTextarea, flex: 1, minHeight: 80 }}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the scene you want to compose..."
            />
          : <input
              style={{ ...sInput, flex: 1 }}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={compositionLayers.length
                ? `Compose a scene with ${compositionLayers.map(l => l.param).join(" + ")}...`
                : "Select layers above or apply a preset, then describe your scene..."
              }
              onKeyDown={e => {
                if (e.key === "Enter" && !generating && compositionLayers.length > 0) {
                  generateComposition(compositionLayers, prompt);
                }
              }}
            />
        }

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <button
            style={{
              ...sBtn,
              opacity: generating || compositionLayers.length === 0 ? 0.5 : 1,
              background: compositionLayers.length > 0 ? "#4F46E5" : co.surfaceAlt,
              color: compositionLayers.length > 0 ? "#fff" : co.muted,
            }}
            onClick={() => generateComposition(compositionLayers, prompt)}
            disabled={generating || compositionLayers.length === 0}
          >
            {generating ? "Composing..." : "⚗️ Compose"}
          </button>
          <button
            style={{ padding: "2px 8px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, background: "transparent", color: co.muted }}
            onClick={() => setExpandedPrompt(v => !v)}
          >
            {expandedPrompt ? "Less" : "More"}
          </button>
        </div>
      </div>
    </div>
  );
}
