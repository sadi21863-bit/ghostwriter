"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

type Chapter = { id: string; title: string; content: string };

const REACTIONS = [
  { type: "surprised", emoji: "😮", label: "Surprised" },
  { type: "engaged",   emoji: "😊", label: "Engaged" },
  { type: "confused",  emoji: "😕", label: "Confused" },
  { type: "bored",     emoji: "😴", label: "Losing me" },
  { type: "moved",     emoji: "🥺", label: "Moved" },
];

export default function ReaderPage() {
  const { token } = useParams<{ token: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<{ offset: number; x: number; y: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/reader/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setChapters(d.chapters ?? []);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.toString().trim() === "") {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const offset = range.startOffset;
    setSelection({ offset, x: rect.left + rect.width / 2, y: rect.top + window.scrollY - 60 });
  };

  const sendReaction = async (reactionType: string) => {
    if (!selection) return;
    const chap = chapters[activeChapter];
    if (!chap) return;
    await fetch(`/api/reader/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId: chap.id, textOffset: selection.offset, reactionType }),
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui", color: "#6b7280" }}>
      Loading...
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 18, color: "#ef4444" }}>Link expired or not found</div>
      <div style={{ fontSize: 14, color: "#9ca3af" }}>{error}</div>
    </div>
  );

  const chap = chapters[activeChapter];

  return (
    <div style={{ minHeight: "100vh", background: "#faf9f5", fontFamily: "'Georgia', serif" }}>
      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 100 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", fontFamily: "system-ui" }}>
          GhostWriter Reader
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {chapters.map((c, i) => (
            <button key={c.id} onClick={() => { setActiveChapter(i); setSelection(null); }}
              style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 12, cursor: "pointer", fontFamily: "system-ui", background: i === activeChapter ? "#1a1a1a" : "#f3f4f6", color: i === activeChapter ? "#fff" : "#374151" }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "80px auto 80px", padding: "0 24px" }}
        onMouseUp={handleMouseUp}
        ref={contentRef}
      >
        {chap ? (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32, color: "#1a1a1a", lineHeight: 1.2 }}>{chap.title}</h1>
            {chap.content.split("\n").filter(p => p.trim()).map((para, i) => (
              <p key={i} style={{ fontSize: 18, lineHeight: 1.8, color: "#374151", marginBottom: "1.4em", marginTop: 0 }}>
                {para}
              </p>
            ))}
          </>
        ) : (
          <div style={{ color: "#9ca3af", textAlign: "center", paddingTop: 60, fontFamily: "system-ui" }}>No chapters available</div>
        )}
      </div>

      {/* Reaction toolbar */}
      {selection && (
        <div style={{
          position: "absolute", left: Math.max(8, selection.x - 150), top: selection.y,
          background: "#1a1a1a", borderRadius: 12, padding: "8px 12px",
          display: "flex", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 200,
        }}>
          {REACTIONS.map(r => (
            <button key={r.type} onClick={() => sendReaction(r.type)} title={r.label}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 4, borderRadius: 6, transition: "background 0.15s" }}>
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      {saved && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "white", padding: "8px 20px", borderRadius: 8, fontSize: 13, fontFamily: "system-ui", fontWeight: 600 }}>
          Reaction saved ✓
        </div>
      )}
    </div>
  );
}
