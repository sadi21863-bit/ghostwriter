"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";
import { getChapterLabel } from "@/lib/formats";

const CHAPTER_TYPES = ["chapter", "scene", "flashback", "interlude", "prologue", "epilogue"];

interface Props {
  project: any;
  updateProject: (fn: any) => void;
  updateChapter: (field: string, value: any) => void;
  addChapter: () => Promise<void>;
  deleteChapter: (id: string) => void;
  moveChapter: (i: number, dir: number) => Promise<void>;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
}

export default function ChapterEditor({ project, updateProject, updateChapter, addChapter, deleteChapter, moveChapter, rightCollapsed, setRightCollapsed }: Props) {
  const [tagInput, setTagInput] = useState("");

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
        <div style={{ padding: 8, borderTop: "1px solid " + co.border }}>
          <button style={{ ...sBtnSm, width: "100%" }} onClick={addChapter}>+ Add {getChapterLabel(project.format)}</button>
        </div>
      </>}
    </div>
  );
}
