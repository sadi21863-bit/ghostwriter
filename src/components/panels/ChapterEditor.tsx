"use client";
import { co, sBtnSm, sBtn } from "@/lib/styles";
import { getChapterLabel } from "@/lib/formats";

interface Props {
  project: any;
  updateProject: (fn: any) => void;
  addChapter: () => Promise<void>;
  deleteChapter: (id: string) => void;
  moveChapter: (i: number, dir: number) => Promise<void>;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
}

export default function ChapterEditor({ project, updateProject, addChapter, deleteChapter, moveChapter, rightCollapsed, setRightCollapsed }: Props) {
  return (
    <div style={{ width: rightCollapsed ? 48 : 240, minWidth: rightCollapsed ? 48 : 240, background: co.surface, borderLeft: "1px solid " + co.border, display: "flex", flexDirection: "column", transition: "all 0.2s", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 10px", borderBottom: "1px solid " + co.border }}>
        <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "4px" }} onClick={() => setRightCollapsed(!rightCollapsed)}>{rightCollapsed ? "◀" : "▶"}</button>
        {!rightCollapsed && <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>Chapters</span>}
      </div>
      {!rightCollapsed && <>
        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {project.chapters.map((ch: any, i: number) => (
            <div key={ch.id} style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, background: ch.id === project.activeChapter ? co.accentBg : "transparent", color: ch.id === project.activeChapter ? co.accent : co.muted, display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: ch.id === project.activeChapter ? 600 : 400 }} onClick={() => updateProject((p: any) => ({ ...p, activeChapter: ch.id }))}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{ch.title}</span>
              <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                {ch.summary && <span style={{ width: 7, height: 7, borderRadius: "50%", background: co.green }} />}
                <button style={{ background: "none", border: "none", color: i === 0 ? co.border : co.muted, cursor: i === 0 ? "default" : "pointer", fontSize: 9, padding: 0 }} disabled={i === 0} onClick={e => { e.stopPropagation(); moveChapter(i, -1); }}>▲</button>
                <button style={{ background: "none", border: "none", color: i === project.chapters.length - 1 ? co.border : co.muted, cursor: i === project.chapters.length - 1 ? "default" : "pointer", fontSize: 9, padding: 0 }} disabled={i === project.chapters.length - 1} onClick={e => { e.stopPropagation(); moveChapter(i, 1); }}>▼</button>
                {project.chapters.length > 1 && <button style={{ background: "none", border: "none", color: co.danger + "66", cursor: "pointer", fontSize: 11 }} onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}>x</button>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 8, borderTop: "1px solid " + co.border }}>
          <button style={{ ...sBtnSm, width: "100%" }} onClick={addChapter}>+ Add {getChapterLabel(project.format)}</button>
        </div>
      </>}
    </div>
  );
}
