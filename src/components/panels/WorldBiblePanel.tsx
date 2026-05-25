"use client";
import { useState } from "react";
import { buildContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { co, sInput, sTextarea, sBtn, sBtnSm } from "@/lib/styles";
import { isCreatorFormat, isStoryFormat, FORMATS, GENRES, STYLE_ATTRS, DEFAULT_CHAR, DEFAULT_LOC, DEFAULT_PLOT, CharFields, LocFields, PlotFields } from "@/lib/formats";

const entityApiPath: Record<string, string> = { characters: "characters", locations: "locations", plotThreads: "plot-threads" };

interface Props {
  project: any;
  updateProject: (fn: any) => void;
  storyMemories: any[];
  setStoryMemories: (fn: any) => void;
  creatorBible: any;
  updateCreatorBible: (field: string, value: any) => void;
  save: () => Promise<void>;
  savedMsg: string;
  exportAll: () => void;
  setErrorMsg: (msg: string | null) => void;
  setConfirmModal: (v: any) => void;
  generating: boolean;
  genTarget: string;
  setGenerating: (v: boolean) => void;
  setGenTarget: (v: string) => void;
  callAI: (endpoint: string, body: any) => Promise<any>;
  buildFullContext: (p?: any) => string;
  setStreamText: (v: string) => void;
  setMode: (m: string) => void;
  setPrompt: (v: string) => void;
  quickStartLoading: boolean;
  quickStartStory: (onSuccess: (outline: string) => void, setSavedMsg: (m: string) => void) => Promise<void>;
  portraitLoading: boolean;
  generatePortrait: (charIdx: number) => Promise<string | null>;
  linkSuggestions: any[];
  setLinkSuggestions: (fn: any) => void;
  suggestingLinks: boolean;
  suggestLinks: () => Promise<void>;
  confirmLink: (s: any) => Promise<void>;
  toggleAlwaysInContext: (key: string, item: any, i: number) => Promise<void>;
  setSavedMsg: (m: string) => void;
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
}

export default function WorldBiblePanel(props: Props) {
  const {
    project, updateProject, storyMemories, setStoryMemories,
    creatorBible, updateCreatorBible,
    save, savedMsg, exportAll,
    setErrorMsg, setConfirmModal,
    generating, genTarget, setGenerating, setGenTarget,
    callAI, buildFullContext, setStreamText, setMode, setPrompt,
    quickStartLoading, quickStartStory,
    portraitLoading, generatePortrait,
    linkSuggestions, setLinkSuggestions, suggestingLinks, suggestLinks, confirmLink,
    toggleAlwaysInContext, setSavedMsg,
    leftCollapsed, setLeftCollapsed,
  } = props;

  const [leftTab, setLeftTab] = useState("bible");
  const [newMemoryInput, setNewMemoryInput] = useState("");
  const [pillarInput, setPillarInput] = useState("");
  const [bibleGenPrompt, setBibleGenPrompt] = useState("");
  const [showRelMap, setShowRelMap] = useState(false);
  const [relMapData, setRelMapData] = useState<{ nodes: any[]; edges: any[]; isolated: any[] } | null>(null);
  const [relMapLoading, setRelMapLoading] = useState(false);
  const [selectedMapEdge, setSelectedMapEdge] = useState<any | null>(null);
  const [selectedMapNode, setSelectedMapNode] = useState<any | null>(null);

  // Character modal state
  const [showCharModal, setShowCharModal] = useState(false);
  const [editCharIdx, setEditCharIdx] = useState<number | null>(null);
  const [newChar, setNewChar] = useState<any>({ ...DEFAULT_CHAR });
  const [charGenPrompt, setCharGenPrompt] = useState("");

  // Location modal state
  const [showLocModal, setShowLocModal] = useState(false);
  const [editLocIdx, setEditLocIdx] = useState<number | null>(null);
  const [newLoc, setNewLoc] = useState<any>({ ...DEFAULT_LOC });
  const [locGenPrompt, setLocGenPrompt] = useState("");

  // Plot modal state
  const [showPlotModal, setShowPlotModal] = useState(false);
  const [editPlotIdx, setEditPlotIdx] = useState<number | null>(null);
  const [newPlot, setNewPlot] = useState<any>({ ...DEFAULT_PLOT });
  const [plotGenPrompt, setPlotGenPrompt] = useState("");

  // Ref work modal state
  const [showRefModal, setShowRefModal] = useState(false);
  const [newRef, setNewRef] = useState<any>({ title: "", attributes: {} });

  const loadRelMap = async () => {
    setRelMapLoading(true); setSelectedMapEdge(null); setSelectedMapNode(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/relationship-map`);
      const data = await res.json();
      setRelMapData(data);
    } catch (e) { setErrorMsg("Failed to load character connections. Please try again."); }
    setRelMapLoading(false);
  };

  const openCharEdit = (i: number) => { setEditCharIdx(i); setNewChar({ ...DEFAULT_CHAR, ...project.characters[i] }); setCharGenPrompt(""); setShowCharModal(true); };
  const openCharNew = () => { setEditCharIdx(null); setNewChar({ ...DEFAULT_CHAR }); setCharGenPrompt(""); setShowCharModal(true); };
  const saveChar = async () => {
    if (!newChar.name) return;
    if (editCharIdx !== null) {
      const id = project.characters[editCharIdx].id;
      const res = await fetch(`/api/projects/${project.id}/characters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newChar) });
      const updated = await res.json();
      updateProject((p: any) => ({ ...p, characters: p.characters.map((c: any, i: number) => i === editCharIdx ? updated : c) }));
    } else {
      const res = await fetch(`/api/projects/${project.id}/characters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newChar) });
      const created = await res.json();
      updateProject((p: any) => ({ ...p, characters: [...p.characters, created] }));
    }
    setShowCharModal(false);
  };

  const openLocEdit = (i: number) => { setEditLocIdx(i); setNewLoc({ ...DEFAULT_LOC, ...project.locations[i] }); setLocGenPrompt(""); setShowLocModal(true); };
  const openLocNew = () => { setEditLocIdx(null); setNewLoc({ ...DEFAULT_LOC }); setLocGenPrompt(""); setShowLocModal(true); };
  const saveLoc = async () => {
    if (!newLoc.name) return;
    if (editLocIdx !== null) {
      const id = project.locations[editLocIdx].id;
      const res = await fetch(`/api/projects/${project.id}/locations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newLoc) });
      const updated = await res.json();
      updateProject((p: any) => ({ ...p, locations: p.locations.map((l: any, i: number) => i === editLocIdx ? updated : l) }));
    } else {
      const res = await fetch(`/api/projects/${project.id}/locations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newLoc) });
      const created = await res.json();
      updateProject((p: any) => ({ ...p, locations: [...p.locations, created] }));
    }
    setShowLocModal(false);
  };

  const openPlotEdit = (i: number) => { setEditPlotIdx(i); setNewPlot({ ...DEFAULT_PLOT, ...project.plotThreads[i] }); setPlotGenPrompt(""); setShowPlotModal(true); };
  const openPlotNew = () => { setEditPlotIdx(null); setNewPlot({ ...DEFAULT_PLOT }); setPlotGenPrompt(""); setShowPlotModal(true); };
  const savePlot = async () => {
    if (!newPlot.name) return;
    if (editPlotIdx !== null) {
      const id = project.plotThreads[editPlotIdx].id;
      const res = await fetch(`/api/projects/${project.id}/plot-threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPlot) });
      const updated = await res.json();
      updateProject((p: any) => ({ ...p, plotThreads: p.plotThreads.map((t: any, i: number) => i === editPlotIdx ? updated : t) }));
    } else {
      const res = await fetch(`/api/projects/${project.id}/plot-threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPlot) });
      const created = await res.json();
      updateProject((p: any) => ({ ...p, plotThreads: [...p.plotThreads, created] }));
    }
    setShowPlotModal(false);
  };

  const generateCreatorBible = async () => {
    if (!bibleGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("bible");
    try {
      const r = await callAI("entity", { type: "creatorBible", prompt: bibleGenPrompt, projectContext: buildCreatorContext({ ...project, creatorBible }) });
      Object.entries(r).forEach(([k, v]) => updateCreatorBible(k, v));
    } catch (e) { setErrorMsg("Failed to generate Creator Bible. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateWorldBible = async () => {
    if (!bibleGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("bible");
    try {
      const r = await callAI("generate", { mode: "brainstorm", prompt: bibleGenPrompt, context: buildFullContext(), format: project.format, projectId: project.id, chapterId: null });
      setStreamText(r.text); setMode("brainstorm");
    } catch (e) { setErrorMsg("World Bible generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const suggestRefWorks = async () => {
    if (generating) return;
    setGenerating(true); setGenTarget("ref-suggest");
    try {
      const r = await callAI("generate", { mode: "brainstorm", prompt: "Suggest 3-5 published reference works that would make great style models for this project. For each, give a brief note on what stylistic elements to borrow.", context: buildContext(project), format: project.format, projectId: project.id, chapterId: null });
      setStreamText(r.text); setMode("brainstorm"); setLeftTab("notes");
    } catch (e) { setErrorMsg("Reference work suggestion failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const analyzeRefWork = async () => {
    if (!newRef.title.trim() || generating) return;
    setGenerating(true); setGenTarget("ref");
    try {
      const r = await callAI("analyze-work", { title: newRef.title });
      setNewRef((ref: any) => ({ ...ref, attributes: r }));
    } catch (e) { setErrorMsg("Reference work analysis failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateChar = async () => {
    if (!charGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("char");
    try { const r = await callAI("entity", { type: "character", prompt: charGenPrompt, projectContext: buildContext(project) }); setNewChar((c: any) => ({ ...c, ...r })); }
    catch (e) { setErrorMsg("Character generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };
  const improveChar = async () => {
    if (!newChar.name || generating) return;
    setGenerating(true); setGenTarget("char");
    try { const r = await callAI("entity", { type: "character", prompt: "", projectContext: buildContext(project), existing: newChar }); setNewChar((c: any) => ({ ...c, ...r })); }
    catch (e) { setErrorMsg("Character improvement failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateLoc = async () => {
    if (!locGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("loc");
    try { const r = await callAI("entity", { type: "location", prompt: locGenPrompt, projectContext: buildContext(project) }); setNewLoc((l: any) => ({ ...l, ...r })); }
    catch (e) { setErrorMsg("Location generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };
  const improveLoc = async () => {
    if (!newLoc.name || generating) return;
    setGenerating(true); setGenTarget("loc");
    try { const r = await callAI("entity", { type: "location", prompt: "", projectContext: buildContext(project), existing: newLoc }); setNewLoc((l: any) => ({ ...l, ...r })); }
    catch (e) { setErrorMsg("Location improvement failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generatePlot = async () => {
    if (!plotGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("plot");
    try { const r = await callAI("entity", { type: "plotThread", prompt: plotGenPrompt, projectContext: buildContext(project) }); setNewPlot((t: any) => ({ ...t, ...r })); }
    catch (e) { setErrorMsg("Plot thread generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };
  const improvePlot = async () => {
    if (!newPlot.name || generating) return;
    setGenerating(true); setGenTarget("plot");
    try { const r = await callAI("entity", { type: "plotThread", prompt: "", projectContext: buildContext(project), existing: newPlot }); setNewPlot((t: any) => ({ ...t, ...r })); }
    catch (e) { setErrorMsg("Plot thread improvement failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const handleQuickStart = () => quickStartStory(outline => { setStreamText(outline); }, setSavedMsg);

  return (
    <>
      <div style={{ width: leftCollapsed ? 48 : 300, minWidth: leftCollapsed ? 48 : 300, background: co.surface, borderRight: "1px solid " + co.border, display: "flex", flexDirection: "column", transition: "all 0.2s", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 10px", borderBottom: "1px solid " + co.border }}>
          {!leftCollapsed && <><span style={{ fontSize: 15, fontWeight: 800, color: co.accent }}>GhostWriter</span><span style={{ fontSize: 9, fontWeight: 600, color: co.muted, background: co.accentBg, padding: "2px 8px", borderRadius: 4 }}>{project.skillLevel === "beginner" ? "🎯 Beginner" : "⭐ Expert"}</span></>}
          <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "4px" }} onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? "▶" : "◀"}</button>
        </div>
        {!leftCollapsed && <>
          <div style={{ display: "flex", borderBottom: "1px solid " + co.border }}>
            {["bible", "style", "memory", "notes"].map(t => <button key={t} onClick={() => setLeftTab(t)} style={{ flex: 1, padding: "9px 0", background: "none", border: "none", borderBottom: leftTab === t ? "2px solid " + co.accent : "2px solid transparent", color: leftTab === t ? co.text : co.muted, fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>{t === "bible" ? "Bible" : t === "style" ? "Style" : t === "memory" ? `Mem${storyMemories.length ? " " + storyMemories.length : ""}` : "Notes"}</button>)}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>
            {project.skillLevel === "beginner" && !project.characters?.length ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ready to generate?</div>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 16, lineHeight: 1.5 }}>I'll create characters, locations, and a plot outline for you.</div>
                <button style={{ ...sBtn, width: "100%" }} disabled={quickStartLoading} onClick={handleQuickStart}>{quickStartLoading ? "Generating..." : "Generate Story"}</button>
              </div>
            ) : leftTab === "notes" ? (
              <textarea style={{ ...sTextarea, minHeight: 200 }} value={project.notes || ""} onChange={e => updateProject((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Saved brainstorm/outline output..." />
            ) : leftTab === "memory" ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input style={{ ...sInput, flex: 1 }} placeholder="Add a fact manually..." value={newMemoryInput} onChange={e => setNewMemoryInput(e.target.value)} onKeyDown={e => {
                    if (e.key === "Enter" && newMemoryInput.trim()) {
                      fetch(`/api/projects/${project.id}/story-memories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fact: newMemoryInput.trim() }) })
                        .then(r => r.json()).then(m => { setStoryMemories((prev: any[]) => [m, ...prev]); setNewMemoryInput(""); }).catch(() => { setErrorMsg("Failed to add memory. Please try again."); });
                    }
                  }} />
                  <button style={sBtnSm} onClick={() => {
                    if (!newMemoryInput.trim()) return;
                    fetch(`/api/projects/${project.id}/story-memories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fact: newMemoryInput.trim() }) })
                      .then(r => r.json()).then(m => { setStoryMemories((prev: any[]) => [m, ...prev]); setNewMemoryInput(""); }).catch(() => { setErrorMsg("Failed to add memory. Please try again."); });
                  }}>Add</button>
                </div>
                {!storyMemories.length && <div style={{ fontSize: 11, color: co.muted, textAlign: "center", padding: "20px 0" }}>Facts are auto-extracted as you write chapters.</div>}
                {(["character_decision", "world_rule", "relationship", "event", "general"] as const).map(cat => {
                  const items = storyMemories.filter((m: any) => m.category === cat);
                  if (!items.length) return null;
                  const labels: Record<string, string> = { character_decision: "Character Decisions", world_rule: "World Rules", relationship: "Relationships", event: "Events", general: "General" };
                  return (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>{labels[cat]}</div>
                      {items.map((m: any) => (
                        <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, background: co.accentBg, borderRadius: 6, padding: "6px 8px", fontSize: 11, marginBottom: 3 }}>
                          <span style={{ flex: 1, lineHeight: 1.5 }}>{m.fact}</span>
                          <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 13, padding: 0, flexShrink: 0 }} onClick={() => {
                            fetch(`/api/projects/${project.id}/story-memories`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memoryId: m.id }) })
                              .then(() => setStoryMemories((prev: any[]) => prev.filter((x: any) => x.id !== m.id))).catch(() => { setErrorMsg("Failed to delete memory."); });
                          }}>×</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : leftTab === "bible" ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Project</label>
                  <input style={{ ...sInput, marginTop: 4, fontWeight: 700 }} value={project.name} onChange={e => updateProject((p: any) => ({ ...p, name: e.target.value }))} />
                  <select style={{ ...sInput, marginTop: 6 }} value={project.format} onChange={e => updateProject((p: any) => ({ ...p, format: e.target.value }))}>{FORMATS.map(f => <option key={f}>{f}</option>)}</select>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap" }}>{GENRES.map(g => <span key={g} onClick={() => updateProject((p: any) => ({ ...p, genres: p.genres.includes(g) ? p.genres.filter((x: any) => x !== g) : [...p.genres, g] }))} style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: "1px solid " + (project.genres.includes(g) ? co.accent : co.border), background: project.genres.includes(g) ? co.accentBg : "transparent", color: project.genres.includes(g) ? co.accent : co.muted, fontWeight: project.genres.includes(g) ? 600 : 400, margin: 2 }}>{g}</span>)}</div>
                </div>
                {isCreatorFormat(project.format) ? (
                  <>
                    <div style={{ background: co.accentBg, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, marginBottom: 6 }}>AI GENERATE BIBLE</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={sInput} placeholder="Tech review channel for Gen Z..." value={bibleGenPrompt} onChange={e => setBibleGenPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && generateCreatorBible()} />
                        <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={generateCreatorBible}>{genTarget === "bible" ? "..." : "Generate"}</button>
                      </div>
                    </div>
                    {([
                      ["Channel Name", "channelName", "input", "My Channel"],
                      ["Niche / Topic", "niche", "input", "Personal finance for millennials"],
                      ["Target Audience Age", "audienceAge", "input", "18-34"],
                      ["Audience Interests", "audienceInterests", "textarea", "Investing, side hustles, frugal living"],
                      ["Audience Pain Points", "audiencePainPoints", "textarea", "Don't know where to start"],
                      ["Voice & Tone", "channelVoice", "textarea", "Casual, punchy, no-BS"],
                      ["Default CTA", "defaultCta", "input", "Subscribe for weekly videos"],
                      ["Competitor Notes", "competitorNotes", "textarea", "MrBeast — big stunts. Ali Abdaal — calm & educational."],
                    ] as [string, string, string, string][]).map(([label, field, type, placeholder]) => (
                      <div key={field} style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 4 }}>{label}</span>
                        {type === "input"
                          ? <input style={sInput} value={creatorBible?.[field] || ""} onChange={e => updateCreatorBible(field, e.target.value)} placeholder={placeholder} />
                          : <textarea style={{ ...sTextarea, minHeight: 60 }} value={creatorBible?.[field] || ""} onChange={e => updateCreatorBible(field, e.target.value)} placeholder={placeholder} />}
                      </div>
                    ))}
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Content Pillars</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        {(creatorBible?.contentPillars || []).map((pillar: string) => (
                          <span key={pillar} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, fontSize: 11, background: co.accentBg, border: "1px solid " + co.accent, color: co.accent }}>
                            {pillar}
                            <button style={{ background: "none", border: "none", color: co.accent, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }} onClick={() => updateCreatorBible("contentPillars", (creatorBible.contentPillars || []).filter((x: string) => x !== pillar))}>×</button>
                          </span>
                        ))}
                      </div>
                      <input style={sInput} placeholder="Add pillar + Enter" value={pillarInput} onChange={e => setPillarInput(e.target.value)} onKeyDown={e => {
                        if (e.key === "Enter" && pillarInput.trim()) {
                          const existing = creatorBible?.contentPillars || [];
                          if (!existing.includes(pillarInput.trim())) updateCreatorBible("contentPillars", [...existing, pillarInput.trim()]);
                          setPillarInput("");
                        }
                      }} />
                    </div>
                  </>
                ) : (
                  <>
                    {project.characters?.length > 0 && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                        <button title="Shows which characters appear together in chapters" style={{ ...sBtnSm, background: showRelMap ? co.accentBg : "transparent", color: showRelMap ? co.accent : co.muted, border: "1px solid " + (showRelMap ? co.accent : co.border) }} onClick={() => { const n = !showRelMap; setShowRelMap(n); if (n) loadRelMap(); }}>🕸 Connections</button>
                      </div>
                    )}
                    {showRelMap ? (
                      <div>
                        {relMapLoading && <div style={{ textAlign: "center", padding: 20, color: co.muted, fontSize: 12 }}>Building connections...</div>}
                        {!relMapLoading && relMapData && (() => {
                          const nodes = relMapData.nodes;
                          const svgSize = 210, cx = svgSize / 2, cy = svgSize / 2;
                          const radius = nodes.length <= 1 ? 0 : Math.min(70, svgSize / 2 - 30);
                          const nodeR = 18;
                          const angleStep = nodes.length > 1 ? (2 * Math.PI) / nodes.length : 0;
                          const pos = nodes.map((_: any, i: number) => ({ x: cx + radius * Math.cos(i * angleStep - Math.PI / 2), y: cy + radius * Math.sin(i * angleStep - Math.PI / 2) }));
                          const isolatedIds = new Set(relMapData.isolated.map((n: any) => n.id));
                          return (
                            <>
                              {nodes.length === 0 && <div style={{ textAlign: "center", padding: 20, color: co.muted, fontSize: 12 }}>Add characters to see who appears together in chapters.</div>}
                              {nodes.length > 0 && (
                                <svg width={svgSize} height={svgSize} style={{ display: "block", margin: "0 auto" }}>
                                  {relMapData.edges.map((edge: any, ei: number) => {
                                    const ai = nodes.findIndex((n: any) => n.id === edge.charAId);
                                    const bi = nodes.findIndex((n: any) => n.id === edge.charBId);
                                    if (ai < 0 || bi < 0) return null;
                                    const isSel = selectedMapEdge?.charAId === edge.charAId && selectedMapEdge?.charBId === edge.charBId;
                                    return (
                                      <g key={ei} onClick={() => { setSelectedMapEdge(edge); setSelectedMapNode(null); }} style={{ cursor: "pointer" }}>
                                        <line x1={pos[ai].x} y1={pos[ai].y} x2={pos[bi].x} y2={pos[bi].y} stroke={isSel ? co.accent : co.muted} strokeWidth={Math.min(1 + edge.sharedChapters * 0.8, 4)} opacity={0.6} />
                                        <line x1={pos[ai].x} y1={pos[ai].y} x2={pos[bi].x} y2={pos[bi].y} stroke="transparent" strokeWidth={14} />
                                      </g>
                                    );
                                  })}
                                  {nodes.map((node: any, i: number) => {
                                    const isIso = isolatedIds.has(node.id);
                                    const isSel = selectedMapNode?.id === node.id;
                                    const isOnEdge = selectedMapEdge && (selectedMapEdge.charAId === node.id || selectedMapEdge.charBId === node.id);
                                    const initials = node.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                                    return (
                                      <g key={node.id} onClick={() => { if (isIso) { setSelectedMapNode(node); setSelectedMapEdge(null); } else { setSelectedMapEdge(null); setSelectedMapNode(null); } }} style={{ cursor: isIso ? "pointer" : "default" }}>
                                        {node.portraitUrl ? (
                                          <>
                                            <defs><clipPath id={"clip-" + node.id}><circle cx={pos[i].x} cy={pos[i].y} r={nodeR} /></clipPath></defs>
                                            <circle cx={pos[i].x} cy={pos[i].y} r={nodeR} fill={isIso ? "#fef2f2" : co.accentBg} stroke={isSel || isOnEdge ? co.accent : isIso ? "#ef4444" : co.border} strokeWidth={2} />
                                            <image href={node.portraitUrl} x={pos[i].x - nodeR} y={pos[i].y - nodeR} width={nodeR * 2} height={nodeR * 2} clipPath={"url(#clip-" + node.id + ")"} preserveAspectRatio="xMidYMid slice" />
                                          </>
                                        ) : (
                                          <circle cx={pos[i].x} cy={pos[i].y} r={nodeR} fill={isIso ? "#fef2f2" : co.accentBg} stroke={isSel || isOnEdge ? co.accent : isIso ? "#ef4444" : co.border} strokeWidth={isIso ? 2 : 1.5} />
                                        )}
                                        {!node.portraitUrl && <text x={pos[i].x} y={pos[i].y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={700} fill={isIso ? "#ef4444" : co.accent}>{initials}</text>}
                                        {isIso && <text x={pos[i].x + nodeR - 3} y={pos[i].y - nodeR + 3} fontSize={11}>⚠️</text>}
                                        <text x={pos[i].x} y={pos[i].y + nodeR + 11} textAnchor="middle" fontSize={9} fill={co.text}>{node.name.split(" ")[0]}</text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              )}
                              {selectedMapEdge && (
                                <div style={{ marginTop: 10, padding: "10px 12px", background: co.accentBg, borderRadius: 10, border: "1px solid " + co.accent }}>
                                  <div style={{ fontSize: 11, marginBottom: 8 }}><strong>{selectedMapEdge.charAName}</strong> × <strong>{selectedMapEdge.charBName}</strong> — {selectedMapEdge.sharedChapters} shared scene{selectedMapEdge.sharedChapters !== 1 ? "s" : ""}</div>
                                  <button style={{ ...sBtn, width: "100%", fontSize: 11 }} onClick={() => { setPrompt(`Write a scene where ${selectedMapEdge.charAName} and ${selectedMapEdge.charBName} interact.`); setMode("write"); setShowRelMap(false); setSelectedMapEdge(null); }}>✍️ Write scene together</button>
                                </div>
                              )}
                              {selectedMapNode && (
                                <div style={{ marginTop: 10, padding: "10px 12px", background: "#fef2f2", borderRadius: 10, border: "1px solid #ef4444" }}>
                                  <div style={{ fontSize: 11, marginBottom: 8, color: "#ef4444" }}>⚠️ <strong>{selectedMapNode.name}</strong> hasn't shared a scene with anyone.</div>
                                  <button style={{ ...sBtn, width: "100%", fontSize: 11, background: "#ef4444" }} onClick={() => { setPrompt(`Write a scene featuring ${selectedMapNode.name}.`); setMode("write"); setShowRelMap(false); setSelectedMapNode(null); }}>✍️ Write scene with {selectedMapNode.name}</button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <>
                        {project.chapters?.length >= 3 && project.characters?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <button style={{ ...sBtnSm, width: "100%", marginBottom: linkSuggestions.length ? 8 : 0 }} onClick={suggestLinks} disabled={suggestingLinks}>{suggestingLinks ? "Scanning..." : "🔗 Suggest Links"}</button>
                            {linkSuggestions.map((s: any, i: number) => (
                              <div key={i} style={{ background: co.accentBg, borderRadius: 8, padding: "7px 10px", fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ flex: 1 }}><strong>{s.characterName}</strong> + <strong>{s.targetName}</strong> — {s.coOccurrences} chapters</span>
                                <button style={{ ...sBtn, padding: "3px 8px", fontSize: 10 }} onClick={() => confirmLink(s)}>Link</button>
                                <button style={{ ...sBtnSm, padding: "3px 8px", fontSize: 10 }} onClick={() => setLinkSuggestions((prev: any[]) => prev.filter((_: any, j: number) => j !== i))}>Skip</button>
                              </div>
                            ))}
                            {linkSuggestions.length > 1 && <button style={{ ...sBtnSm, width: "100%", fontSize: 10 }} onClick={() => setLinkSuggestions([])}>Dismiss all</button>}
                          </div>
                        )}
                        {project.skillLevel === "beginner" && project.characters?.length > 0 && <div style={{ background: co.accentBg, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 11, color: co.text }}><div style={{ fontWeight: 700, marginBottom: 6, color: co.accent }}>💡 QUICK TIP</div><div>You can edit characters, locations, and plot threads to your liking, or use AI Improve to enhance them.</div></div>}
                        {project.skillLevel === "expert" && <div style={{ background: co.accentBg, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, marginBottom: 6 }}>AI WORLD BUILDER</div>
                          <div style={{ display: "flex", gap: 6 }}><input style={sInput} placeholder="A heist in a floating city..." value={bibleGenPrompt} onChange={e => setBibleGenPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && generateWorldBible()} /><button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={generateWorldBible}>{genTarget === "bible" ? "..." : "Build"}</button></div>
                        </div>}
                        {([["Characters", project.characters, openCharNew, openCharEdit, "characters"], ["Locations", project.locations, openLocNew, openLocEdit, "locations"], ["Plot Threads", project.plotThreads, openPlotNew, openPlotEdit, "plotThreads"]] as [string, any[], () => void, (i: number) => void, string][]).map(([title, items, onNew, onEdit, key]) => (
                          <div key={key} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>{title} ({items.length})</span>
                              <button style={sBtnSm} onClick={onNew}>+ Add</button>
                            </div>
                            {items.map((item: any, i: number) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: co.accentBg, borderRadius: 8, padding: "6px 10px", fontSize: 12, margin: "3px 0", cursor: "pointer" }} onClick={() => onEdit(i)}>
                                {item.status && <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.status === "Active" ? co.green : item.status === "Resolved" ? co.muted : co.orange, flexShrink: 0 }} />}
                                <span style={{ flex: 1 }}><strong>{item.name}</strong>{item.role && <span style={{ color: co.muted, fontSize: 11 }}> · {item.role}</span>}</span>
                                <span style={{ fontSize: 10, color: co.accent }}>edit</span>
                                <button title={item.alwaysInContext === false ? "Minor — click to pin to AI context" : "Pinned to AI context — click to mark as minor"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0, color: item.alwaysInContext === false ? co.muted : co.accent }} onClick={e => { e.stopPropagation(); toggleAlwaysInContext(key, item, i); }}>{item.alwaysInContext === false ? "☆" : "★"}</button>
                                <button style={{ background: "none", border: "none", color: co.danger, cursor: "pointer", fontSize: 13, padding: 0 }} onClick={e => { e.stopPropagation(); setConfirmModal({ msg: "Delete " + item.name + "?", action: async () => { await fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${item.id}`, { method: "DELETE" }); updateProject((p: any) => ({ ...p, [key]: p[key].filter((_: any, j: number) => j !== i) })); setConfirmModal(null); } }); }}>x</button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {project.skillLevel === "expert" && <button style={{ ...sBtn, width: "100%", marginBottom: 12, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={suggestRefWorks}>{genTarget === "ref-suggest" ? "..." : "Suggest Reference Works"}</button>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Reference Works</span>
                  <button style={sBtnSm} onClick={() => { setNewRef({ title: "", attributes: {} }); setShowRefModal(true); }}>+ Add</button>
                </div>
                {project.referenceWorks.map((r: any, i: number) => (
                  <div key={i} style={{ background: co.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8, border: "1px solid " + co.border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><strong style={{ fontSize: 13 }}>"{r.title}"</strong><button style={{ ...sBtnSm, background: "#fdeaea", color: co.danger }} onClick={async () => { await fetch(`/api/projects/${project.id}/reference-works/${r.id}`, { method: "DELETE" }); updateProject((p: any) => ({ ...p, referenceWorks: p.referenceWorks.filter((_: any, j: number) => j !== i) })); }}>Remove</button></div>
                    {Object.entries(r.attributes || {}).map(([k, v]) => <div key={k} style={{ fontSize: 11, color: co.muted }}><span style={{ color: co.accent, fontWeight: 600 }}>{k}:</span> {v as string}</div>)}
                  </div>
                ))}
              </>
            )}
          </div>
          <div style={{ padding: 10, borderTop: "1px solid " + co.border, display: "flex", gap: 6 }}>
            <button style={{ ...sBtn, flex: 1 }} onClick={save}>{savedMsg || "Save"}</button>
            <button style={sBtnSm} onClick={exportAll}>Export</button>
          </div>
        </>}
      </div>

      {/* Entity Modals */}
      {([
        [showCharModal, setShowCharModal, editCharIdx !== null ? "Edit Character" : "Create Character", CharFields, newChar, setNewChar, charGenPrompt, setCharGenPrompt, saveChar, "char", generateChar, improveChar],
        [showLocModal, setShowLocModal, editLocIdx !== null ? "Edit Location" : "Add Location", LocFields, newLoc, setNewLoc, locGenPrompt, setLocGenPrompt, saveLoc, "loc", generateLoc, improveLoc],
        [showPlotModal, setShowPlotModal, editPlotIdx !== null ? "Edit Plot Thread" : "Add Plot Thread", PlotFields, newPlot, setNewPlot, plotGenPrompt, setPlotGenPrompt, savePlot, "plot", generatePlot, improvePlot],
      ] as any[]).map(([show, setShow, title, fields, data, setData, gp, setGp, onSave, tKey, genFn, improveFn], mi) => show && (
        <div key={mi} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShow(false)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 540, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid " + co.border }} onClick={(e: any) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800 }}>{title}</h3>
            {mi === 0 && isStoryFormat(project.format) && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: 12, background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border }}>
                {newChar.portraitUrl
                  ? <img src={newChar.portraitUrl} alt="portrait" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 80, height: 80, borderRadius: 8, background: co.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🎨</div>}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Character Portrait</div>
                  <button style={{ ...sBtnSm, opacity: (portraitLoading || !newChar.appearance) ? 0.5 : 1 }} disabled={portraitLoading || !newChar.appearance} onClick={() => editCharIdx !== null && generatePortrait(editCharIdx).then(url => { if (url) setNewChar((c: any) => ({ ...c, portraitUrl: url })); })}>
                    {portraitLoading ? "Generating..." : newChar.portraitUrl ? "Regenerate" : "Generate Portrait"}
                  </button>
                  {!newChar.appearance && <div style={{ fontSize: 10, color: co.muted, marginTop: 4 }}>Add appearance first</div>}
                </div>
              </div>
            )}
            <div style={{ background: co.accentBg, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 6 }}>AI GENERATE</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={sInput} placeholder="Describe..." value={gp} onChange={(e: any) => setGp(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && genFn()} />
                <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={genFn}>{genTarget === tKey ? "..." : "New"}</button>
              </div>
              {data.name && <button style={{ padding: "5px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, background: "#f0e6ff", color: "#7c3aed", width: "100%", marginTop: 8, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={improveFn}>{genTarget === tKey ? "Improving..." : "AI Improve"}</button>}
            </div>
            {fields.map(([key, label, type]: [string, string, string]) => (
              <div key={key} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: co.muted, marginBottom: 2, display: "block", fontWeight: 600 }}>{label}</span>
                {type === "input"
                  ? <input style={sInput} value={data[key] || ""} onChange={(e: any) => setData((d: any) => ({ ...d, [key]: e.target.value }))} />
                  : <textarea style={sTextarea} rows={2} value={data[key] || ""} onChange={(e: any) => setData((d: any) => ({ ...d, [key]: e.target.value }))} />}
              </div>
            ))}
            {tKey === "plot" && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: co.muted, marginBottom: 2, display: "block", fontWeight: 600 }}>Status</span><select style={sInput} value={newPlot.status} onChange={e => setNewPlot((t: any) => ({ ...t, status: e.target.value }))}><option>Active</option><option>Simmering</option><option>Resolved</option></select></div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button style={sBtnSm} onClick={() => setShow(false)}>Cancel</button>
              <button style={sBtn} disabled={!data.name} onClick={onSave}>{editCharIdx !== null || editLocIdx !== null || editPlotIdx !== null ? "Save Changes" : "Add"}</button>
            </div>
          </div>
        </div>
      ))}

      {/* Ref Work Modal */}
      {showRefModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowRefModal(false)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 520, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800 }}>Add Reference Work</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input style={{ ...sInput, flex: 1 }} placeholder='"The Shining"' value={newRef.title} onChange={e => setNewRef((r: any) => ({ ...r, title: e.target.value }))} />
              <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={analyzeRefWork}>{genTarget === "ref" ? "..." : "Analyze"}</button>
            </div>
            {Object.keys(newRef.attributes).length > 0 && STYLE_ATTRS.map(a => (
              <div key={a} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: co.muted, marginBottom: 2, display: "block", fontWeight: 600 }}>{a}</span>
                <input style={sInput} value={newRef.attributes[a] || ""} onChange={e => setNewRef((r: any) => ({ ...r, attributes: { ...r.attributes, [a]: e.target.value } }))} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button style={sBtnSm} onClick={() => setShowRefModal(false)}>Cancel</button>
              <button style={sBtn} disabled={!newRef.title || !Object.keys(newRef.attributes).length} onClick={async () => {
                const res = await fetch(`/api/projects/${project.id}/reference-works`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRef) });
                const created = await res.json();
                updateProject((p: any) => ({ ...p, referenceWorks: [...p.referenceWorks, created] }));
                setShowRefModal(false);
              }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
