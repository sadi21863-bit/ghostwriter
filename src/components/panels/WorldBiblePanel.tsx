"use client";
import { useState, useEffect, useRef } from "react";
import { buildContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { co, sInput, sTextarea, sBtn, sBtnSm } from "@/lib/styles";
import { GENRE_DEFAULT_RULES } from "@/lib/ai/genre-rules";
import { isCreatorFormat, isStoryFormat, FORMATS, GENRES, STYLE_ATTRS, DEFAULT_CHAR, DEFAULT_LOC, DEFAULT_PLOT, CharFields, LocFields, PlotFields } from "@/lib/formats";
import { EmptyState } from "@/components/EmptyState";
import { extractVoiceFingerprint } from "@/lib/ai/voice-fingerprint";

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
  const [seriesPlan, setSeriesPlan] = useState<any>(null);
  const [seriesPlanLoading, setSeriesPlanLoading] = useState(false);
  const [relMapData, setRelMapData] = useState<{ nodes: any[]; edges: any[]; isolated: any[] } | null>(null);
  const [relMapLoading, setRelMapLoading] = useState(false);
  const [selectedMapEdge, setSelectedMapEdge] = useState<any | null>(null);
  const [selectedMapNode, setSelectedMapNode] = useState<any | null>(null);

  // Series / Universe linking state
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allUniverses, setAllUniverses] = useState<any[]>([]);
  const [seriesDataLoaded, setSeriesDataLoaded] = useState(false);

  const loadSeriesData = async () => {
    if (seriesDataLoaded) return;
    const [ps, us] = await Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/universes').then(r => r.json()),
    ]);
    setAllProjects(Array.isArray(ps) ? ps.filter((p: any) => p.id !== project.id) : []);
    setAllUniverses(Array.isArray(us) ? us : []);
    setSeriesDataLoaded(true);
  };

  // Trend Intelligence state
  const [trendKeyConnected, setTrendKeyConnected] = useState(false);
  const [trendKeyInput, setTrendKeyInput] = useState("");
  const [trendSetupStep, setTrendSetupStep] = useState(0);
  const [savingTrendKey, setSavingTrendKey] = useState(false);
  const [trendPlatform, setTrendPlatform] = useState("YouTube");
  const [trendKeyword, setTrendKeyword] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendResults, setTrendResults] = useState<any>(null);

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

  // Character Evolution modal state
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [evolutionCharName, setEvolutionCharName] = useState("");
  const [evolutionCharId, setEvolutionCharId] = useState("");
  const [evolutionLogs, setEvolutionLogs] = useState<any[]>([]);
  const [evolutionLoading, setEvolutionLoading] = useState(false);

  // Visual Profile generation state
  const [visualProfileLoading, setVisualProfileLoading] = useState(false);

  // World Knowledge Matrix state
  const [kmState, setKmState] = useState("IGNORANT");
  const [kmEntity, setKmEntity] = useState("");
  const [kmBelief, setKmBelief] = useState("");

  // AI Rules state
  const [newRuleText, setNewRuleText] = useState("");

  // World Bible inference state
  const [inferLoading, setInferLoading] = useState(false);
  const [inferResult, setInferResult] = useState<any>(null);
  const [inferSelected, setInferSelected] = useState<Record<string, boolean>>({});

  // Soul ID training modal state
  const [showSoulIdModal, setShowSoulIdModal] = useState(false);
  const [soulIdCharId, setSoulIdCharId] = useState("");
  const [soulIdUrls, setSoulIdUrls] = useState("");
  const [soulIdTraining, setSoulIdTraining] = useState(false);
  const [soulIdJobId, setSoulIdJobId] = useState("");
  const [soulIdMsg, setSoulIdMsg] = useState("");
  const soulIdPollRef = useRef<any>(null);
  useEffect(() => { return () => { if (soulIdPollRef.current) clearInterval(soulIdPollRef.current); }; }, []);

  const loadRelMap = async () => {
    setRelMapLoading(true); setSelectedMapEdge(null); setSelectedMapNode(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/relationship-map`);
      const data = await res.json();
      setRelMapData(data);
    } catch (e) { setErrorMsg("Failed to load character connections. Please try again."); }
    setRelMapLoading(false);
  };

  const patchRelationship = async (charAId: string, charBId: string, fields: Record<string, any>) => {
    await fetch(`/api/projects/${project.id}/relationship-map`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterAId: charAId, characterBId: charBId, ...fields }),
    });
    // Update local relMapData to reflect the change
    setRelMapData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        edges: prev.edges.map((e: any) =>
          e.charAId === charAId && e.charBId === charBId
            ? { ...e, ...fields }
            : e
        ),
      };
    });
    setSelectedMapEdge((prev: any) => prev ? { ...prev, ...fields } : prev);
  };

  const openEvolution = async (char: any) => {
    setEvolutionCharName(char.name);
    setEvolutionCharId(char.id);
    setEvolutionLogs([]);
    setEvolutionLoading(true);
    setShowEvolutionModal(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${char.id}/evolution`);
      const data = await res.json();
      setEvolutionLogs(data.logs || []);
    } catch { setErrorMsg("Failed to load evolution timeline."); }
    setEvolutionLoading(false);
  };

  const openSoulIdModal = (charId: string) => {
    setSoulIdCharId(charId);
    setSoulIdUrls("");
    setSoulIdMsg("");
    setSoulIdJobId("");
    setShowSoulIdModal(true);
  };

  const startSoulIdTraining = async () => {
    const urls = soulIdUrls.split("\n").map(u => u.trim()).filter(Boolean);
    if (urls.length < 3) { setSoulIdMsg("Enter at least 3 image URLs (one per line)."); return; }
    setSoulIdTraining(true);
    setSoulIdMsg("Starting Soul ID training...");
    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${soulIdCharId}/soul-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrls: urls }),
      });
      const data = await res.json();
      if (!res.ok) { setSoulIdMsg(data.error || "Training failed."); setSoulIdTraining(false); return; }
      setSoulIdJobId(data.jobId);
      setSoulIdMsg("Training Soul ID... (30–120 seconds)");
      pollSoulId(data.jobId, soulIdCharId);
    } catch { setSoulIdMsg("Training failed. Please try again."); setSoulIdTraining(false); }
  };

  const pollSoulId = (jobId: string, charId: string) => {
    if (soulIdPollRef.current) clearInterval(soulIdPollRef.current);
    soulIdPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/characters/${charId}/soul-id?jobId=${jobId}`);
        const data = await res.json();
        if (data.status === "completed") {
          clearInterval(soulIdPollRef.current); soulIdPollRef.current = null;
          setSoulIdTraining(false);
          setSoulIdMsg("Soul ID trained successfully!");
          updateProject((p: any) => ({
            ...p,
            characters: p.characters.map((c: any) => c.id === charId ? { ...c, soulId: data.soulId } : c),
          }));
          setTimeout(() => setShowSoulIdModal(false), 1500);
        } else if (data.status === "failed") {
          clearInterval(soulIdPollRef.current); soulIdPollRef.current = null;
          setSoulIdTraining(false);
          setSoulIdMsg("Training failed. Please try again with clearer photos.");
        }
      } catch {
        clearInterval(soulIdPollRef.current); soulIdPollRef.current = null;
        setSoulIdTraining(false); setSoulIdMsg("Polling error.");
      }
    }, 8000);
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

  useEffect(() => {
    fetch("/api/user/settings").then(r => r.json()).then(data => {
      setTrendKeyConnected(data.trendIntelligenceKeySet ?? false);
    }).catch(() => {});
  }, []);

  const runTrendSearch = async () => {
    if (!trendKeyword.trim() || trendLoading) return;
    setTrendLoading(true);
    setTrendResults(null);
    try {
      const endpoint = trendPlatform === "YouTube" ? "/api/ai/trend-youtube" : "/api/ai/trend-instagram";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trendKeyword, format: project.format, creatorBible }),
      });
      const data = await res.json();
      if (data.error === "TREND_INTELLIGENCE_NOT_CONNECTED") { setTrendKeyConnected(false); return; }
      if (data.error === "TREND_INTELLIGENCE_KEY_INVALID") { setErrorMsg("Your Trend Intelligence key appears to be invalid. Please update it in the setup above."); setTrendKeyConnected(false); return; }
      if (data.error === "TREND_INTELLIGENCE_QUOTA_EXCEEDED") { setErrorMsg("You've used your free trend searches for this month. Upgrade your data plan to continue."); return; }
      if (!res.ok) { setErrorMsg(data.error || "Trend search failed. Please try again."); return; }
      setTrendResults(data.analysis);
    } catch {
      setErrorMsg("Trend search failed. Check your connection.");
    } finally {
      setTrendLoading(false);
    }
  };

  return (
    <>
      <div style={{ width: leftCollapsed ? 48 : 300, minWidth: leftCollapsed ? 48 : 300, background: co.surface, borderRight: "1px solid " + co.border, display: "flex", flexDirection: "column", transition: "all 0.2s", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 10px", borderBottom: "1px solid " + co.border }}>
          {!leftCollapsed && <><span style={{ fontSize: 15, fontWeight: 800, color: co.accent }}>GhostWriter</span><span style={{ fontSize: 9, fontWeight: 600, color: co.muted, background: co.accentBg, padding: "2px 8px", borderRadius: 4 }}>{project.skillLevel === "beginner" ? "🎯 Beginner" : "⭐ Expert"}</span></>}
          <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "4px" }} onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? "▶" : "◀"}</button>
        </div>
        {!leftCollapsed && <>
          <div style={{ display: "flex", borderBottom: "1px solid " + co.border }}>
            {(isCreatorFormat(project.format) ? ["bible", "trends", "memory", "notes"] : ["bible", "style", "memory", "notes"]).map(t => <button key={t} onClick={() => setLeftTab(t)} style={{ flex: 1, padding: "9px 0", background: "none", border: "none", borderBottom: leftTab === t ? "2px solid " + co.accent : "2px solid transparent", color: leftTab === t ? co.text : co.muted, fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>{t === "bible" ? "Bible" : t === "style" ? "Style" : t === "trends" ? "Trends" : t === "memory" ? `Mem${storyMemories.length ? " " + storyMemories.length : ""}` : "Notes"}</button>)}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>
            {project.skillLevel === "beginner" && !project.characters?.length ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ready to generate?</div>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 16, lineHeight: 1.5 }}>I'll create characters, locations, and a plot outline for you.</div>
                <button style={{ ...sBtn, width: "100%" }} disabled={quickStartLoading} onClick={handleQuickStart}>{quickStartLoading ? "Generating..." : "Generate Story"}</button>
              </div>
            ) : leftTab === "notes" ? (() => {
              const raw = project.notes || "";
              const sections: { label: string; content: string }[] = [];
              raw.split(/\n---\n/).forEach((part: string) => {
                const match = part.match(/^\[([A-Z]+)\]\n([\s\S]*)/);
                if (match) sections.push({ label: match[1], content: match[2].trim() });
                else if (part.trim()) sections.push({ label: "NOTE", content: part.trim() });
              });
              return (
                <div>
                  {!sections.length && <div style={{ fontSize: 11, color: co.muted, textAlign: "center", padding: "20px 0" }}>Brainstorm and Outline output saves here automatically.</div>}
                  {sections.map((s, i) => (
                    <details key={i} style={{ marginBottom: 8, background: co.surfaceAlt, borderRadius: 8, overflow: "hidden" }}>
                      <summary style={{ padding: "8px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: co.accent, userSelect: "none" }}>
                        {s.label} {i === 0 ? "(latest)" : ""}
                      </summary>
                      <div style={{ padding: "8px 12px", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", borderTop: "1px solid " + co.border }}>
                        {s.content}
                      </div>
                    </details>
                  ))}
                  <textarea style={{ ...sTextarea, minHeight: 80, marginTop: 8 }} placeholder="Add a note manually..."
                    onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => {
                      if (e.target.value.trim()) {
                        updateProject((p: any) => ({ ...p, notes: (p.notes || "") + (p.notes ? "\n---\n" : "") + "[NOTE]\n" + e.target.value.trim() }));
                        e.target.value = "";
                      }
                    }} />

                  {/* AI Writing Rules */}
                  <div style={{ marginTop: 16, borderTop: "1px solid " + co.border, paddingTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: co.text, marginBottom: 4 }}>AI Writing Rules</div>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 10 }}>
                      Rules the AI must follow in every generation for this project. Max 10.
                    </div>
                    {/* Genre defaults */}
                    {(project.genres || []).flatMap((g: string) => GENRE_DEFAULT_RULES[g] || []).length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: co.muted, marginBottom: 4 }}>Genre defaults</div>
                        {(project.genres || []).flatMap((g: string) => GENRE_DEFAULT_RULES[g] || []).map((text: string, i: number) => (
                          <div key={i} style={{ padding: "5px 8px", background: co.surfaceAlt, borderRadius: 6, fontSize: 11, color: co.muted, marginBottom: 4 }}>{text}</div>
                        ))}
                      </div>
                    )}
                    {/* User rules */}
                    {(project.aiRules || []).filter((r: any) => r.source === "user").map((rule: any) => (
                      <div key={rule.id} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: co.text, flex: 1 }}>{rule.text}</span>
                        <button
                          onClick={async () => {
                            const updated = (project.aiRules || []).filter((r: any) => r.id !== rule.id);
                            await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiRules: updated }) });
                            updateProject((p: any) => ({ ...p, aiRules: updated }));
                          }}
                          style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                    {/* Add rule */}
                    {((project.aiRules || []).filter((r: any) => r.source === "user").length < 10) && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <input
                          value={newRuleText}
                          onChange={e => setNewRuleText(e.target.value)}
                          placeholder='e.g. "POV always stays on Mira." or "Magic requires blood."'
                          onKeyDown={async e => {
                            if (e.key === "Enter" && newRuleText.trim()) {
                              const newRule = { id: crypto.randomUUID(), text: newRuleText.trim(), source: "user" };
                              const updated = [...(project.aiRules || []), newRule];
                              await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiRules: updated }) });
                              updateProject((p: any) => ({ ...p, aiRules: updated }));
                              setNewRuleText("");
                            }
                          }}
                          style={{ ...sInput, flex: 1, fontSize: 11 }}
                        />
                        <button style={sBtnSm} onClick={async () => {
                          if (!newRuleText.trim()) return;
                          const newRule = { id: crypto.randomUUID(), text: newRuleText.trim(), source: "user" };
                          const updated = [...(project.aiRules || []), newRule];
                          await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiRules: updated }) });
                          updateProject((p: any) => ({ ...p, aiRules: updated }));
                          setNewRuleText("");
                        }}>Add</button>
                      </div>
                    )}
                    <span style={{ fontSize: 10, color: co.muted }}>
                      {(project.aiRules || []).filter((r: any) => r.source === "user").length}/10 user rules
                    </span>
                  </div>
                </div>
              );
            })()
            : leftTab === "memory" ? (
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
                {(isCreatorFormat(project.format)
                  ? ["previous_position", "recurring_segment", "running_joke", "established_reference", "general"]
                  : ["character_decision", "world_rule", "relationship", "event", "general"]
                ).map(cat => {
                  const items = storyMemories.filter((m: any) => m.category === cat);
                  if (!items.length) return null;
                  const labels: Record<string, string> = {
                    character_decision: "Character Decisions", world_rule: "World Rules",
                    relationship: "Relationships", event: "Events", general: "General",
                    previous_position: "Previous Positions", recurring_segment: "Recurring Segments",
                    running_joke: "Running Jokes", established_reference: "Established References",
                  };
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
                  {isStoryFormat(project.format) && (
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginTop: 12, padding: "10px 12px", background: project.isHiggsfieldProject ? "rgba(79,70,229,0.08)" : co.surface, borderRadius: 8, border: "1px solid " + (project.isHiggsfieldProject ? "#4F46E5" : co.border) }}>
                      <input
                        type="checkbox"
                        checked={project.isHiggsfieldProject ?? false}
                        onChange={e => {
                          updateProject((p: any) => ({ ...p, isHiggsfieldProject: e.target.checked }));
                          fetch(`/api/projects/${project.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isHiggsfieldProject: e.target.checked }),
                          }).catch(() => {});
                        }}
                        style={{ marginTop: 2, flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: project.isHiggsfieldProject ? "#818cf8" : co.text }}>Optimized for Higgsfield Original Series</div>
                        <div style={{ fontSize: 11, color: co.muted, marginTop: 2 }}>Episode structure, visual storytelling hints, contest package export as default.</div>
                      </div>
                    </label>
                  )}
                  {isStoryFormat(project.format) && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Narrator Voice</span>
                        <textarea
                          value={(project as any).narratorVoice ?? ''}
                          onChange={e => updateProject((p: any) => ({ ...p, narratorVoice: e.target.value }))}
                          placeholder={"What does this narrator notice that others don't? What do they refuse to sentimentalize?\ne.g. 'The narrator finds comedy in failure, beauty in obstinacy, and is deeply suspicious of clean resolution.'"}
                          rows={3}
                          style={{ ...sTextarea, fontSize: 11 }}
                        />
                        <span style={{ fontSize: 10, color: co.muted }}>The authorial lens — distinct from character voice or style.</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Narrative Structure</span>
                        <select
                          value={(project as any).narrativeStructure ?? 'linear'}
                          onChange={e => updateProject((p: any) => ({ ...p, narrativeStructure: e.target.value }))}
                          style={{ ...sInput, fontSize: 11 }}
                        >
                          <option value="linear">Linear — straightforward chronological narrative</option>
                          <option value="frame">Frame Narrative — outer narrator telling inner story</option>
                          <option value="stories-within-stories">Stories Within Stories — recursive, Mahabharata structure</option>
                          <option value="multi-timeline">Multi-Timeline — parallel narratives that rhyme thematically</option>
                          <option value="epistolary">Epistolary — letters, diaries, documents the reader assembles</option>
                        </select>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 10 }}>
                        <input
                          type="checkbox"
                          checked={(project as any).qualityGradingEnabled ?? false}
                          onChange={e => updateProject((p: any) => ({ ...p, qualityGradingEnabled: e.target.checked }))}
                        />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: co.text }}>AI Quality Review (Story Pro)</div>
                          <div style={{ fontSize: 10, color: co.muted }}>After each generation, checks for rule violations and slop markers. Off by default. Adds ~1s.</div>
                        </div>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 10 }}>
                        <input
                          type="checkbox"
                          checked={(project as any).aiismsCheck ?? false}
                          onChange={e => updateProject((p: any) => ({ ...p, aiismsCheck: e.target.checked }))}
                        />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: co.text }}>AIisms check (Story Pro)</div>
                          <div style={{ fontSize: 10, color: co.muted }}>Instructs the model to avoid the 20 most common AI fiction tells. Adds a constraint block to every generation.</div>
                        </div>
                      </label>
                      {(() => {
                        const chapterContents = (project.chapters ?? [])
                          .filter((c: any) => c.content && c.content.trim().length > 200)
                          .map((c: any) => c.content as string);
                        const fp = chapterContents.length >= 3
                          ? extractVoiceFingerprint(chapterContents)
                          : null;
                        return fp ? (
                          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.15)', borderRadius: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#1d9e75', marginBottom: 8 }}>
                              ✓ VOICE FINGERPRINT ACTIVE — measured from your chapters
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                              <span style={{ color: co.muted }}>Avg sentence</span>
                              <span>{fp.avgSentenceLength.toFixed(1)} words</span>
                              <span style={{ color: co.muted }}>Contractions</span>
                              <span>{(fp.contractionRate * 100).toFixed(1)}%</span>
                              <span style={{ color: co.muted }}>First-person rate</span>
                              <span>{fp.firstPersonRate.toFixed(1)} per 100 words</span>
                              <span style={{ color: co.muted }}>Dialogue ratio</span>
                              <span>{(fp.dialogueRatio * 100).toFixed(0)}%</span>
                              <span style={{ color: co.muted }}>Word diversity</span>
                              <span>{(fp.wordDiversityRatio * 100).toFixed(0)}%</span>
                            </div>
                            <div style={{ fontSize: 10, color: co.muted, marginTop: 6 }}>
                              Updates as you write more chapters. At least 3 chapters needed.
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: co.muted, marginTop: 8 }}>
                            Voice fingerprint inactive — write 3+ chapters to activate constraint-based voice matching.
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Series / Universe linking */}
                  {((project as any).storyType === 'series' || (project as any).storyType === 'universe-story') && (
                    <div style={{ borderTop: `1px solid ${co.border}`, paddingTop: 14, marginTop: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                        {(project as any).storyType === 'series' ? '📚 Series' : '🌌 Universe'}
                      </div>
                      {!seriesDataLoaded && (
                        <button onClick={loadSeriesData} style={{ ...sBtnSm, marginBottom: 10 }}>Load {(project as any).storyType === 'series' ? 'series' : 'universe'} options</button>
                      )}
                      {seriesDataLoaded && (project as any).storyType === 'series' && (
                        <div>
                          <span style={{ fontSize: 10, color: co.muted, display: 'block', marginBottom: 4 }}>Previous Story in Series</span>
                          <select
                            value={(project as any).seriesParentId ?? ''}
                            onChange={async e => {
                              const val = e.target.value || null;
                              await fetch(`/api/projects/${project.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesParentId: val }) });
                              updateProject((p: any) => ({ ...p, seriesParentId: val }));
                            }}
                            style={{ ...sInput, fontSize: 11 }}
                          >
                            <option value="">None (this is the first story)</option>
                            {allProjects.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {seriesDataLoaded && (project as any).storyType === 'universe-story' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 10, color: co.muted, display: 'block', marginBottom: 4 }}>Universe</span>
                            <select
                              value={(project as any).universeId ?? ''}
                              onChange={async e => {
                                const val = e.target.value || null;
                                await fetch(`/api/projects/${project.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ universeId: val }) });
                                updateProject((p: any) => ({ ...p, universeId: val }));
                              }}
                              style={{ ...sInput, fontSize: 11 }}
                            >
                              <option value="">Not part of a universe</option>
                              {allUniverses.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: co.muted, flexShrink: 0 }}>Timeline position:</span>
                            <input
                              type="number"
                              min={1}
                              value={(project as any).timelineSort ?? 1}
                              onChange={async e => {
                                const val = parseInt(e.target.value) || 1;
                                await fetch(`/api/projects/${project.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timelineSort: val }) });
                                updateProject((p: any) => ({ ...p, timelineSort: val }));
                              }}
                              style={{ ...sInput, width: 64, fontSize: 11 }}
                            />
                            <span style={{ fontSize: 10, color: co.muted }}>(1 = first story)</span>
                          </div>
                          {(project as any).universeId && (
                            <a href={`/universe/${(project as any).universeId}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: co.accent, fontWeight: 600 }}>
                              Open Universe Dashboard →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
                    <button style={{ ...sBtn, width: "100%", marginTop: 8, opacity: seriesPlanLoading ? 0.5 : 1 }} disabled={seriesPlanLoading} onClick={async () => {
                      setSeriesPlanLoading(true); setSeriesPlan(null);
                      try {
                        const res = await fetch("/api/ai/series-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorBible, format: project.format, currentProjectId: project.id }) });
                        const data = await res.json();
                        if (data.plan) setSeriesPlan(data.plan);
                      } catch { setErrorMsg("Series plan failed."); }
                      setSeriesPlanLoading(false);
                    }}>
                      {seriesPlanLoading ? "Planning..." : "📅 Series Plan"}
                    </button>
                    {seriesPlan && (
                      <div style={{ marginTop: 10 }}>
                        {seriesPlan.gaps?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>Content Gaps</div>
                            {seriesPlan.gaps.map((g: string, i: number) => <div key={i} style={{ fontSize: 11, color: co.muted, background: co.accentBg, borderRadius: 4, padding: "4px 8px", marginBottom: 3 }}>{g}</div>)}
                          </div>
                        )}
                        {seriesPlan.weeks?.map((week: any) => (
                          <div key={week.week} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 4 }}>Week {week.week}</div>
                            {week.videos?.map((v: any, i: number) => (
                              <div key={i} style={{ background: co.surfaceAlt, borderRadius: 6, padding: "6px 8px", marginBottom: 4, fontSize: 11 }}>
                                <div style={{ fontWeight: 600, color: co.text, marginBottom: 2 }}>{v.title}</div>
                                <div style={{ color: co.muted, fontSize: 10 }}>{v.hook}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
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
                                  {/* 5D Relationship Editor */}
                                  <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div>
                                      <label style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>
                                        Power ({selectedMapEdge.charAName} over {selectedMapEdge.charBName}): {selectedMapEdge.powerDifferential ?? 0}
                                      </label>
                                      <input type="range" min={-5} max={5} value={selectedMapEdge.powerDifferential ?? 0}
                                        onChange={e => patchRelationship(selectedMapEdge.charAId, selectedMapEdge.charBId, { powerDifferential: +e.target.value })}
                                        style={{ width: "100%" }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Emotional register</label>
                                      <select value={selectedMapEdge.emotionalRegister ?? ""} style={{ ...sInput, fontSize: 11 }}
                                        onChange={e => patchRelationship(selectedMapEdge.charAId, selectedMapEdge.charBId, { emotionalRegister: e.target.value })}>
                                        <option value="">— select —</option>
                                        {["warm","cold","volatile","detached","protective","transactional"].map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>
                                        What {selectedMapEdge.charAName} knows that {selectedMapEdge.charBName} doesn't
                                      </label>
                                      <textarea value={selectedMapEdge.knowledgeAsymmetry ?? ""} style={{ ...sTextarea, fontSize: 11, minHeight: 48 }}
                                        onChange={e => patchRelationship(selectedMapEdge.charAId, selectedMapEdge.charBId, { knowledgeAsymmetry: e.target.value })}
                                        placeholder="e.g. She knows he killed her father." />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>{selectedMapEdge.charAName}'s attachment style</label>
                                      <select value={selectedMapEdge.attachmentStyleA ?? ""} style={{ ...sInput, fontSize: 11 }}
                                        onChange={e => patchRelationship(selectedMapEdge.charAId, selectedMapEdge.charBId, { attachmentStyleA: e.target.value })}>
                                        <option value="">— select —</option>
                                        {["secure","anxious","avoidant","disorganized"].map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Arc trajectory</label>
                                      <select value={selectedMapEdge.arcTrajectory ?? ""} style={{ ...sInput, fontSize: 11 }}
                                        onChange={e => patchRelationship(selectedMapEdge.charAId, selectedMapEdge.charBId, { arcTrajectory: e.target.value })}>
                                        <option value="">— select —</option>
                                        {["deepening","fracturing","stabilizing","transforming","ending"].map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    </div>
                                  </div>
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
                        {/* Infer from Chapters button — only when ≥2 chapters have content */}
                        {project.chapters?.filter((c: any) => (c.content || "").length > 100).length >= 2 && (
                          <div style={{ marginBottom: 10 }}>
                            <button
                              style={{ ...sBtnSm, background: "#f0fdf4", color: "#166534", fontWeight: 600, opacity: inferLoading ? 0.5 : 1 }}
                              disabled={inferLoading}
                              onClick={async () => {
                                setInferLoading(true);
                                setInferResult(null);
                                try {
                                  const res = await fetch(`/api/projects/${project.id}/world-bible/infer`, { method: "POST" });
                                  const data = await res.json();
                                  if (data.error) { alert(data.error); }
                                  else {
                                    setInferResult(data);
                                    const sel: Record<string, boolean> = {};
                                    const existingNames = new Set([
                                      ...(project.characters || []).map((c: any) => c.name?.toLowerCase()),
                                      ...(project.locations || []).map((l: any) => l.name?.toLowerCase()),
                                      ...(project.plotThreads || []).map((t: any) => t.name?.toLowerCase()),
                                    ]);
                                    [...(data.characters || []), ...(data.locations || []), ...(data.plotThreads || [])].forEach((item: any, i: number) => {
                                      sel[`item-${i}-${item.name}`] = !existingNames.has(item.name?.toLowerCase());
                                    });
                                    setInferSelected(sel);
                                  }
                                } catch { alert("Inference failed. Try again."); }
                                setInferLoading(false);
                              }}
                            >
                              {inferLoading ? "Analysing chapters..." : "✨ Infer from Chapters"}
                            </button>
                          </div>
                        )}
                        {([["Characters", project.characters, openCharNew, openCharEdit, "characters"], ["Locations", project.locations, openLocNew, openLocEdit, "locations"], ["Plot Threads", project.plotThreads, openPlotNew, openPlotEdit, "plotThreads"]] as [string, any[], () => void, (i: number) => void, string][]).map(([title, items, onNew, onEdit, key]) => (
                          <div key={key} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>{title} ({items.length})</span>
                              <button style={sBtnSm} onClick={onNew}>+ Add</button>
                            </div>
                            {items.length === 0 && key === "characters" && (
                              <EmptyState icon="👤" title="No characters yet"
                                description="Add your first character to start building your World Bible." />
                            )}
                            {items.map((item: any, i: number) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: co.accentBg, borderRadius: 8, padding: "6px 10px", fontSize: 12, margin: "3px 0", cursor: "pointer" }} onClick={() => onEdit(i)}>
                                {item.status && <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.status === "Active" ? co.green : item.status === "Resolved" ? co.muted : co.orange, flexShrink: 0 }} />}
                                <span style={{ flex: 1 }}><strong>{item.name}</strong>{item.role && <span style={{ color: co.muted, fontSize: 11 }}> · {item.role}</span>}</span>
                                <span style={{ fontSize: 10, color: co.accent }}>edit</span>
                                {key === "characters" && item.alwaysInContext !== false && <button title="View character evolution timeline" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, padding: 0, color: co.muted }} onClick={e => { e.stopPropagation(); openEvolution(item); }}>📈</button>}
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
            ) : leftTab === "trends" ? (
              <div>
                {/* Active banner */}
                {trendKeyConnected && trendSetupStep === 0 && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>✓ Trend Intelligence active</span>
                      <div style={{ fontSize: 11, color: "#15803d", marginTop: 2 }}>Your first 2,000 trend searches are on us.</div>
                    </div>
                    <button style={{ fontSize: 11, color: co.muted, background: "none", border: "none", cursor: "pointer" }} onClick={() => setTrendSetupStep(1)}>Update key</button>
                  </div>
                )}
                {/* Platform selector */}
                <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 8 }}>Analyse trends on</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {["YouTube", "Instagram"].map(p => (
                    <button key={p} style={{ ...sBtnSm, background: trendPlatform === p ? co.accentBg : "transparent", color: trendPlatform === p ? co.accent : co.muted, border: "1px solid " + (trendPlatform === p ? co.accent : co.border) }} onClick={() => { setTrendPlatform(p); setTrendResults(null); }}>
                      {p === "YouTube" ? "▶ YouTube" : "📸 Instagram"}
                    </button>
                  ))}
                </div>
                {/* Instagram locked gate */}
                {trendPlatform === "Instagram" && !trendKeyConnected && trendSetupStep === 0 && (
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ filter: "blur(4px)", opacity: 0.4, pointerEvents: "none", padding: 16 }}>
                      <div style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: co.accent, fontWeight: 700 }}>TRENDING NOW</div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>5 fresh angles identified</div>
                        <div style={{ fontSize: 11, color: co.muted, marginTop: 2 }}>"Nobody has taken the 'failure story' angle yet..."</div>
                      </div>
                      <div style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: co.muted }}>Top audio: Kesariya • Tum Hi Ho • Lo-fi study</div>
                      </div>
                    </div>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", borderRadius: 12, padding: 20, textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: co.text, marginBottom: 6 }}>Activate for Instagram Reels</div>
                      <div style={{ fontSize: 12, color: co.muted, marginBottom: 16, maxWidth: 240, lineHeight: 1.5 }}>See exactly what's saturated and which angles nobody has taken yet — live data, updated in real time.</div>
                      <button style={{ ...sBtn, padding: "10px 20px", fontSize: 13 }} onClick={() => setTrendSetupStep(1)}>Activate Trend Intelligence →</button>
                    </div>
                  </div>
                )}
                {/* Setup flow */}
                {trendSetupStep > 0 && (
                  <div style={{ background: co.surface, border: "1px solid " + co.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Activate Trend Intelligence</div>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 16, lineHeight: 1.5 }}>Connect your free personal data key. Takes 60 seconds. Set up once, use forever.</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                      {[1, 2, 3].map(step => (
                        <div key={step} style={{ flex: 1, height: 3, borderRadius: 2, background: trendSetupStep >= step ? co.accent : co.border, transition: "background 0.2s" }} />
                      ))}
                    </div>
                    {trendSetupStep === 1 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 8 }}>Step 1 of 3 — Create your free account</div>
                        <div style={{ fontSize: 11, color: co.muted, marginBottom: 12, lineHeight: 1.6 }}>Click below to create a free account on our data partner's platform. No credit card required. Your first 2,000 trend searches are completely free.</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <a href="https://console.apify.com/sign-up" target="_blank" rel="noopener noreferrer" style={{ ...sBtn, textDecoration: "none", display: "inline-block" }}>Create free account →</a>
                          <button style={sBtnSm} onClick={() => setTrendSetupStep(2)}>Already have one</button>
                        </div>
                        <button style={{ fontSize: 11, color: co.muted, background: "none", border: "none", cursor: "pointer" }} onClick={() => setTrendSetupStep(2)}>Skip — I've done this</button>
                      </div>
                    )}
                    {trendSetupStep === 2 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 8 }}>Step 2 of 3 — Get your personal key</div>
                        <div style={{ fontSize: 11, color: co.muted, marginBottom: 10, lineHeight: 1.6 }}>Once logged in, go to:</div>
                        <div style={{ background: co.surfaceAlt, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontFamily: "monospace", fontSize: 11 }}>Settings → Integrations → API Tokens → Create new token</div>
                        <div style={{ fontSize: 11, color: co.muted, marginBottom: 12 }}>Name it anything (e.g. "GhostWriter"), copy the token, and come back here.</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" style={{ ...sBtnSm, textDecoration: "none", display: "inline-block" }}>Open settings →</a>
                          <button style={sBtn} onClick={() => setTrendSetupStep(3)}>I've got my key →</button>
                        </div>
                      </div>
                    )}
                    {trendSetupStep === 3 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 8 }}>Step 3 of 3 — Connect it</div>
                        <div style={{ fontSize: 11, color: co.muted, marginBottom: 10 }}>Paste your personal data key below:</div>
                        <input type="password" value={trendKeyInput} onChange={e => setTrendKeyInput(e.target.value)} placeholder="apify_api_..." style={{ ...sInput, width: "100%", marginBottom: 10, boxSizing: "border-box" as any }} />
                        <button style={{ ...sBtn, width: "100%", opacity: savingTrendKey || !trendKeyInput.trim() ? 0.5 : 1 }} disabled={savingTrendKey || !trendKeyInput.trim()} onClick={async () => {
                          setSavingTrendKey(true);
                          try {
                            const res = await fetch("/api/user/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trendIntelligenceKey: trendKeyInput.trim() }) });
                            if (res.ok) { setTrendKeyConnected(true); setTrendSetupStep(0); setTrendKeyInput(""); }
                            else setErrorMsg("Failed to save key. Please try again.");
                          } catch { setErrorMsg("Failed to save key. Please check your connection."); }
                          finally { setSavingTrendKey(false); }
                        }}>{savingTrendKey ? "Connecting..." : "Activate Trend Intelligence"}</button>
                        <div style={{ fontSize: 10, color: co.muted, marginTop: 8, textAlign: "center" }}>Your key is encrypted and stored securely. We never share it.</div>
                      </div>
                    )}
                  </div>
                )}
                {/* Search bar */}
                {(trendPlatform === "YouTube" || (trendPlatform === "Instagram" && trendKeyConnected)) && trendSetupStep === 0 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <input style={{ ...sInput, flex: 1 }} value={trendKeyword} onChange={e => setTrendKeyword(e.target.value)} placeholder={trendPlatform === "YouTube" ? "e.g. morning routine, productivity..." : "e.g. skincare routine, budget travel..."} onKeyDown={e => e.key === "Enter" && !trendLoading && runTrendSearch()} />
                    <button style={{ ...sBtn, opacity: trendLoading || !trendKeyword.trim() ? 0.5 : 1 }} disabled={trendLoading || !trendKeyword.trim()} onClick={runTrendSearch}>{trendLoading ? "Analysing..." : "Analyse"}</button>
                  </div>
                )}
                {/* Results */}
                {trendResults && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", background: co.surfaceAlt, borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: co.accent }}>{trendResults.fitScore}/10</div>
                      <div style={{ fontSize: 12, color: co.muted }}>{trendResults.fitReason}</div>
                    </div>
                    {trendResults.saturatedAngles?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginBottom: 6 }}>Saturated — everyone is doing this</div>
                        {trendResults.saturatedAngles.map((a: string, i: number) => (
                          <div key={i} style={{ fontSize: 12, color: co.muted, padding: "4px 0", borderBottom: "1px solid " + co.border }}>{a}</div>
                        ))}
                      </div>
                    )}
                    {trendResults.freshAngles?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 8 }}>Fresh angles nobody has taken</div>
                        {trendResults.freshAngles.map((a: any, i: number) => (
                          <div key={i} style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{a.angle}</div>
                            <div style={{ fontSize: 11, color: co.accent, fontStyle: "italic", marginBottom: 6 }}>Hook: "{a.hook}"</div>
                            <div style={{ fontSize: 11, color: co.muted, marginBottom: a.trendingAudio ? 6 : 0 }}>{a.why}</div>
                            {a.trendingAudio && <div style={{ fontSize: 11, color: co.muted }}>Audio: {a.trendingAudio}</div>}
                            <button style={{ ...sBtnSm, marginTop: 8, fontSize: 11 }} onClick={() => { setPrompt(a.hook); setMode("write"); }}>Write this angle</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {trendPlatform === "Instagram" && trendResults.topAudio?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 6 }}>Trending audio right now</div>
                        {trendResults.topAudio.map((a: string, i: number) => <div key={i} style={{ fontSize: 12, padding: "3px 0" }}>• {a}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                  {newChar.soulId ? (
                    <div style={{ fontSize: 10, color: "#166534", background: "#DCFCE7", padding: "2px 6px", borderRadius: 4, marginTop: 4, display: "inline-block" }}>
                      ✓ Soul ID trained — consistent panels
                    </div>
                  ) : newChar.portraitUrl && newChar.id ? (
                    <button onClick={() => openSoulIdModal(newChar.id)} style={{ fontSize: 11, color: "#4F46E5", background: "none", border: "1px solid #4F46E5", borderRadius: 4, padding: "3px 8px", cursor: "pointer", marginTop: 4, display: "block" }}>
                      Train Soul ID for panel consistency
                    </button>
                  ) : null}
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
            {mi === 0 && isStoryFormat(project.format) && (
              <div style={{ marginBottom: 8, padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 6 }}>VISUAL PROFILE</div>
                {data.visualProfile ? (
                  <div style={{ fontSize: 11, color: "#166534", marginBottom: 6, lineHeight: 1.5, fontStyle: "italic" }}>{data.visualProfile}</div>
                ) : null}
                <button
                  style={{ ...sBtnSm, background: "#dcfce7", color: "#166534", opacity: (visualProfileLoading || !data.appearance) ? 0.5 : 1 }}
                  disabled={visualProfileLoading || !data.appearance}
                  onClick={async () => {
                    setVisualProfileLoading(true);
                    try {
                      const r = await callAI("entity", { type: "visual_profile", name: data.name, role: data.role, appearance: data.appearance });
                      if (r.visualProfile) setNewChar((c: any) => ({ ...c, visualProfile: r.visualProfile }));
                    } catch { setErrorMsg("Visual profile generation failed."); }
                    setVisualProfileLoading(false);
                  }}
                >
                  {visualProfileLoading ? "Generating..." : data.visualProfile ? "Regenerate Visual Profile" : "Generate Visual Profile"}
                </button>
                {!data.appearance && <div style={{ fontSize: 10, color: "#166534", marginTop: 4, opacity: 0.7 }}>Add appearance description first</div>}
              </div>
            )}
            {mi === 0 && isStoryFormat(project.format) && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 4, fontWeight: 600 }}>Voice Profile <span style={{ fontWeight: 400, opacity: 0.7 }}>(Labov/Mairesse — optional)</span></div>
                <select
                  style={{ ...sInput }}
                  value={data.voiceProfile || ""}
                  onChange={e => setNewChar((c: any) => ({ ...c, voiceProfile: e.target.value }))}
                >
                  <option value="">No voice profile</option>
                  <option value="Vocabulary Register">Vocabulary Register</option>
                  <option value="Syntactic Fingerprint">Syntactic Fingerprint</option>
                  <option value="Personality-Language">Personality-Language</option>
                  <option value="Emotional Degradation">Emotional Degradation</option>
                  <option value="Prosodic Rhythm">Prosodic Rhythm</option>
                </select>
                <div style={{ fontSize: 10, color: co.muted, marginTop: 3 }}>Injected into AI context when generating dialogue or voice scenes for this character</div>
              </div>
            )}
            {mi === 0 && isStoryFormat(project.format) && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 4, fontWeight: 600 }}>TTS Voice <span style={{ fontWeight: 400, opacity: 0.7 }}>(Audio Novel — optional)</span></div>
                <select
                  style={{ ...sInput }}
                  value={data.voiceId || ""}
                  onChange={e => setNewChar((c: any) => ({ ...c, voiceId: e.target.value }))}
                >
                  <option value="">No voice assigned</option>
                  <option value="alloy">Alloy — neutral, balanced</option>
                  <option value="echo">Echo — warm, conversational</option>
                  <option value="fable">Fable — expressive, storytelling</option>
                  <option value="onyx">Onyx — deep, authoritative</option>
                  <option value="nova">Nova — bright, energetic</option>
                  <option value="shimmer">Shimmer — clear, precise</option>
                </select>
                <div style={{ fontSize: 10, color: co.muted, marginTop: 3 }}>Used when generating Audio Novel exports for this character's dialogue</div>
              </div>
            )}
            {mi === 0 && isStoryFormat(project.format) && (
              <div>
              {/* Structural Function */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 4, fontWeight: 600 }}>Structural Function <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></div>
                <select
                  style={{ ...sInput }}
                  value={data.structuralFunction || ""}
                  onChange={e => setNewChar((c: any) => ({ ...c, structuralFunction: e.target.value }))}
                >
                  <option value="">No structural function</option>
                  <option value="Mirror">Mirror — reflects protagonist's values back</option>
                  <option value="Foil">Foil — shares context, makes opposite choices</option>
                  <option value="Mentor">Mentor / Threshold Guardian</option>
                  <option value="Herald">Herald — announces change</option>
                  <option value="Trickster">Trickster — destabilises assumptions</option>
                  <option value="Shadow">Shadow — embodies what protagonist fears becoming</option>
                  <option value="Catalyst">Catalyst — transforms others, no arc of their own</option>
                </select>
              </div>

              {/* Voice Profile (Labov/Pennebaker) */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 4, fontWeight: 600 }}>Voice Register <span style={{ fontWeight: 400, opacity: 0.7 }}>(Labov — optional)</span></div>
                <select style={{ ...sInput, marginBottom: 6 }} value={data.voiceRegister || ""} onChange={e => setNewChar((c: any) => ({ ...c, voiceRegister: e.target.value }))}>
                  <option value="">No register</option>
                  <option value="Formal">Formal</option>
                  <option value="Casual">Casual</option>
                  <option value="Regional">Regional</option>
                  <option value="Institutional">Institutional</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 4, fontWeight: 600 }}>Voice Compression <span style={{ fontWeight: 400, opacity: 0.7 }}>(Pennebaker)</span></div>
                <select style={{ ...sInput, marginBottom: 6 }} value={data.voiceCompression || ""} onChange={e => setNewChar((c: any) => ({ ...c, voiceCompression: e.target.value }))}>
                  <option value="">No compression</option>
                  <option value="Verbose">Verbose</option>
                  <option value="Balanced">Balanced</option>
                  <option value="Terse">Terse</option>
                  <option value="Fragments">Fragments</option>
                </select>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 4, fontWeight: 600 }}>Verbal Tic <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></div>
                <select style={{ ...sInput }} value={data.verbalTic || ""} onChange={e => setNewChar((c: any) => ({ ...c, verbalTic: e.target.value }))}>
                  <option value="">None</option>
                  <option value="Deflects-with-humor">Deflects-with-humor</option>
                  <option value="Asks-instead-of-asserts">Asks-instead-of-asserts</option>
                  <option value="Profession-metaphors">Profession-metaphors</option>
                  <option value="Qualifies-everything">Qualifies-everything</option>
                </select>
              </div>

              {/* Villain Profile */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid " + co.border }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: co.text, cursor: "pointer", marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={data.antagonistToggle || false}
                    onChange={e => setNewChar((c: any) => ({ ...c, antagonistToggle: e.target.checked }))}
                  />
                  This character believes they are the hero of this story
                </label>
                {data.antagonistToggle && (
                  <div>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 4, fontWeight: 600 }}>Antagonist Type</div>
                    <select
                      style={{ ...sInput }}
                      value={data.antagonistType || ""}
                      onChange={e => setNewChar((c: any) => ({ ...c, antagonistType: e.target.value }))}
                    >
                      <option value="">Select type</option>
                      <option value="Narcissist">Narcissist — grandiosity, entitlement, needs to be witnessed</option>
                      <option value="Machiavellian">Machiavellian — calculated self-interest, patient, strategic</option>
                      <option value="Psychopath">Psychopath — impulsive, low anxiety, absent fear of consequences</option>
                      <option value="Ideological">Ideological — acting from conviction, believes harm is justified</option>
                      <option value="Systemic">Systemic — the system is the villain, no single face</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ── NVC CARD ─────────────────────────────────────────── */}
              <details style={{ marginTop: 16, borderTop: "1px solid " + co.border, paddingTop: 14 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: co.accent, cursor: "pointer", userSelect: "none", marginBottom: 10, listStyle: "none" }}>
                  ▶ NVC Profile (Non-Verbal Communication)
                </summary>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <details open={false}>
                    <summary style={{ fontSize: 11, fontWeight: 700, color: co.muted, cursor: "pointer", userSelect: "none" }}>Kinesics</summary>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Baseline (posture, gesture density, expressiveness)</span><textarea style={sTextarea} rows={2} value={data.kinesicsBaseline || ""} onChange={(e: any) => setData((d: any) => ({ ...d, kinesicsBaseline: e.target.value }))} placeholder="slight forward lean, medium gesture density, expressive face..." /></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Microexpression map (what emotions they suppress + the leakage)</span><textarea style={sTextarea} rows={2} value={data.kinesicsMicro || ""} onChange={(e: any) => setData((d: any) => ({ ...d, kinesicsMicro: e.target.value }))} placeholder="suppresses grief → eyelid droop + inner brow raise..." /></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Signature physical habit (idiosyncratic)</span><input style={sInput} value={data.kinesicsIdiosyncrasy || ""} onChange={(e: any) => setData((d: any) => ({ ...d, kinesicsIdiosyncrasy: e.target.value }))} placeholder="touches nose when lying; hand moves to hip where weapon was..." /></div>
                    </div>
                  </details>
                  <details open={false}>
                    <summary style={{ fontSize: 11, fontWeight: 700, color: co.muted, cursor: "pointer", userSelect: "none" }}>Proxemics & Haptics</summary>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Proxemics culture</span><select style={sInput} value={data.proxemicsCulture || ""} onChange={(e: any) => setData((d: any) => ({ ...d, proxemicsCulture: e.target.value }))}><option value="">Not set</option><option value="contact">Contact</option><option value="non-contact">Non-contact</option><option value="mixed">Mixed</option></select></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>When intimate zone is breached</span><select style={sInput} value={data.proxemicsViolationResponse || ""} onChange={(e: any) => setData((d: any) => ({ ...d, proxemicsViolationResponse: e.target.value }))}><option value="">Not set</option><option value="freeze">Freeze</option><option value="retreat">Retreat</option><option value="reciprocate">Reciprocate</option><option value="confront">Confront</option></select></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Touch level</span><select style={sInput} value={data.hapticsTouchLevel || ""} onChange={(e: any) => setData((d: any) => ({ ...d, hapticsTouchLevel: e.target.value }))}><option value="">Not set</option><option value="averse">Averse</option><option value="reserved">Reserved</option><option value="normal">Normal</option><option value="initiating">Initiating</option></select></div>
                    </div>
                  </details>
                  <details open={false}>
                    <summary style={{ fontSize: 11, fontWeight: 700, color: co.muted, cursor: "pointer", userSelect: "none" }}>Voice (Paralanguage)</summary>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Baseline voice (pitch, rate, rhythm)</span><textarea style={sTextarea} rows={2} value={data.paralanguageBaseline || ""} onChange={(e: any) => setData((d: any) => ({ ...d, paralanguageBaseline: e.target.value }))} placeholder="low pitch, slow deliberate rate, smooth rhythm..." /></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Under stress, voice becomes</span><textarea style={sTextarea} rows={2} value={data.paralanguageStressDegradation || ""} onChange={(e: any) => setData((d: any) => ({ ...d, paralanguageStressDegradation: e.target.value }))} placeholder="pitch rises, rate accelerates, fillers multiply..." /></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Signature vocal marker</span><input style={sInput} value={data.paralanguageSignatureSound || ""} onChange={(e: any) => setData((d: any) => ({ ...d, paralanguageSignatureSound: e.target.value }))} placeholder="laugh that starts silent then arrives..." /></div>
                    </div>
                  </details>
                  <details open={false}>
                    <summary style={{ fontSize: 11, fontWeight: 700, color: co.muted, cursor: "pointer", userSelect: "none" }}>Environment (Time, Eyes, Objects)</summary>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Chronemics</span><select style={sInput} value={data.chronemicsTimeType || ""} onChange={(e: any) => setData((d: any) => ({ ...d, chronemicsTimeType: e.target.value }))}><option value="">Not set</option><option value="monochronic">Monochronic (punctuality = moral weight)</option><option value="polychronic">Polychronic (time is relational)</option></select></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Default eye contact</span><select style={sInput} value={data.oculesicsDefault || ""} onChange={(e: any) => setData((d: any) => ({ ...d, oculesicsDefault: e.target.value }))}><option value="">Not set</option><option value="avoidant">Avoidant</option><option value="normal">Normal</option><option value="sustained">Sustained</option><option value="intense">Intense</option></select></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>When hiding something, eyes</span><input style={sInput} value={data.oculesicsDeception || ""} onChange={(e: any) => setData((d: any) => ({ ...d, oculesicsDeception: e.target.value }))} placeholder="hold contact too long, never blinking..." /></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Signature object (always carries)</span><input style={sInput} value={data.objecticsSignature || ""} onChange={(e: any) => setData((d: any) => ({ ...d, objecticsSignature: e.target.value }))} placeholder="worn watch, notebook, specific lighter..." /></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Appearance signature (always present)</span><input style={sInput} value={data.appearanceSignature || ""} onChange={(e: any) => setData((d: any) => ({ ...d, appearanceSignature: e.target.value }))} placeholder="one specific color, never bare-handed..." /></div>
                      <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Appearance trajectory</span><select style={sInput} value={data.appearanceTrajectory || ""} onChange={(e: any) => setData((d: any) => ({ ...d, appearanceTrajectory: e.target.value }))}><option value="">Not set</option><option value="meticulous">Meticulous</option><option value="average">Average</option><option value="minimal">Minimal</option><option value="deteriorating">Deteriorating (signals breakdown)</option></select></div>
                    </div>
                  </details>
                </div>
              </details>

              {/* ── LANGUAGE PROFILE ─────────────────────────────────── */}
              <details style={{ marginTop: 12, borderTop: "1px solid " + co.border, paddingTop: 12 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: co.accent, cursor: "pointer", userSelect: "none", marginBottom: 10, listStyle: "none" }}>
                  ▶ Language & Voice Profile
                </summary>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Native language</span><input style={sInput} value={data.nativeLanguage || ""} onChange={(e: any) => setData((d: any) => ({ ...d, nativeLanguage: e.target.value }))} placeholder="Hindi, English, Cantonese..." /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Acquired languages (with proficiency)</span><input style={sInput} value={data.acquiredLanguages || ""} onChange={(e: any) => setData((d: any) => ({ ...d, acquiredLanguages: e.target.value }))} placeholder="Mandarin (native), English (fluent), French (survival)" /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Accent / dialect profile</span><input style={sInput} value={data.accentProfile || ""} onChange={(e: any) => setData((d: any) => ({ ...d, accentProfile: e.target.value }))} placeholder="South London working class, heavily suppressed at work" /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Reversion trigger (when native accent/dialect surfaces)</span><input style={sInput} value={data.reversionTrigger || ""} onChange={(e: any) => setData((d: any) => ({ ...d, reversionTrigger: e.target.value }))} placeholder="extreme stress, alcohol, anger..." /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Default register</span><select style={sInput} value={data.registerDefault || ""} onChange={(e: any) => setData((d: any) => ({ ...d, registerDefault: e.target.value }))}><option value="">Not set</option><option value="frozen">Frozen / Ceremonial</option><option value="formal">Formal</option><option value="consultative">Consultative</option><option value="casual">Casual</option><option value="intimate">Intimate</option></select></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Register range</span><select style={sInput} value={data.registerRange || ""} onChange={(e: any) => setData((d: any) => ({ ...d, registerRange: e.target.value }))}><option value="">Not set</option><option value="narrow">Narrow (same in all contexts)</option><option value="moderate">Moderate</option><option value="wide">Wide (switches fluidly)</option></select></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Code-switching triggers</span><input style={sInput} value={data.codeSwitchingTriggers || ""} onChange={(e: any) => setData((d: any) => ({ ...d, codeSwitchingTriggers: e.target.value }))} placeholder="shifts to formal at work, intimate with family..." /></div>
                  <div>
                    <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Voice fingerprint (idiolect) — the most important field</span>
                    <textarea style={{ ...sTextarea, minHeight: 80 }} rows={4} value={data.idiolectFingerprint || ""} onChange={(e: any) => setData((d: any) => ({ ...d, idiolectFingerprint: e.target.value }))} placeholder={'Latinate vocabulary, long subordinate clauses, hedges everything with qualifications... Blind test: cover the attribution tag — reader must identify who is speaking.'} />
                  </div>
                </div>
              </details>

              {/* ── FLAW & DEPTH ─────────────────────────────────────── */}
              <details style={{ marginTop: 12, borderTop: "1px solid " + co.border, paddingTop: 12 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: co.accent, cursor: "pointer", userSelect: "none", marginBottom: 10, listStyle: "none" }}>
                  ▶ Flaw & Psychological Depth
                </summary>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Root wound (the event/absence that formed this character)</span><textarea style={sTextarea} rows={2} value={data.rootWound || ""} onChange={(e: any) => setData((d: any) => ({ ...d, rootWound: e.target.value }))} placeholder="What happened (or didn't happen) that built this personality?" /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Hamartia — fatal flaw</span><input style={sInput} value={data.hamartia || ""} onChange={(e: any) => setData((d: any) => ({ ...d, hamartia: e.target.value }))} placeholder="pride, inability to ask for help, compulsive dishonesty..." /></div>
                  <div>
                    <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Significant flaws (add one per line, Enter to add)</span>
                    {(data.significantFlaws || []).map((f: string, fi: number) => (
                      <div key={fi} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                        <input style={{ ...sInput, flex: 1 }} value={f} onChange={(e: any) => { const arr = [...(data.significantFlaws || [])]; arr[fi] = e.target.value; setData((d: any) => ({ ...d, significantFlaws: arr })); }} />
                        <button style={{ background: "none", border: "none", color: co.danger, cursor: "pointer", fontSize: 14, padding: "0 4px" }} onClick={() => { const arr = (data.significantFlaws || []).filter((_: any, i: number) => i !== fi); setData((d: any) => ({ ...d, significantFlaws: arr })); }}>×</button>
                      </div>
                    ))}
                    <button style={{ ...sBtnSm, marginTop: 4 }} onClick={() => setData((d: any) => ({ ...d, significantFlaws: [...(d.significantFlaws || []), ""] }))}>+ Add Flaw</button>
                  </div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Cognitive bias</span><select style={sInput} value={data.cognitiveBias || ""} onChange={(e: any) => setData((d: any) => ({ ...d, cognitiveBias: e.target.value }))}><option value="">None</option><option value="confirmation_bias">Confirmation Bias</option><option value="fundamental_attribution_error">Fundamental Attribution Error</option><option value="sunk_cost_fallacy">Sunk Cost Fallacy</option><option value="dunning_kruger">Dunning-Kruger</option><option value="in_group_bias">In-Group Bias</option></select></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Blind spot (what they cannot see about themselves)</span><textarea style={sTextarea} rows={2} value={data.blindSpot || ""} onChange={(e: any) => setData((d: any) => ({ ...d, blindSpot: e.target.value }))} placeholder="Reader sees it; other characters may see it; they cannot." /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Strength branch (same root as flaw)</span><textarea style={sTextarea} rows={2} value={data.strengthBranch || ""} onChange={(e: any) => setData((d: any) => ({ ...d, strengthBranch: e.target.value }))} placeholder="What did the root wound make them excellent at?" /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Compensation mode</span><select style={sInput} value={data.compensationMode || ""} onChange={(e: any) => setData((d: any) => ({ ...d, compensationMode: e.target.value }))}><option value="">Not set</option><option value="positive">Positive</option><option value="overcompensation">Overcompensation</option><option value="undercompensation">Undercompensation</option></select></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Compensation behavior + trigger</span><input style={sInput} value={data.compensationBehavior || ""} onChange={(e: any) => setData((d: any) => ({ ...d, compensationBehavior: e.target.value }))} placeholder="what they do to manage the flaw..." /></div>
                  <div><span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Flaw arc</span><select style={sInput} value={data.flawArcMode || ""} onChange={(e: any) => setData((d: any) => ({ ...d, flawArcMode: e.target.value }))}><option value="">Not set</option><option value="overcome">Overcome (transformation, at cost)</option><option value="fail">Fail (tragedy — the flaw wins)</option><option value="compensate">Compensate (builds systems around it)</option><option value="accept">Accept (makes peace without resolving)</option></select></div>
                </div>
              </details>

              {/* ── SKILL CARD ───────────────────────────────────────── */}
              <details style={{ marginTop: 12, borderTop: "1px solid " + co.border, paddingTop: 12 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: co.accent, cursor: "pointer", userSelect: "none", marginBottom: 10, listStyle: "none" }}>
                  ▶ Skills
                </summary>
                <div style={{ marginTop: 10 }}>
                  {(data.skills || []).map((skill: any, si: number) => {
                    const SKILL_COLORS: Record<string, string> = { physical: "#f97316", cognitive: "#3b82f6", social: "#ec4899", perceptual: "#14b8a6", creative: "#a855f7", survival: "#22c55e", latent: "#6b7280" };
                    return (
                      <div key={si} style={{ background: co.surfaceAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 8, border: "1px solid " + co.border }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                          <input style={{ ...sInput, flex: 2 }} value={skill.name || ""} onChange={(e: any) => { const arr = [...(data.skills || [])]; arr[si] = { ...arr[si], name: e.target.value }; setData((d: any) => ({ ...d, skills: arr })); }} placeholder="Skill name" />
                          <select style={{ ...sInput, flex: 1 }} value={skill.category || "physical"} onChange={(e: any) => { const arr = [...(data.skills || [])]; arr[si] = { ...arr[si], category: e.target.value }; setData((d: any) => ({ ...d, skills: arr })); }}>
                            {["physical", "cognitive", "social", "perceptual", "creative", "survival", "latent"].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <button style={{ background: "none", border: "none", color: co.danger, cursor: "pointer", fontSize: 14 }} onClick={() => { const arr = (data.skills || []).filter((_: any, i: number) => i !== si); setData((d: any) => ({ ...d, skills: arr })); }}>×</button>
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 10, color: co.muted, marginRight: 4 }}>Level</span>
                          {[1, 2, 3, 4, 5].map(lvl => (
                            <button key={lvl} onClick={() => { const arr = [...(data.skills || [])]; arr[si] = { ...arr[si], level: lvl }; setData((d: any) => ({ ...d, skills: arr })); }}
                              style={{ width: 16, height: 16, borderRadius: "50%", border: "none", cursor: "pointer", background: (skill.level || 1) >= lvl ? (SKILL_COLORS[skill.category || "physical"] || co.accent) : co.border }}>
                            </button>
                          ))}
                          <span style={{ fontSize: 10, color: co.muted, marginLeft: 4 }}>{["", "Novice", "Apprentice", "Competent", "Expert", "Master"][skill.level || 1]}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select style={{ ...sInput, flex: 1, fontSize: 10 }} value={skill.acquisitionPath || "deliberate_practice"} onChange={(e: any) => { const arr = [...(data.skills || [])]; arr[si] = { ...arr[si], acquisitionPath: e.target.value }; setData((d: any) => ({ ...d, skills: arr })); }}>
                            <option value="deliberate_practice">Deliberate practice</option>
                            <option value="trial_by_fire">Trial by fire</option>
                            <option value="mentorship">Mentorship</option>
                            <option value="observation">Observation</option>
                            <option value="incidental">Incidental</option>
                          </select>
                          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: co.muted, cursor: "pointer" }}>
                            <input type="checkbox" checked={skill.traumaLinked || false} onChange={(e: any) => { const arr = [...(data.skills || [])]; arr[si] = { ...arr[si], traumaLinked: e.target.checked }; setData((d: any) => ({ ...d, skills: arr })); }} />
                            Trauma-linked
                          </label>
                        </div>
                        {skill.traumaLinked && <input style={{ ...sInput, marginTop: 6, fontSize: 10 }} value={skill.traumaTrigger || ""} onChange={(e: any) => { const arr = [...(data.skills || [])]; arr[si] = { ...arr[si], traumaTrigger: e.target.value }; setData((d: any) => ({ ...d, skills: arr })); }} placeholder="Trauma trigger..." />}
                      </div>
                    );
                  })}
                  <button style={{ ...sBtnSm, width: "100%" }} onClick={() => setData((d: any) => ({ ...d, skills: [...(d.skills || []), { name: "", category: "physical", level: 1, acquisitionPath: "deliberate_practice", traumaLinked: false, notes: "" }] }))}>+ Add Skill</button>
                </div>
              </details>

              {/* ── WORLD KNOWLEDGE MATRIX ────────────────────────────── */}
              <details style={{ marginTop: 12, borderTop: "1px solid " + co.border, paddingTop: 12 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: co.accent, cursor: "pointer", userSelect: "none", marginBottom: 10, listStyle: "none" }}>
                  ▶ World Knowledge
                </summary>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>
                    What {data.name || "this character"} knows, believes, suspects, or is hiding.
                    The AI uses this to prevent acting on information they don't have.
                  </div>

                  {/* Existing knowledge entries */}
                  {Object.entries(data.knowledgeMap || {}).map(([entryId, entry]: [string, any]) => {
                    const stateColors: Record<string, string> = {
                      KNOWS: "#22c55e", BELIEVES: "#3b82f6", SUSPECTS: "#f59e0b",
                      IGNORANT: "#6b7280", FALSELY_BELIEVES: "#f97316", ACTIVELY_HIDING: "#ef4444",
                    };
                    return (
                      <div key={entryId} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "6px 8px", background: co.surfaceAlt, borderRadius: 6 }}>
                        <span style={{ padding: "2px 6px", borderRadius: 10, fontSize: 9, fontWeight: 700, flexShrink: 0, background: (stateColors[entry.state] || "#888") + "22", color: stateColors[entry.state] || "#888" }}>
                          {(entry.state || "").replace("_", " ")}
                        </span>
                        <span style={{ fontSize: 11, color: co.text, flex: 1 }}>{entry.entityName}</span>
                        {entry.belief && <span style={{ fontSize: 10, color: co.muted, fontStyle: "italic" }}>"{entry.belief}"</span>}
                        <button
                          onClick={() => {
                            const km = { ...(data.knowledgeMap || {}) };
                            delete km[entryId];
                            setData((d: any) => ({ ...d, knowledgeMap: km }));
                          }}
                          style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    );
                  })}

                  {/* Add new knowledge entry */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px", background: co.surfaceAlt, borderRadius: 8, marginTop: 4 }}>
                    <select style={{ ...sInput, fontSize: 11 }} value={kmState} onChange={e => setKmState(e.target.value)}>
                      {["KNOWS","BELIEVES","SUSPECTS","IGNORANT","FALSELY_BELIEVES","ACTIVELY_HIDING"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                    <input style={{ ...sInput, fontSize: 11 }} value={kmEntity} onChange={e => setKmEntity(e.target.value)} placeholder="Entity name (character, location, plot thread)..." />
                    {kmState === "FALSELY_BELIEVES" && (
                      <input style={{ ...sInput, fontSize: 11 }} value={kmBelief} onChange={e => setKmBelief(e.target.value)} placeholder='The false belief (e.g. "He thinks she betrayed him")...' />
                    )}
                    <button style={sBtnSm} onClick={() => {
                      if (!kmEntity.trim()) return;
                      const id = crypto.randomUUID();
                      const entry: any = { state: kmState, entityType: "character", entityName: kmEntity.trim() };
                      if (kmState === "FALSELY_BELIEVES" && kmBelief.trim()) entry.belief = kmBelief.trim();
                      setData((d: any) => ({ ...d, knowledgeMap: { ...(d.knowledgeMap || {}), [id]: entry } }));
                      setKmEntity(""); setKmBelief("");
                    }}>+ Add Knowledge Entry</button>
                  </div>

                  {/* Intelligence Profile */}
                  <div style={{ marginTop: 8, borderTop: "1px solid " + co.border, paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: co.text, marginBottom: 6 }}>Intelligence Profile</div>
                    <div style={{ fontSize: 10, color: co.muted, marginBottom: 4 }}>Dominant types</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {(["logical","linguistic","spatial","kinesthetic","interpersonal","intrapersonal","practical"] as const).map(t => {
                        const ip = data.intelligenceProfile || {};
                        const isDom = (ip.dominant || []).includes(t);
                        return (
                          <button key={t} onClick={() => {
                            const ip = data.intelligenceProfile || { dominant: [], weak: [] };
                            const dom = isDom ? ip.dominant.filter((x: string) => x !== t) : [...(ip.dominant || []), t];
                            setData((d: any) => ({ ...d, intelligenceProfile: { ...ip, dominant: dom } }));
                          }}
                            style={{ padding: "3px 8px", borderRadius: 20, fontSize: 10, cursor: "pointer", border: "1px solid", borderColor: isDom ? co.accent : "rgba(255,255,255,0.1)", background: isDom ? co.accentBg : "transparent", color: isDom ? co.accent : co.muted }}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: co.muted, marginBottom: 4 }}>Weak types (errors here are realistic)</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(["logical","linguistic","spatial","kinesthetic","interpersonal","intrapersonal","practical"] as const).map(t => {
                        const ip = data.intelligenceProfile || {};
                        const isWeak = (ip.weak || []).includes(t);
                        return (
                          <button key={t} onClick={() => {
                            const ip = data.intelligenceProfile || { dominant: [], weak: [] };
                            const wk = isWeak ? ip.weak.filter((x: string) => x !== t) : [...(ip.weak || []), t];
                            setData((d: any) => ({ ...d, intelligenceProfile: { ...ip, weak: wk } }));
                          }}
                            style={{ padding: "3px 8px", borderRadius: 20, fontSize: 10, cursor: "pointer", border: "1px solid", borderColor: isWeak ? "#ef4444" : "rgba(255,255,255,0.1)", background: isWeak ? "rgba(239,68,68,0.1)" : "transparent", color: isWeak ? "#ef4444" : co.muted }}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cultural worldview */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: co.text, marginBottom: 4 }}>Cultural Worldview</div>
                    <textarea style={{ ...sTextarea, fontSize: 11 }} rows={3} value={data.culturalWorldview || ""}
                      onChange={(e: any) => setData((d: any) => ({ ...d, culturalWorldview: e.target.value }))}
                      placeholder="How does this character's background shape HOW they think? e.g. 'Grew up in a caste society. Assumes hierarchy is natural. Interprets resistance as personal offense.'" />
                  </div>
                </div>
              </details>

              {/* ── STORY ENGINE ──────────────────────────────────────── */}
              <details style={{ marginTop: 12, borderTop: "1px solid " + co.border, paddingTop: 12 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: co.accent, cursor: "pointer", userSelect: "none", marginBottom: 10, listStyle: "none" }}>
                  ▶ Story Engine
                </summary>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>
                    Want drives plot. Need drives theme. They must oppose each other.
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>What they WANT</span>
                    <input style={sInput} value={data.characterWant || ""} onChange={(e: any) => setData((d: any) => ({ ...d, characterWant: e.target.value }))} placeholder="External goal they consciously pursue. Plot engine." />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>What they NEED</span>
                    <input style={sInput} value={data.characterNeed || ""} onChange={(e: any) => setData((d: any) => ({ ...d, characterNeed: e.target.value }))} placeholder="Internal truth they unconsciously resist. Theme engine." />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Core Contradiction</span>
                    <input style={sInput} value={data.contradiction || ""} onChange={(e: any) => setData((d: any) => ({ ...d, contradiction: e.target.value }))} placeholder="e.g. 'Wants control but is helpless against tenderness'" />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>Narrator Blind Spot</span>
                    <textarea style={{ ...sTextarea, fontSize: 11 }} rows={2} value={data.narratorBlindSpot || ""} onChange={(e: any) => setData((d: any) => ({ ...d, narratorBlindSpot: e.target.value }))} placeholder="What can this character NOT see about themselves?" />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: co.muted, display: "block", marginBottom: 2 }}>First Impression</span>
                    <textarea style={{ ...sTextarea, fontSize: 11 }} rows={2} value={data.firstImpressionNote || ""} onChange={(e: any) => setData((d: any) => ({ ...d, firstImpressionNote: e.target.value }))} placeholder="The small human moment in their first scene — not heroism, humanity." />
                  </div>
                </div>
              </details>
            </div>
            )}
            {tKey === "char" && isStoryFormat(project.format) && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: co.muted, marginBottom: 4, display: "block", fontWeight: 600 }}>Context Injection</span>
                <select
                  style={sInput}
                  value={(data as any).contextVisibility ?? 'always'}
                  onChange={e => setData((d: any) => ({ ...d, contextVisibility: e.target.value }))}
                >
                  <option value="always">Always inject (main characters — full profile every generation)</option>
                  <option value="mentioned">When mentioned (secondary — inject only when they appear in the scene)</option>
                  <option value="never">Never inject (background — no AI context cost)</option>
                </select>
                <div style={{ fontSize: 10, color: co.muted, marginTop: 4 }}>Set secondary characters to "When mentioned" to save context tokens.</div>
              </div>
            )}
            {tKey === "plot" && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: co.muted, marginBottom: 2, display: "block", fontWeight: 600 }}>Status</span><select style={sInput} value={newPlot.status} onChange={e => setNewPlot((t: any) => ({ ...t, status: e.target.value }))}><option>Active</option><option>Simmering</option><option>Resolved</option></select></div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button style={sBtnSm} onClick={() => setShow(false)}>Cancel</button>
              <button style={sBtn} disabled={!data.name} onClick={onSave}>{editCharIdx !== null || editLocIdx !== null || editPlotIdx !== null ? "Save Changes" : "Add"}</button>
            </div>
          </div>
        </div>
      ))}

      {/* Soul ID Training Modal */}
      {showSoulIdModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }} onClick={() => !soulIdTraining && setShowSoulIdModal(false)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={(e: any) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>Train Soul ID</h3>
            <p style={{ fontSize: 12, color: co.muted, marginBottom: 12 }}>Paste 3–10 hosted image URLs of your character (one per line)</p>
            <textarea
              value={soulIdUrls}
              onChange={e => setSoulIdUrls(e.target.value)}
              placeholder={"https://i.imgur.com/abc123.jpg\nhttps://i.imgur.com/def456.jpg\nhttps://i.imgur.com/ghi789.jpg"}
              rows={5}
              style={{ ...sTextarea, width: "100%", fontSize: 11, fontFamily: "monospace", boxSizing: "border-box" }}
              disabled={soulIdTraining}
            />
            <div style={{ fontSize: 11, color: co.muted, marginTop: 4 }}>Host images on Imgur (free) or Cloudinary. Direct image links only.</div>
            {soulIdMsg && <div style={{ fontSize: 11, color: soulIdMsg.includes("success") ? "#166534" : co.muted, marginTop: 6 }}>{soulIdMsg}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button style={sBtnSm} disabled={soulIdTraining} onClick={() => setShowSoulIdModal(false)}>Cancel</button>
              <button style={{ ...sBtn, opacity: soulIdTraining ? 0.5 : 1 }} disabled={soulIdTraining} onClick={startSoulIdTraining}>
                {soulIdTraining ? "Training..." : "Start Training"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* World Bible Inference Modal */}
      {inferResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }} onClick={() => setInferResult(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 560, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid #e5e7eb" }} onClick={(e: any) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>✨ Found in your chapters</h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>Select which items to import. Already-existing entries are unchecked.</p>
            {[
              { label: "Characters", items: inferResult.characters || [], type: "character" },
              { label: "Locations", items: inferResult.locations || [], type: "location" },
              { label: "Plot Threads", items: inferResult.plotThreads || [], type: "plotThread" },
            ].map(({ label, items, type }) => items.length > 0 && (
              <div key={type} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6c47ff", textTransform: "uppercase", marginBottom: 6 }}>{label} ({items.length})</div>
                {items.map((item: any, i: number) => {
                  const key = `item-${i}-${item.name}`;
                  return (
                    <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!inferSelected[key]} onChange={e => setInferSelected(s => ({ ...s, [key]: e.target.checked }))} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}{item.role && <span style={{ fontWeight: 400, color: "#6b7280" }}> — {item.role}</span>}</div>
                        {item.description && <div style={{ fontSize: 11, color: "#6b7280" }}>{item.description}</div>}
                        {item.personality && <div style={{ fontSize: 11, color: "#6b7280" }}>{item.personality}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            ))}
            {(inferResult.worldRules?.length > 0) && (
              <div style={{ marginBottom: 12, background: "#f9fafb", borderRadius: 8, padding: 10, fontSize: 12, color: "#374151" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>World Rules extracted:</div>
                {inferResult.worldRules.map((r: string, i: number) => <div key={i}>• {r}</div>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 13 }} onClick={() => setInferResult(null)}>Cancel</button>
              <button
                style={{ padding: "6px 14px", borderRadius: 6, background: "#6c47ff", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                onClick={async () => {
                  const allItems = [
                    ...(inferResult.characters || []).map((c: any, i: number) => ({ ...c, type: "character", key: `item-${i}-${c.name}` })),
                    ...(inferResult.locations || []).map((l: any, i: number) => ({ ...l, type: "location", key: `item-${(inferResult.characters?.length || 0) + i}-${l.name}` })),
                    ...(inferResult.plotThreads || []).map((t: any, i: number) => ({ ...t, type: "plotThread", key: `item-${(inferResult.characters?.length || 0) + (inferResult.locations?.length || 0) + i}-${t.name}` })),
                  ];
                  for (const item of allItems) {
                    if (!inferSelected[item.key]) continue;
                    if (item.type === "character") {
                      await fetch(`/api/projects/${project.id}/characters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name, role: item.role || "", personality: item.personality || "", appearance: item.appearance || "" }) });
                    } else if (item.type === "location") {
                      await fetch(`/api/projects/${project.id}/locations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name, description: item.description || "" }) });
                    } else if (item.type === "plotThread") {
                      await fetch(`/api/projects/${project.id}/plot-threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name, description: item.description || "" }) });
                    }
                  }
                  setInferResult(null);
                  window.location.reload();
                }}
              >
                Import Selected
              </button>
            </div>
          </div>
        </div>
      )}

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
      {/* Character Evolution Modal */}
      {showEvolutionModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowEvolutionModal(false)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 520, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📈 {evolutionCharName}'s Evolution</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: co.muted }} onClick={() => setShowEvolutionModal(false)}>×</button>
            </div>
            {evolutionLoading && <div style={{ textAlign: "center", padding: "30px 0", color: co.muted, fontSize: 13 }}>Loading timeline...</div>}
            {!evolutionLoading && evolutionLogs.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No evolution tracked yet</div>
                <div style={{ fontSize: 11, color: co.muted, lineHeight: 1.5 }}>Character evolution is analysed every 5 chapters.<br />Write more of the story to see how {evolutionCharName} changes.</div>
              </div>
            )}
            {!evolutionLoading && evolutionLogs.length > 0 && (
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 12, top: 0, bottom: 0, width: 2, background: co.border }} />
                {evolutionLogs.map((log: any, i: number) => (
                  <div key={log.id} style={{ paddingLeft: 32, marginBottom: 16, position: "relative" }}>
                    <div style={{ position: "absolute", left: 6, top: 4, width: 14, height: 14, borderRadius: "50%", background: co.accent, border: "2px solid " + co.surface }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 4 }}>Chapter {log.chapterIndex + 1}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6, color: co.text }}>{log.evolutionSummary}</div>
                    {log.updatedTraits && Object.entries(log.updatedTraits).some(([, v]) => v) && (
                      <div style={{ background: co.surfaceAlt, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, marginBottom: 4 }}>UPDATED TRAITS</div>
                        {Object.entries(log.updatedTraits).filter(([, v]) => v).map(([k, v]) => (
                          <div key={k} style={{ fontSize: 11, color: co.muted, marginBottom: 2 }}>
                            <span style={{ color: co.text, fontWeight: 600 }}>{k}:</span> {v as string}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setShowEvolutionModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
