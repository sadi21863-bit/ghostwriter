"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";
import { getChapterLabel } from "@/lib/formats";
import type { PassiveSuggestion } from "@/lib/suggestions/passive";
import type { FeatureGate } from "@/types/subscription";

const CHAPTER_TYPES = ["chapter", "scene", "flashback", "interlude", "prologue", "epilogue"];

const CATEGORY_ICON: Record<string, string> = {
  continuity: "🔗",
  character_voice: "💬",
  world_rule: "🌍",
  pacing: "⏱",
  repeated_opener: "🔁",
  word_repetition: "📝",
  dialogue_ratio: "💬",
  sentence_uniformity: "〰",
};

interface AiSuggestion {
  category: string;
  severity: string;
  message: string;
  excerpt: string;
  fix: string;
}

interface Props {
  project: any;
  updateProject: (fn: any) => void;
  updateChapter: (field: string, value: any) => void;
  addChapter: () => Promise<void>;
  deleteChapter: (id: string) => void;
  moveChapter: (i: number, dir: number) => Promise<void>;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
  passiveSuggestions: PassiveSuggestion[];
  setPassiveSuggestions: (v: PassiveSuggestion[]) => void;
  setUpgradeRequired?: (f: FeatureGate) => void;
}

export default function ChapterEditor({
  project, updateProject, updateChapter, addChapter, deleteChapter, moveChapter,
  rightCollapsed, setRightCollapsed,
  passiveSuggestions, setPassiveSuggestions,
  setUpgradeRequired,
}: Props) {
  const [tagInput, setTagInput] = useState("");
  const [aiChecking, setAiChecking] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiSuggestionsMsg, setAiSuggestionsMsg] = useState("");
  const [dismissedAi, setDismissedAi] = useState<Set<number>>(new Set());

  const activeChap = project.chapters.find((c: any) => c.id === project.activeChapter);

  const addTag = (val: string) => {
    const tag = val.trim().toLowerCase();
    if (!tag || (activeChap?.tags || []).includes(tag)) return;
    updateChapter("tags", [...(activeChap?.tags || []), tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateChapter("tags", (activeChap?.tags || []).filter((t: string) => t !== tag));
  };

  const dismissPassive = (id: string) => {
    setPassiveSuggestions(passiveSuggestions.filter(s => s.id !== id));
  };

  const runAiCheck = async () => {
    if (!activeChap?.content || activeChap.content.length < 100) {
      setAiSuggestionsMsg("Chapter needs at least 100 characters to check.");
      return;
    }
    setAiChecking(true);
    setAiSuggestions([]);
    setAiSuggestionsMsg("");
    setDismissedAi(new Set());
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          chapterId: activeChap.id,
          chapterContent: activeChap.content,
        }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "upgrade_required" && setUpgradeRequired) {
          setUpgradeRequired("ai_suggestion_active");
        } else {
          setAiSuggestionsMsg("Upgrade to Story Pro to use AI Check.");
        }
        return;
      }
      const data = await res.json();
      if (data.suggestions?.length) {
        setAiSuggestions(data.suggestions);
      } else {
        setAiSuggestionsMsg("✅ No issues found. Great writing!");
      }
    } catch {
      setAiSuggestionsMsg("AI Check failed. Please try again.");
    } finally {
      setAiChecking(false);
    }
  };

  const visibleAiSuggestions = aiSuggestions.filter((_, i) => !dismissedAi.has(i));

  return (
    <div style={{ width: rightCollapsed ? 48 : 240, minWidth: rightCollapsed ? 48 : 240, background: co.surface, borderLeft: "1px solid " + co.border, display: "flex", flexDirection: "column", transition: "all 0.2s", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 10px", borderBottom: "1px solid " + co.border }}>
        <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "4px" }} onClick={() => setRightCollapsed(!rightCollapsed)}>{rightCollapsed ? "◀" : "▶"}</button>
        {!rightCollapsed && <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>Chapters</span>}
      </div>
      {!rightCollapsed && <>
        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {project.chapters.map((ch: any, i: number) => {
            const isActive = ch.id === project.activeChapter;
            return (
              <div key={ch.id}>
                <div style={{ padding: "7px 10px", borderRadius: isActive ? "8px 8px 0 0" : 8, cursor: "pointer", fontSize: 12, background: isActive ? co.accentBg : "transparent", color: isActive ? co.accent : co.muted, fontWeight: isActive ? 600 : 400 }} onClick={() => updateProject((p: any) => ({ ...p, activeChapter: ch.id }))}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{ch.title}</span>
                    <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                      {ch.summary && <span style={{ width: 7, height: 7, borderRadius: "50%", background: co.green }} />}
                      <button style={{ background: "none", border: "none", color: i === 0 ? co.border : co.muted, cursor: i === 0 ? "default" : "pointer", fontSize: 9, padding: 0 }} disabled={i === 0} onClick={e => { e.stopPropagation(); moveChapter(i, -1); }}>▲</button>
                      <button style={{ background: "none", border: "none", color: i === project.chapters.length - 1 ? co.border : co.muted, cursor: i === project.chapters.length - 1 ? "default" : "pointer", fontSize: 9, padding: 0 }} disabled={i === project.chapters.length - 1} onClick={e => { e.stopPropagation(); moveChapter(i, 1); }}>▼</button>
                      {project.chapters.length > 1 && <button style={{ background: "none", border: "none", color: co.danger + "66", cursor: "pointer", fontSize: 11 }} onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}>x</button>}
                    </div>
                  </div>
                  {(ch.wordCount > 0 || (ch.chapterType && ch.chapterType !== "chapter") || ch.tags?.length > 0) && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                      {ch.wordCount > 0 && (
                        <span style={{ fontSize: 9, color: co.muted, background: co.surfaceAlt, padding: "1px 5px", borderRadius: 3 }}>
                          {ch.wordCount.toLocaleString()}w
                        </span>
                      )}
                      {ch.chapterType && ch.chapterType !== "chapter" && (
                        <span style={{ fontSize: 9, color: co.accent, background: co.accentBg, padding: "1px 5px", borderRadius: 3 }}>
                          {ch.chapterType}
                        </span>
                      )}
                      {ch.tags?.slice(0, 2).map((tag: string) => (
                        <span key={tag} style={{ fontSize: 9, color: co.muted, border: "1px solid " + co.border, padding: "1px 5px", borderRadius: 3 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isActive && (
                  <div style={{ background: co.accentBg, borderRadius: "0 0 8px 8px", padding: "4px 10px 8px", marginBottom: 4 }} onClick={e => e.stopPropagation()}>
                    <select
                      value={ch.chapterType || "chapter"}
                      onChange={e => updateChapter("chapterType", e.target.value)}
                      style={{ fontSize: 10, background: co.surface, border: "1px solid " + co.border, borderRadius: 4, padding: "2px 4px", color: co.muted, width: "100%", marginBottom: 4, outline: "none", cursor: "pointer" }}
                    >
                      {CHAPTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: (ch.tags?.length ? 4 : 0) }}>
                      {(ch.tags || []).map((tag: string) => (
                        <span key={tag} style={{ fontSize: 9, background: co.surface, color: co.accent, border: "1px solid " + co.accent + "44", borderRadius: 4, padding: "1px 5px", display: "flex", alignItems: "center", gap: 2 }}>
                          {tag}
                          <button onClick={() => removeTag(tag)} style={{ background: "none", border: "none", cursor: "pointer", color: co.muted, fontSize: 10, padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      placeholder="tag + enter"
                      style={{ fontSize: 10, background: co.surface, border: "1px solid " + co.border, borderRadius: 4, padding: "2px 6px", color: co.text, width: "100%", outline: "none", boxSizing: "border-box" }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Passive suggestion chips ── */}
        {passiveSuggestions.length > 0 && (
          <div style={{ padding: "8px 10px", borderTop: "1px solid " + co.border }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>✏️ Writing Tips</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {passiveSuggestions.slice(0, 5).map(s => (
                <div key={s.id} style={{
                  background: s.severity === "warning" ? "#fef3c7" : co.surfaceAlt,
                  border: "1px solid " + (s.severity === "warning" ? "#fcd34d" : co.border),
                  borderRadius: 6, padding: "4px 6px", fontSize: 10, color: co.text,
                  display: "flex", alignItems: "flex-start", gap: 4,
                }}>
                  <span style={{ flexShrink: 0 }}>{CATEGORY_ICON[s.category] ?? "💡"}</span>
                  <span style={{ flex: 1, lineHeight: 1.4 }}>{s.message}</span>
                  <button onClick={() => dismissPassive(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: co.muted, fontSize: 11, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Check results ── */}
        {(visibleAiSuggestions.length > 0 || aiSuggestionsMsg) && (
          <div style={{ padding: "8px 10px", borderTop: "1px solid " + co.border }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>🔍 AI Review</div>
            {aiSuggestionsMsg && <div style={{ fontSize: 10, color: co.muted, marginBottom: 4 }}>{aiSuggestionsMsg}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {visibleAiSuggestions.map((s, i) => (
                <div key={i} style={{
                  background: s.severity === "warning" ? "#fef3c7" : co.surfaceAlt,
                  border: "1px solid " + (s.severity === "warning" ? "#fcd34d" : co.border),
                  borderRadius: 6, padding: "4px 6px", fontSize: 10, color: co.text,
                  display: "flex", alignItems: "flex-start", gap: 4,
                }}>
                  <span style={{ flexShrink: 0 }}>{CATEGORY_ICON[s.category] ?? "💡"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ lineHeight: 1.4, marginBottom: 2 }}>{s.message}</div>
                    {s.fix && <div style={{ fontSize: 9, color: co.muted, fontStyle: "italic" }}>{s.fix}</div>}
                  </div>
                  <button onClick={() => setDismissedAi(prev => { const s = new Set(Array.from(prev)); s.add(i); return s; })} style={{ background: "none", border: "none", cursor: "pointer", color: co.muted, fontSize: 11, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: 8, borderTop: "1px solid " + co.border, display: "flex", gap: 4 }}>
          <button style={{ ...sBtnSm, flex: 1 }} onClick={addChapter}>+ Add {getChapterLabel(project.format)}</button>
          <button
            style={{ ...sBtnSm, flexShrink: 0, background: aiChecking ? co.surfaceAlt : co.surface, border: "1px solid " + co.border, opacity: aiChecking ? 0.7 : 1 }}
            onClick={runAiCheck}
            disabled={aiChecking}
            title="AI Story Review (Pro)"
          >
            {aiChecking ? "…" : "🔍"}
          </button>
        </div>
      </>}
    </div>
  );
}
