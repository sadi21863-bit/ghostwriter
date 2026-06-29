"use client";
import { useEffect, useState } from "react";
import { co, sBtnSm, sInput } from "@/lib/styles";
import { toast } from "@/lib/toast";
import { chapterApprovalSummary } from "@/lib/editor/approval";

interface EditorNote {
  id: string;
  chapterId: string | null;
  type: string;
  severity: "high" | "medium" | "low" | string;
  category: string;
  message: string;
  suggestedFix: string;
  status: string;
}

const SEV_COLOR: Record<string, string> = { high: co.danger, medium: co.orange, low: co.muted };

interface EditorNotesPanelProps {
  project: any;
  updateProject: (fn: (p: any) => any) => void;
}

export default function EditorNotesPanel({ project, updateProject }: EditorNotesPanelProps) {
  const [notes, setNotes] = useState<EditorNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [draftMsg, setDraftMsg] = useState("");

  const chapters = [...(project.chapters || [])].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const summary = chapterApprovalSummary(chapters.map((c: any) => ({ title: c.title, reviewStatus: c.reviewStatus })));

  useEffect(() => {
    fetch(`/api/projects/${project.id}/editor-notes?status=open`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.notes) setNotes(d.notes); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [project.id]);

  const setNoteStatus = async (id: string, status: "resolved" | "dismissed") => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await fetch(`/api/projects/${project.id}/editor-notes`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId: id, status }),
    }).catch(() => {});
  };

  const addNote = async (chapterId: string) => {
    if (!draftMsg.trim()) return;
    const res = await fetch(`/api/projects/${project.id}/editor-notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId, message: draftMsg.trim(), source: "manual", type: "issue" }),
    });
    const d = await res.json().catch(() => null);
    if (d?.note) setNotes(prev => [d.note, ...prev]);
    setDraftMsg(""); setDraftFor(null);
  };

  const toggleApprove = async (chapter: any) => {
    const next = chapter.reviewStatus === "approved" ? "draft" : "approved";
    updateProject((p: any) => ({ ...p, chapters: (p.chapters || []).map((c: any) => c.id === chapter.id ? { ...c, reviewStatus: next } : c) }));
    const res = await fetch(`/api/projects/${project.id}/editor-notes`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId: chapter.id, reviewStatus: next }),
    });
    if (!res.ok) toast.error("Couldn't update approval. Try again.");
    else if (next === "approved") toast.success(`"${chapter.title}" approved for production.`);
  };

  if (!loaded) return null;

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>🔎 Editor Review</div>
        <span style={{ fontSize: 11, color: summary.allApproved ? co.green : co.muted }}>
          {summary.approved}/{summary.total} chapter{summary.total === 1 ? "" : "s"} approved
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {chapters.map((ch: any) => {
          const chNotes = notes.filter(n => n.chapterId === ch.id);
          const approved = ch.reviewStatus === "approved";
          return (
            <div key={ch.id} style={{ border: `1px solid ${co.border}`, borderRadius: 8, padding: "10px 12px", background: co.bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: co.text, flex: 1 }}>{ch.title}</span>
                {chNotes.length > 0 && <span style={{ fontSize: 10, color: co.orange }}>{chNotes.length} open</span>}
                <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 20, background: approved ? `${co.green}1a` : co.surfaceAlt, color: approved ? co.green : co.muted }}>
                  {approved ? "approved" : ch.reviewStatus || "draft"}
                </span>
                <button style={{ ...sBtnSm, ...(approved ? { borderColor: co.green, color: co.green } : {}) }} onClick={() => toggleApprove(ch)}>
                  {approved ? "✓ Approved" : "Approve"}
                </button>
              </div>

              {chNotes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {chNotes.map(n => (
                    <div key={n.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEV_COLOR[n.severity] ?? co.muted, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ color: co.text }}>{n.message}</span>
                        {n.category && n.category !== "general" && <span style={{ color: co.muted, fontSize: 10, marginLeft: 6 }}>· {n.category}</span>}
                        {n.suggestedFix && <div style={{ color: co.muted, fontSize: 11, marginTop: 2 }}>💡 {n.suggestedFix}</div>}
                      </div>
                      <button style={{ ...sBtnSm, padding: "2px 8px" }} onClick={() => setNoteStatus(n.id, "resolved")}>Resolve</button>
                      <button style={{ ...sBtnSm, padding: "2px 8px", color: co.muted }} onClick={() => setNoteStatus(n.id, "dismissed")}>Dismiss</button>
                    </div>
                  ))}
                </div>
              )}

              {draftFor === ch.id ? (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input autoFocus style={{ ...sInput, fontSize: 12 }} placeholder="Describe the issue…" value={draftMsg}
                    onChange={e => setDraftMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(ch.id); }} />
                  <button style={sBtnSm} onClick={() => addNote(ch.id)}>Add</button>
                  <button style={{ ...sBtnSm, color: co.muted }} onClick={() => { setDraftFor(null); setDraftMsg(""); }}>×</button>
                </div>
              ) : (
                <button style={{ ...sBtnSm, marginTop: 8, fontSize: 10, padding: "2px 8px" }} onClick={() => { setDraftFor(ch.id); setDraftMsg(""); }}>+ Add note</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
