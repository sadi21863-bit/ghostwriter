"use client";
import { useState, useEffect, useRef } from "react";
import { ART_STYLES } from "@/lib/ai/panel-prompt-builder";

export default function ComicStudio({ project, higgsfieldKey, onOpenStudio }: { project: any; higgsfieldKey: string; onOpenStudio?: () => void }) {
  const [view, setView] = useState<"generator" | "editor">("generator");
  const [pages, setPages] = useState<any[]>([]);
  const [activePage, setActivePage] = useState<any | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedArtStyleId, setSelectedArtStyleId] = useState("manga");
  const [generating, setGenerating] = useState(false);
  const [generationMsg, setGenerationMsg] = useState("");
  const [genError, setGenError] = useState("");
  const [panelEdits, setPanelEdits] = useState<Record<string, { dialogue: string; caption: string; speakerName: string }>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const chaptersWithContent = (project.chapters || []).filter((c: any) => c.content?.trim());

  useEffect(() => {
    fetch(`/api/projects/${project.id}/comics`)
      .then(r => r.json())
      .then(data => {
        if (data.pages?.length) {
          setPages(data.pages);
        }
      });
    if (chaptersWithContent.length > 0) setSelectedChapterId(chaptersWithContent[0].id);
  }, [project.id]);

  const openPage = (page: any, index: number) => {
    setActivePage(page);
    setActivePageIndex(index);
    const edits: Record<string, any> = {};
    for (const p of page.panels) {
      edits[p.id] = { dialogue: p.dialogue || "", caption: p.caption || "", speakerName: p.speakerName || "" };
    }
    setPanelEdits(prev => ({ ...prev, ...edits }));
    setView("editor");
  };

  const generateComic = async () => {
    if (!selectedChapterId || generating || !higgsfieldKey) return;
    setGenerating(true);
    setGenError("");
    setGenerationMsg("Analyzing scene structure...");
    try {
      setGenerationMsg("Generating 6 panels via Higgsfield Soul 2.0... (this takes 1-2 min)");
      const res = await fetch(`/api/projects/${project.id}/comics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: selectedChapterId, artStyleId: selectedArtStyleId }),
      });
      const data = await res.json();
      if (data.error) { setGenError(data.error); return; }
      setGenerationMsg("Saving artwork...");
      const newPages = [data.page, ...pages];
      setPages(newPages);
      openPage(data.page, 0);
    } catch {
      setGenError("Generation failed. Check your Higgsfield API key.");
    } finally {
      setGenerating(false);
      setGenerationMsg("");
    }
  };

  const updatePanel = (panelId: string, field: string, value: string) => {
    setPanelEdits(prev => ({ ...prev, [panelId]: { ...prev[panelId], [field]: value } }));
    clearTimeout(saveTimers.current[panelId]);
    saveTimers.current[panelId] = setTimeout(() => {
      fetch(`/api/projects/${project.id}/comics/${activePage.id}/panels/${panelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    }, 1500);
  };

  const regeneratePanel = async (panelId: string) => {
    if (regenerating[panelId]) return;
    setRegenerating(prev => ({ ...prev, [panelId]: true }));
    try {
      const res = await fetch(`/api/projects/${project.id}/comics/${activePage.id}/panels/${panelId}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (data.panel) {
        setActivePage((prev: any) => ({
          ...prev,
          panels: prev.panels.map((p: any) => p.id === panelId ? { ...p, imageUrl: data.panel.imageUrl } : p),
        }));
      }
    } finally {
      setRegenerating(prev => ({ ...prev, [panelId]: false }));
    }
  };

  const deletePage = async (pageId: string) => {
    await fetch(`/api/projects/${project.id}/comics/${pageId}`, { method: "DELETE" });
    const newPages = pages.filter((p: any) => p.id !== pageId);
    setPages(newPages);
    setView("generator");
    setActivePage(null);
  };

  const exportPng = async () => {
    if (!activePage?.panels?.length) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1056;
    canvas.height = 1584;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 1056, 1584);
    const pw = 528, ph = 528;
    const panels = [...activePage.panels].sort((a: any, b: any) => a.panelIndex - b.panelIndex);
    for (let i = 0; i < Math.min(panels.length, 6); i++) {
      const panel = panels[i];
      const x = (i % 2) * pw;
      const y = Math.floor(i / 2) * ph;
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = panel.imageUrl; });
        ctx.drawImage(img, x, y, pw, ph);
      } catch { ctx.fillStyle = "#eee"; ctx.fillRect(x, y, pw, ph); }
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, pw, ph);
      const edit = panelEdits[panel.id] ?? panel;
      if (edit.dialogue) {
        const ty = y + ph * 0.84;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(x + 4, ty, pw - 8, ph * 0.14);
        ctx.fillStyle = "#000";
        ctx.font = "bold 13px serif";
        ctx.fillText((edit.speakerName ? edit.speakerName + ": " : "") + edit.dialogue.substring(0, 70), x + 10, ty + 18);
      }
      if (edit.caption) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(x + 4, y + 4, pw - 8, 22);
        ctx.fillStyle = "#fff";
        ctx.font = "11px sans-serif";
        ctx.fillText(edit.caption.substring(0, 60), x + 10, y + 18);
      }
    }
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "-")}-comic-page-${activePageIndex + 1}.png`;
    a.click();
  };

  const co = {
    bg: "#0f0f11", surface: "#1a1a1f", surfaceAlt: "#222228", accent: "#7c6af7",
    accentBg: "#1e1b3a", border: "#2a2a35", text: "#e8e8f0", muted: "#6b6b80",
    green: "#22c55e", danger: "#ef4444",
  };
  const sBtn: any = { padding: "8px 16px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, background: co.accent, color: "#fff" };
  const sBtnSm: any = { padding: "5px 10px", border: "1px solid " + co.border, borderRadius: 6, cursor: "pointer", fontSize: 11, background: co.surfaceAlt, color: co.text };
  const sInput: any = { background: co.surfaceAlt, border: "1px solid " + co.border, borderRadius: 6, padding: "6px 10px", color: co.text, fontSize: 12, width: "100%", boxSizing: "border-box" };

  if (view === "editor" && activePage) {
    const panels = [...activePage.panels].sort((a: any, b: any) => a.panelIndex - b.panelIndex);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: co.bg, color: co.text }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: co.surface, borderBottom: "1px solid " + co.border, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setView("generator")}>← Generator</button>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: co.muted }}>Page</span>
            <button style={{ ...sBtnSm, padding: "3px 8px" }} disabled={activePageIndex <= 0} onClick={() => { const i = activePageIndex - 1; openPage(pages[i], i); }}>◀</button>
            <span style={{ fontSize: 12 }}>{activePageIndex + 1}/{pages.length}</span>
            <button style={{ ...sBtnSm, padding: "3px 8px" }} disabled={activePageIndex >= pages.length - 1} onClick={() => { const i = activePageIndex + 1; openPage(pages[i], i); }}>▶</button>
          </div>
          <button style={{ ...sBtnSm, color: co.danger, borderColor: co.danger }} onClick={() => deletePage(activePage.id)}>🗑 Delete</button>
          <button style={sBtn} onClick={exportPng}>📤 Export PNG</button>
          <button style={{ ...sBtnSm, color: co.accent, borderColor: co.accent }} onClick={() => onOpenStudio?.()}>🎬 Animate in Studio</button>
        </div>
        {/* 2×3 panel grid */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 960, margin: "0 auto" }}>
            {panels.map((panel: any, i: number) => {
              const edit = panelEdits[panel.id] ?? { dialogue: panel.dialogue, caption: panel.caption, speakerName: panel.speakerName };
              return (
                <div key={panel.id} style={{ background: co.surface, borderRadius: 10, overflow: "hidden", border: "1px solid " + co.border }}>
                  {/* Image area */}
                  <div style={{ position: "relative", aspectRatio: "1/1", background: co.surfaceAlt }}>
                    <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, zIndex: 2 }}>{i + 1}</span>
                    <button style={{ position: "absolute", top: 8, right: 8, zIndex: 2, ...sBtnSm, padding: "3px 8px" }} onClick={() => regeneratePanel(panel.id)} disabled={regenerating[panel.id]}>
                      {regenerating[panel.id] ? "..." : "🔄"}
                    </button>
                    {panel.imageUrl
                      ? <img src={panel.imageUrl} alt={`Panel ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: co.muted, fontSize: 12 }}>No image</div>}
                  </div>
                  {/* Edit area */}
                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input style={sInput} placeholder="Speaker name..." value={edit.speakerName ?? ""} onChange={e => updatePanel(panel.id, "speakerName", e.target.value)} />
                    <textarea style={{ ...sInput, resize: "none", minHeight: 44 }} placeholder="Dialogue..." rows={2} value={edit.dialogue ?? ""} onChange={e => updatePanel(panel.id, "dialogue", e.target.value)} />
                    <input style={sInput} placeholder="Caption (narrator box)..." value={edit.caption ?? ""} onChange={e => updatePanel(panel.id, "caption", e.target.value)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Generator view
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: co.bg, color: co.text, overflow: "auto" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🎨 Comic Studio</div>
          <div style={{ fontSize: 12, color: co.muted }}>Powered by Higgsfield Soul 2.0 · Story formats only</div>
        </div>

        {!higgsfieldKey && (
          <div style={{ background: "#2a1a00", border: "1px solid #f59e0b", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: "#fbbf24" }}>
            ⚠️ Add your Higgsfield API key in Settings to enable comics.
          </div>
        )}

        {chaptersWithContent.length === 0 && (
          <div style={{ background: co.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: co.muted }}>
            ⚠️ Write your story first. Comic generation requires written content.
          </div>
        )}

        {chaptersWithContent.length > 0 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Select Chapter</label>
              <select style={{ ...sInput, fontSize: 13 }} value={selectedChapterId} onChange={e => setSelectedChapterId(e.target.value)}>
                {chaptersWithContent.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Art Style</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ART_STYLES.map(style => (
                  <button key={style.id} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid " + (selectedArtStyleId === style.id ? co.accent : co.border), background: selectedArtStyleId === style.id ? co.accentBg : "transparent", color: selectedArtStyleId === style.id ? co.accent : co.muted, fontSize: 12, cursor: "pointer", fontWeight: selectedArtStyleId === style.id ? 700 : 400 }} onClick={() => setSelectedArtStyleId(style.id)}>
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Character Consistency</label>
              {project.characters?.length > 0
                ? project.characters.slice(0, 6).map((c: any) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 4 }}>
                    <span>{c.portraitUrl ? "✅" : "⚠️"}</span>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: co.muted }}>{c.portraitUrl ? "portrait ready (Soul ID active)" : "no portrait (add one in World Bible for best results)"}</span>
                  </div>
                ))
                : <div style={{ fontSize: 12, color: co.muted }}>No characters in World Bible yet.</div>}
            </div>

            {genError && <div style={{ background: "#1a0a0a", border: "1px solid " + co.danger, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: co.danger }}>{genError}</div>}

            {generating
              ? <div style={{ textAlign: "center", padding: 20, color: co.muted, fontSize: 13 }}>⏳ {generationMsg}</div>
              : <button style={{ ...sBtn, width: "100%", fontSize: 15, padding: "12px 0", opacity: !higgsfieldKey ? 0.5 : 1 }} disabled={!higgsfieldKey || generating} onClick={generateComic}>🎨 Convert to Comic</button>}
          </>
        )}

        {pages.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 10 }}>Existing Pages</div>
            {pages.map((page: any, i: number) => {
              const chapter = project.chapters?.find((c: any) => c.id === page.chapterId);
              return (
                <div key={page.id} style={{ display: "flex", alignItems: "center", gap: 10, background: co.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: "1px solid " + co.border, cursor: "pointer" }} onClick={() => openPage(page, i)}>
                  {page.panels?.[0]?.imageUrl && <img src={page.panels[0].imageUrl} alt="thumb" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Page {page.pageNumber}</div>
                    <div style={{ fontSize: 11, color: co.muted }}>{chapter?.title ?? "Chapter"} · {page.artStyle} · {page.panels?.length ?? 0} panels</div>
                  </div>
                  <span style={{ fontSize: 11, color: co.accent }}>Open →</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
