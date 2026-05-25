"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { buildContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { getPipelines, AGENT_LABELS, type Pipeline } from "@/lib/ai/pipelines";
import ComicStudio from "@/components/ComicStudio";
import ProductionStudio from "@/components/ProductionStudio";

const FORMATS = [
  "Novel", "Screenplay", "Web Series",
  "YouTube Long-form", "YouTube Short",
  "TikTok Script", "Instagram Reel", "Podcast Episode",
];
const CREATOR_FORMATS = ["YouTube Long-form", "YouTube Short", "TikTok Script", "Instagram Reel", "Podcast Episode"];
const STORY_FORMATS = ["Novel", "Screenplay", "Web Series"];
const isCreatorFormat = (f: string) => CREATOR_FORMATS.includes(f);
const isStoryFormat = (f: string) => STORY_FORMATS.includes(f);
const getChapterLabel = (format: string): string => ({
  "Novel": "Chapter", "Screenplay": "Scene", "Web Series": "Episode",
  "YouTube Long-form": "Section", "YouTube Short": "Beat",
  "TikTok Script": "Beat", "Instagram Reel": "Beat",
  "Podcast Episode": "Segment",
} as Record<string, string>)[format] ?? "Chapter";
const GENRES = ["Fantasy", "Sci-Fi", "Horror", "Thriller", "Romance", "Drama", "Comedy", "Mystery", "Literary Fiction", "Action", "Historical", "Dystopian", "Noir", "Satire"];
const MODES = ["brainstorm", "outline", "write"];
const STYLE_ATTRS = ["Pacing", "Tone", "POV Style", "Dialogue Style", "Sentence Structure", "Atmosphere"];
const DEFAULT_CHAR = { name: "", role: "", age: "", appearance: "", personality: "", thinkingStyle: "", behavior: "", habits: "", fears: "", desires: "", speechPattern: "", backstory: "", arc: "" };
const DEFAULT_LOC = { name: "", description: "", atmosphere: "", history: "", sensoryDetails: "" };
const DEFAULT_PLOT = { name: "", description: "", status: "Active", stakes: "", connections: "" };
const CharFields = [["name", "Name", "input"], ["role", "Role", "input"], ["age", "Age", "input"], ["appearance", "Appearance", "textarea"], ["personality", "Personality", "textarea"], ["thinkingStyle", "Thinking style", "textarea"], ["behavior", "Behavior patterns", "textarea"], ["habits", "Habits & quirks", "textarea"], ["fears", "Fears", "textarea"], ["desires", "Desires", "textarea"], ["speechPattern", "Speech pattern", "textarea"], ["backstory", "Backstory", "textarea"], ["arc", "Character arc", "textarea"]];
const LocFields = [["name", "Name", "input"], ["description", "Description", "textarea"], ["atmosphere", "Atmosphere", "textarea"], ["history", "History", "textarea"], ["sensoryDetails", "Sensory details", "textarea"]];
const PlotFields = [["name", "Thread Name", "input"], ["description", "Description", "textarea"], ["stakes", "Stakes", "textarea"], ["connections", "Connections", "textarea"]];

// NOTE: Replace these fetch calls with your API routes:
// fetch("/api/ai/generate", ...) instead of direct Anthropic calls
// fetch("/api/projects/[id]", ...) for CRUD operations
// fetch("/api/ai/entity", ...) for character/location/plot generation
// fetch("/api/ai/analyze-work", ...) for reference work analysis
// fetch("/api/ai/summarize", ...) for chapter summaries

export default function GhostWriterApp({ projectId }) {
  const [project, setProject] = useState(null);
  const [mode, setMode] = useState("brainstorm");
  const [leftTab, setLeftTab] = useState("bible");
  const [generating, setGenerating] = useState(false);
  const [genTarget, setGenTarget] = useState("");
  const [streamText, setStreamText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showRefModal, setShowRefModal] = useState(false);
  const [newRef, setNewRef] = useState({ title: "", attributes: {} });
  const [showCharModal, setShowCharModal] = useState(false);
  const [editCharIdx, setEditCharIdx] = useState(null);
  const [newChar, setNewChar] = useState({ ...DEFAULT_CHAR });
  const [showLocModal, setShowLocModal] = useState(false);
  const [editLocIdx, setEditLocIdx] = useState(null);
  const [newLoc, setNewLoc] = useState({ ...DEFAULT_LOC });
  const [showPlotModal, setShowPlotModal] = useState(false);
  const [editPlotIdx, setEditPlotIdx] = useState(null);
  const [newPlot, setNewPlot] = useState({ ...DEFAULT_PLOT });
  const [charGenPrompt, setCharGenPrompt] = useState("");
  const [locGenPrompt, setLocGenPrompt] = useState("");
  const [plotGenPrompt, setPlotGenPrompt] = useState("");
  const [bibleGenPrompt, setBibleGenPrompt] = useState("");
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [quickStartLoading, setQuickStartLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatorBible, setCreatorBible] = useState<any>(null);
  const [storyMemories, setStoryMemories] = useState<any[]>([]);
  const [linkSuggestions, setLinkSuggestions] = useState<any[]>([]);
  const [suggestingLinks, setSuggestingLinks] = useState(false);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [newMemoryInput, setNewMemoryInput] = useState("");

  const [pillarInput, setPillarInput] = useState("");
  const [showAgents, setShowAgents] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<{ agent: string; output: string }[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);

  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [proseResult, setProseResult] = useState<{ mode: string; variants?: string[]; result?: string; chosen?: number } | null>(null);
  const [proseLoading, setProseLoading] = useState(false);
  const [hookScore, setHookScore] = useState<{ score: number; feedback: string } | null>(null);
  const [hookScoring, setHookScoring] = useState(false);
  const [showComicStudio, setShowComicStudio] = useState(false);
  const [showProductionStudio, setShowProductionStudio] = useState(false);
  const [higgsfieldKey, setHiggsfieldKey] = useState("");
  const [showRelMap, setShowRelMap] = useState(false);
  const [relMapData, setRelMapData] = useState<{ nodes: any[]; edges: any[]; isolated: any[] } | null>(null);
  const [relMapLoading, setRelMapLoading] = useState(false);
  const [selectedMapEdge, setSelectedMapEdge] = useState<any | null>(null);
  const [selectedMapNode, setSelectedMapNode] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const chapterSaveTimer = useRef(null);
  const bibleSaveTimer = useRef(null);

  useEffect(() => {
    fetch("/api/user/settings").then(r => r.json()).then(data => {
      if (data.higgsfieldKeySet) setHiggsfieldKey("__set__");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!project || !isCreatorFormat(project.format)) return;
    fetch(`/api/projects/${project.id}/creator-bible`)
      .then(r => r.json()).then(setCreatorBible);
  }, [project?.id, project?.format]);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/story-memories`)
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setStoryMemories(data); })
      .catch(() => {});
  }, [project?.id]);

  // Load project from API
  useEffect(() => {
    fetch("/api/projects/" + projectId)
      .then(r => {
        if (!r.ok) throw new Error("Failed to load project");
        return r.json();
      })
      .then(data => setProject({ ...data, activeChapter: data.chapters?.[0]?.id || null }))
      .catch(() => setLoadError("Failed to load project. Please refresh."));
  }, [projectId]);

  if (loadError) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", flexDirection: "column", gap: 12 }}>
      <span style={{ color: "#d94545", fontSize: 15 }}>{loadError}</span>
      <button onClick={() => window.location.reload()} style={{ padding: "8px 20px", background: "#5b4ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Retry</button>
    </div>
  );

  if (!project) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>Loading...</div>;

  const activeChap = project.chapters?.find(c => c.id === project.activeChapter) || project.chapters?.[0] || { id: "", title: "Chapter 1", content: "", summary: "" };

  const updateProject = (fn) => setProject(p => typeof fn === "function" ? fn(p) : fn);
  const updateChapter = (f, v) => {
    updateProject(p => ({ ...p, chapters: p.chapters.map(c => c.id === p.activeChapter ? { ...c, [f]: v } : c) }));
    const chapId = project.activeChapter;
    const projId = project.id;
    clearTimeout(chapterSaveTimer.current);
    chapterSaveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${projId}/chapters/${chapId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [f]: v }) })
        .then(() => {
          if (f === "content" && v && v.trim().split(/\s+/).length > 200) {
            fetch(`/api/ai/summarize`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: v }),
            })
              .then(r => r.json())
              .then(data => {
                if (data.summary) {
                  fetch(`/api/projects/${projId}/chapters/${chapId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ summary: data.summary }),
                  });
                  updateProject((p: any) => ({
                    ...p,
                    chapters: p.chapters.map((c: any) =>
                      c.id === chapId ? { ...c, summary: data.summary } : c
                    ),
                  }));
                }
              })
              .catch(() => {});
          }
          fetch(`/api/projects/${projId}/chapters/${chapId}/extract-memory`, { method: "POST" })
            .then(r => r.json()).then(data => {
              if (data.memories?.length) {
                setStoryMemories(prev => [
                  ...prev.filter((m: any) => !(m.chapterId === chapId && m.autoExtracted)),
                  ...data.memories,
                ]);
              }
            }).catch(() => {});
        }).catch(() => { setErrorMsg("Auto-save failed. Your changes may not be saved."); });
    }, 1500);
  };

  const updateCreatorBible = (field: string, value: any) => {
    setCreatorBible((prev: any) => ({ ...prev, [field]: value }));
    clearTimeout(bibleSaveTimer.current);
    bibleSaveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${project.id}/creator-bible`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      }).catch(() => { setErrorMsg("Failed to save Creator Bible changes."); });
    }, 1500);
  };

  const generateCreatorBible = async () => {
    if (!bibleGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("bible");
    try {
      const r = await callAI("entity", {
        type: "creatorBible",
        prompt: bibleGenPrompt,
        projectContext: buildCreatorContext({ ...project, creatorBible }),
      });
      setCreatorBible((prev: any) => ({ ...prev, ...r }));
      await fetch(`/api/projects/${project.id}/creator-bible`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      });
    } catch (e) { setErrorMsg("Failed to generate Creator Bible. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generatePortrait = async (charIdx: number) => {
    if (portraitLoading) return;
    const char = project.characters[charIdx];
    if (!char?.appearance) return;
    setPortraitLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${char.id}/portrait`, { method: "POST" });
      const data = await res.json();
      if (data.portraitUrl) {
        updateProject((p: any) => ({
          ...p, characters: p.characters.map((c: any, i: number) => i === charIdx ? { ...c, portraitUrl: data.portraitUrl } : c)
        }));
        setNewChar((c: any) => ({ ...c, portraitUrl: data.portraitUrl }));
      }
    } catch (e) { setErrorMsg("Portrait generation failed. Check your Higgsfield API key."); }
    setPortraitLoading(false);
  };

  const suggestLinks = async () => {
    if (suggestingLinks) return;
    setSuggestingLinks(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/suggest-links`, { method: "POST" });
      const data = await res.json();
      setLinkSuggestions(data.suggestions || []);
    } catch (e) { setErrorMsg("Link suggestion failed. Please try again."); }
    setSuggestingLinks(false);
  };

  const confirmLink = async (suggestion: any) => {
    await fetch(`/api/projects/${project.id}/suggest-links`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: suggestion.type, characterId: suggestion.characterId, targetId: suggestion.targetId }),
    });
    setLinkSuggestions(prev => prev.filter(s => !(s.characterId === suggestion.characterId && s.targetId === suggestion.targetId)));
  };

  const runPipeline = async (pipeline: Pipeline) => {
    if (pipelineRunning || !prompt.trim()) return;
    setPipelineRunning(true);
    setActivePipelineId(pipeline.id);
    setPipelineResults([]);
    setExpandedAgent(null);
    try {
      const res = await fetch("/api/ai/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agents: pipeline.agents,
          prompt,
          context: buildFullContext(),
          format: project.format,
        }),
      });
      const data = await res.json();
      if (data.results?.length) {
        setPipelineResults(data.results);
        setExpandedAgent(data.results[data.results.length - 1].agent);
      }
    } catch (e) { setErrorMsg("Agent pipeline failed. Please try again."); }
    setPipelineRunning(false);
  };

  const usePipelineOutput = (output: string) => {
    if (mode === "write") {
      setUndoStack(s => [...s.slice(-9), activeChap.content]);
      updateChapter("content", activeChap.content + (activeChap.content ? "\n\n" : "") + output);
    } else {
      setStreamText(output);
    }
    setShowAgents(false);
    setPipelineResults([]);
  };

  const loadRelMap = async () => {
    setRelMapLoading(true);
    setSelectedMapEdge(null);
    setSelectedMapNode(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/relationship-map`);
      const data = await res.json();
      setRelMapData(data);
    } catch (e) {
      setErrorMsg("Failed to load character connections. Please try again.");
    } finally {
      setRelMapLoading(false);
    }
  };

  const scoreHook = async () => {
    if (!prompt.trim() || hookScoring) return;
    setHookScoring(true);
    setHookScore(null);
    try {
      const res = await fetch("/api/ai/score-hook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hook: prompt, format: project.format }) });
      const data = await res.json();
      if (data.score != null) setHookScore(data);
    } catch (e) {
      setErrorMsg("Hook scoring failed. Please try again.");
    } finally {
      setHookScoring(false);
    }
  };

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const selected = el.value.substring(el.selectionStart, el.selectionEnd);
    if (selected.trim().length > 10) {
      setSelectedText(selected);
      setSelectedRange({ start: el.selectionStart, end: el.selectionEnd });
    } else {
      setSelectedText("");
      setSelectedRange(null);
    }
  };

  const runProse = async (proseMode: string) => {
    if (!selectedText || proseLoading) return;
    setProseLoading(true);
    setProseResult(null);
    try {
      const res = await fetch("/api/ai/prose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, mode: proseMode, projectContext: buildFullContext() }),
      });
      const data = await res.json();
      setProseResult({ mode: proseMode, ...data, chosen: 0 });
    } catch (e) { setErrorMsg("Prose tool failed. Please try again."); }
    setProseLoading(false);
  };

  const replaceSelection = (newText: string) => {
    if (!selectedRange) return;
    const content = activeChap.content || "";
    const updated = content.substring(0, selectedRange.start) + newText + content.substring(selectedRange.end);
    updateChapter("content", updated);
    setProseResult(null);
    setSelectedText("");
    setSelectedRange(null);
  };

  const addChapter = async () => {
    const label = getChapterLabel(project.format);
    const title = label + " " + (project.chapters.length + 1);
    const res = await fetch(`/api/projects/${project.id}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, sortOrder: project.chapters.length }) });
    const newChap = await res.json();
    updateProject(p => ({ ...p, chapters: [...p.chapters, newChap], activeChapter: newChap.id }));
  };

  const deleteChapter = (id) => {
    if (project.chapters.length <= 1) return;
    setConfirmModal({
      msg: "Delete this chapter?", action: async () => {
        await fetch(`/api/projects/${project.id}/chapters/${id}`, { method: "DELETE" });
        updateProject(p => { const f = p.chapters.filter(c => c.id !== id); return { ...p, chapters: f, activeChapter: f[0].id }; });
        setConfirmModal(null);
      }
    });
  };

  const moveChapter = async (i, dir) => {
    const ni = i + dir;
    if (ni < 0 || ni >= project.chapters.length) return;
    const updated = [...project.chapters];
    [updated[i], updated[ni]] = [updated[ni], updated[i]];
    await Promise.all([
      fetch(`/api/projects/${project.id}/chapters/${updated[i].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) }),
      fetch(`/api/projects/${project.id}/chapters/${updated[ni].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: ni }) })
    ]);
    updateProject(p => ({ ...p, chapters: updated }));
  };

  const toggleGenre = (g) => updateProject(p => ({ ...p, genres: p.genres.includes(g) ? p.genres.filter(x => x !== g) : [...p.genres, g] }));

  const wordCount = (activeChap.content || "").trim().split(/\s+/).filter(Boolean).length;
  const totalWords = project.chapters.reduce((a, c) => a + (c.content || "").trim().split(/\s+/).filter(Boolean).length, 0);

  // AI calls - replace with your API routes
  const callAI = async (endpoint, body) => {
    const res = await fetch("/api/ai/" + endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  };

  const buildNeighbourContext = (p: any): string => {
    const activeIdx = p.chapters.findIndex((c: any) => c.id === p.activeChapter);
    const parts: string[] = [];

    const recent = p.chapters
      .slice(Math.max(0, activeIdx - 2), activeIdx)
      .filter((c: any) => c.summary);
    if (recent.length) {
      parts.push("RECENT CHAPTERS:");
      recent.forEach((c: any) => parts.push(`[${c.title}]: ${c.summary}`));
    }

    const next = p.chapters[activeIdx + 1];
    if (next) {
      parts.push(`NEXT CHAPTER: "${next.title}" (not yet written — maintain narrative momentum toward this)`);
    }

    const distant = p.chapters.filter((c: any, i: number) =>
      c.id !== p.activeChapter && i < activeIdx - 2
    );
    if (distant.length) {
      parts.push("EARLIER CHAPTERS (titles only): " + distant.map((c: any) => c.title).join(", "));
    }

    return parts.join("\n");
  };

  const buildFullContext = (p = project) => {
    let base: string;
    if (isCreatorFormat(p.format)) {
      base = buildCreatorContext({ ...p, creatorBible });
    } else {
      base = (p.skillLevel === "beginner" ? buildBeginnerContext : buildContext)(p);
    }
    const neighbourContext = buildNeighbourContext(p);
    return neighbourContext ? base + "\n\n" + neighbourContext : base;
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const r = await callAI("generate", { mode, prompt, context: buildFullContext(), format: project.format, projectId: project.id, chapterId: activeChap.id });
      if (mode === "write") { setUndoStack(s => [...s.slice(-9), activeChap.content]); updateChapter("content", activeChap.content + (activeChap.content ? "\n\n" : "") + r.text); }
      else setStreamText(r.text);
    } catch (e) { setErrorMsg("Generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const undoGeneration = () => { if (!undoStack.length) return; updateChapter("content", undoStack[undoStack.length - 1]); setUndoStack(s => s.slice(0, -1)); };

  const saveToNotes = () => { if (!streamText) return; updateProject(p => ({ ...p, notes: p.notes + (p.notes ? "\n\n---\n\n" : "") + "[" + mode.toUpperCase() + "]\n" + streamText })); setSavedMsg("Saved to notes"); setTimeout(() => setSavedMsg(""), 1500); };

  const autoSummarize = async () => {
    if (!activeChap.content) return;
    setGenerating(true); setGenTarget("summary");
    try { const r = await callAI("summarize", { content: activeChap.content }); updateChapter("summary", r.summary); } catch (e) { setErrorMsg("Failed to summarize chapter. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const save = async () => {
    try {
      await fetch("/api/projects/" + project.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: project.name, format: project.format, genres: project.genres, notes: project.notes }) });
      setSavedMsg("Saved"); setTimeout(() => setSavedMsg(""), 1500);
    } catch { setSavedMsg("Failed"); }
  };

  const exportAll = () => {
    const label = getChapterLabel(project.format);
    let txt = "";
    if (isCreatorFormat(project.format)) {
      txt += `${project.name.toUpperCase()}\nFormat: ${project.format}\n`;
      if (creatorBible?.channelName) txt += `Channel: ${creatorBible.channelName}\n`;
      txt += "─".repeat(40) + "\n\n";
      project.chapters.forEach((c: any) => {
        txt += `── ${label.toUpperCase()}: ${c.title} ──\n\n${c.content || "(empty)"}\n\n`;
      });
    } else {
      txt += `# ${project.name}\n${project.format} | ${project.genres.join(", ")}\n\n`;
      project.chapters.forEach((c: any) => {
        txt += `## ${c.title}\n\n${c.content || "(empty)"}\n\n`;
      });
    }
    navigator.clipboard.writeText(txt);
    setSavedMsg("Copied"); setTimeout(() => setSavedMsg(""), 1500);
  };

  const openCharEdit = (i) => { setEditCharIdx(i); setNewChar({ ...DEFAULT_CHAR, ...project.characters[i] }); setCharGenPrompt(""); setShowCharModal(true); };
  const openCharNew = () => { setEditCharIdx(null); setNewChar({ ...DEFAULT_CHAR }); setCharGenPrompt(""); setShowCharModal(true); };
  const saveChar = async () => {
    if (!newChar.name) return;
    if (editCharIdx !== null) {
      const id = project.characters[editCharIdx].id;
      const res = await fetch(`/api/projects/${project.id}/characters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newChar) });
      const updated = await res.json();
      updateProject(p => ({ ...p, characters: p.characters.map((c, i) => i === editCharIdx ? updated : c) }));
    } else {
      const res = await fetch(`/api/projects/${project.id}/characters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newChar) });
      const created = await res.json();
      updateProject(p => ({ ...p, characters: [...p.characters, created] }));
    }
    setShowCharModal(false);
  };
  const openLocEdit = (i) => { setEditLocIdx(i); setNewLoc({ ...DEFAULT_LOC, ...project.locations[i] }); setLocGenPrompt(""); setShowLocModal(true); };
  const openLocNew = () => { setEditLocIdx(null); setNewLoc({ ...DEFAULT_LOC }); setLocGenPrompt(""); setShowLocModal(true); };
  const saveLoc = async () => {
    if (!newLoc.name) return;
    if (editLocIdx !== null) {
      const id = project.locations[editLocIdx].id;
      const res = await fetch(`/api/projects/${project.id}/locations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newLoc) });
      const updated = await res.json();
      updateProject(p => ({ ...p, locations: p.locations.map((l, i) => i === editLocIdx ? updated : l) }));
    } else {
      const res = await fetch(`/api/projects/${project.id}/locations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newLoc) });
      const created = await res.json();
      updateProject(p => ({ ...p, locations: [...p.locations, created] }));
    }
    setShowLocModal(false);
  };
  const openPlotEdit = (i) => { setEditPlotIdx(i); setNewPlot({ ...DEFAULT_PLOT, ...project.plotThreads[i] }); setPlotGenPrompt(""); setShowPlotModal(true); };
  const openPlotNew = () => { setEditPlotIdx(null); setNewPlot({ ...DEFAULT_PLOT }); setPlotGenPrompt(""); setShowPlotModal(true); };
  const savePlot = async () => {
    if (!newPlot.name) return;
    if (editPlotIdx !== null) {
      const id = project.plotThreads[editPlotIdx].id;
      const res = await fetch(`/api/projects/${project.id}/plot-threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPlot) });
      const updated = await res.json();
      updateProject(p => ({ ...p, plotThreads: p.plotThreads.map((t, i) => i === editPlotIdx ? updated : t) }));
    } else {
      const res = await fetch(`/api/projects/${project.id}/plot-threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPlot) });
      const created = await res.json();
      updateProject(p => ({ ...p, plotThreads: [...p.plotThreads, created] }));
    }
    setShowPlotModal(false);
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

  const generateChar = async () => {
    if (!charGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("char");
    try {
      const r = await callAI("entity", { type: "character", prompt: charGenPrompt, projectContext: buildContext(project) });
      setNewChar(c => ({ ...c, ...r }));
    } catch (e) { setErrorMsg("Character generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };
  const improveChar = async () => {
    if (!newChar.name || generating) return;
    setGenerating(true); setGenTarget("char");
    try {
      const r = await callAI("entity", { type: "character", prompt: "", projectContext: buildContext(project), existing: newChar });
      setNewChar(c => ({ ...c, ...r }));
    } catch (e) { setErrorMsg("Character improvement failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateLoc = async () => {
    if (!locGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("loc");
    try {
      const r = await callAI("entity", { type: "location", prompt: locGenPrompt, projectContext: buildContext(project) });
      setNewLoc(l => ({ ...l, ...r }));
    } catch (e) { setErrorMsg("Location generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };
  const improveLoc = async () => {
    if (!newLoc.name || generating) return;
    setGenerating(true); setGenTarget("loc");
    try {
      const r = await callAI("entity", { type: "location", prompt: "", projectContext: buildContext(project), existing: newLoc });
      setNewLoc(l => ({ ...l, ...r }));
    } catch (e) { setErrorMsg("Location improvement failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generatePlot = async () => {
    if (!plotGenPrompt.trim() || generating) return;
    setGenerating(true); setGenTarget("plot");
    try {
      const r = await callAI("entity", { type: "plotThread", prompt: plotGenPrompt, projectContext: buildContext(project) });
      setNewPlot(t => ({ ...t, ...r }));
    } catch (e) { setErrorMsg("Plot thread generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };
  const improvePlot = async () => {
    if (!newPlot.name || generating) return;
    setGenerating(true); setGenTarget("plot");
    try {
      const r = await callAI("entity", { type: "plotThread", prompt: "", projectContext: buildContext(project), existing: newPlot });
      setNewPlot(t => ({ ...t, ...r }));
    } catch (e) { setErrorMsg("Plot thread improvement failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const analyzeRefWork = async () => {
    if (!newRef.title.trim() || generating) return;
    setGenerating(true); setGenTarget("ref");
    try {
      const r = await callAI("analyze-work", { title: newRef.title });
      setNewRef(ref => ({ ...ref, attributes: r }));
    } catch (e) { setErrorMsg("Reference work analysis failed. Please try again."); }
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

  const quickStartStory = async () => {
    if (quickStartLoading) return;
    setQuickStartLoading(true);
    try {
      const res = await fetch(`/api/ai/quick-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, title: project.name, format: project.format, genres: project.genres })
      });
      const data = await res.json();
      if (data.success) {
        setStreamText(data.outline || "Story skeleton generated! Check your World Bible.");
        setShowQuickStart(false);
        // Refresh project data
        const projRes = await fetch("/api/projects/" + project.id);
        const updated = await projRes.json();
        setProject({ ...updated, activeChapter: updated.chapters?.[0]?.id || null });
        setSavedMsg("Story generated!");
        setTimeout(() => setSavedMsg(""), 2000);
      }
    } catch (e) { setErrorMsg("Story generation failed. Please try again."); }
    setQuickStartLoading(false);
  };

  const entityApiPath = { characters: "characters", locations: "locations", plotThreads: "plot-threads" };

  const toggleAlwaysInContext = async (key: string, item: any, i: number) => {
    const newVal = item.alwaysInContext === false;
    fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alwaysInContext: newVal }),
    }).catch(() => { setErrorMsg("Failed to update context priority."); });
    updateProject((p: any) => ({
      ...p,
      [key]: p[key].map((e: any, j: number) => j === i ? { ...e, alwaysInContext: newVal } : e),
    }));
  };
  const co = { bg: "#f8f7f4", surface: "#ffffff", surfaceAlt: "#f0efe9", border: "#e2e0d8", text: "#1a1a1a", muted: "#777", accent: "#5b4ccc", accentBg: "#5b4ccc12", danger: "#d94545", green: "#2d9e5e", orange: "#c9860a" };
  const sInput = { background: co.surfaceAlt, border: "1px solid " + co.border, borderRadius: 8, color: co.text, padding: "8px 10px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" };
  const sTextarea = { ...sInput, resize: "vertical", fontFamily: "inherit" };
  const sBtn = { padding: "7px 16px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12, background: co.accent, color: "#fff", whiteSpace: "nowrap" };
  const sBtnSm = { padding: "4px 10px", border: "1px solid " + co.border, borderRadius: 6, cursor: "pointer", fontSize: 11, background: co.surfaceAlt, color: co.muted };

  // Full v4 UI - three panel layout with all features
  // This is a direct port of the artifact v4
  // See the working artifact for complete render logic
  // Key features included:
  // - Multi-genre selection
  // - AI World Builder
  // - AI Generate + Improve for characters, locations, plot threads
  // - Notes tab for saving brainstorm/outline output
  // - Word count display
  // - Expandable prompt textarea
  // - Undo AI generation
  // - Export all chapters
  // - Confirmation dialogs
  // - Chapter reordering

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter',system-ui,sans-serif", background: co.bg, color: co.text, overflow: "hidden" }}>
      {errorMsg && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#d94545", color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, zIndex: 2000 }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}
      {/* LEFT PANEL */}
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
            {project.skillLevel === "beginner" && !project.characters?.length ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "20px" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✨</div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ready to generate?</div><div style={{ fontSize: 11, color: co.muted, marginBottom: 16, lineHeight: 1.5 }}>I'll create characters, locations, and a plot outline for you.</div><button style={{ ...sBtn, width: "100%" }} disabled={quickStartLoading} onClick={quickStartStory}>{quickStartLoading ? "Generating..." : "Generate Story"}</button></div>
              : leftTab === "notes" ? <textarea style={{ ...sTextarea, minHeight: 200 }} value={project.notes || ""} onChange={e => updateProject(p => ({ ...p, notes: e.target.value }))} placeholder="Saved brainstorm/outline output..." />
                : leftTab === "memory" ? <>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      <input style={{ ...sInput, flex: 1 }} placeholder="Add a fact manually..." value={newMemoryInput} onChange={e => setNewMemoryInput(e.target.value)} onKeyDown={e => {
                        if (e.key === "Enter" && newMemoryInput.trim()) {
                          fetch(`/api/projects/${project.id}/story-memories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fact: newMemoryInput.trim() }) })
                            .then(r => r.json()).then(m => { setStoryMemories(prev => [m, ...prev]); setNewMemoryInput(""); }).catch(() => { setErrorMsg("Failed to add memory. Please try again."); });
                        }
                      }} />
                      <button style={sBtnSm} onClick={() => {
                        if (!newMemoryInput.trim()) return;
                        fetch(`/api/projects/${project.id}/story-memories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fact: newMemoryInput.trim() }) })
                          .then(r => r.json()).then(m => { setStoryMemories(prev => [m, ...prev]); setNewMemoryInput(""); }).catch(() => { setErrorMsg("Failed to add memory. Please try again."); });
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
                                  .then(() => setStoryMemories(prev => prev.filter((x: any) => x.id !== m.id))).catch(() => { setErrorMsg("Failed to delete memory."); });
                              }}>×</button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </>
                : leftTab === "bible" ? <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Project</label>
                    <input style={{ ...sInput, marginTop: 4, fontWeight: 700 }} value={project.name} onChange={e => updateProject(p => ({ ...p, name: e.target.value }))} />
                    <select style={{ ...sInput, marginTop: 6 }} value={project.format} onChange={e => updateProject(p => ({ ...p, format: e.target.value }))}>{FORMATS.map(f => <option key={f}>{f}</option>)}</select>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap" }}>{GENRES.map(g => <span key={g} onClick={() => toggleGenre(g)} style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: "1px solid " + (project.genres.includes(g) ? co.accent : co.border), background: project.genres.includes(g) ? co.accentBg : "transparent", color: project.genres.includes(g) ? co.accent : co.muted, fontWeight: project.genres.includes(g) ? 600 : 400, margin: 2 }}>{g}</span>)}</div>
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
                            const svgSize = 210;
                            const cx = svgSize / 2, cy = svgSize / 2;
                            const radius = nodes.length <= 1 ? 0 : Math.min(70, svgSize / 2 - 30);
                            const nodeR = 18;
                            const angleStep = nodes.length > 1 ? (2 * Math.PI) / nodes.length : 0;
                            const pos = nodes.map((_: any, i: number) => ({
                              x: cx + radius * Math.cos(i * angleStep - Math.PI / 2),
                              y: cy + radius * Math.sin(i * angleStep - Math.PI / 2),
                            }));
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
                                    <button style={{ ...sBtn, width: "100%", fontSize: 11 }} onClick={() => { setPrompt(`Write a scene where ${selectedMapEdge.charAName} and ${selectedMapEdge.charBName} interact.`); setMode("write"); setShowAgents(false); setShowRelMap(false); setSelectedMapEdge(null); }}>✍️ Write scene together</button>
                                  </div>
                                )}
                                {selectedMapNode && (
                                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#fef2f2", borderRadius: 10, border: "1px solid #ef4444" }}>
                                    <div style={{ fontSize: 11, marginBottom: 8, color: "#ef4444" }}>⚠️ <strong>{selectedMapNode.name}</strong> hasn't shared a scene with anyone.</div>
                                    <button style={{ ...sBtn, width: "100%", fontSize: 11, background: "#ef4444" }} onClick={() => { setPrompt(`Write a scene featuring ${selectedMapNode.name}.`); setMode("write"); setShowAgents(false); setShowRelMap(false); setSelectedMapNode(null); }}>✍️ Write scene with {selectedMapNode.name}</button>
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
                              {linkSuggestions.map((s, i) => (
                                <div key={i} style={{ background: co.accentBg, borderRadius: 8, padding: "7px 10px", fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ flex: 1 }}><strong>{s.characterName}</strong> + <strong>{s.targetName}</strong> — {s.coOccurrences} chapters</span>
                                  <button style={{ ...sBtn, padding: "3px 8px", fontSize: 10 }} onClick={() => confirmLink(s)}>Link</button>
                                  <button style={{ ...sBtnSm, padding: "3px 8px", fontSize: 10 }} onClick={() => setLinkSuggestions(prev => prev.filter((_, j) => j !== i))}>Skip</button>
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
                          {[["Characters", project.characters, openCharNew, openCharEdit, "characters"], ["Locations", project.locations, openLocNew, openLocEdit, "locations"], ["Plot Threads", project.plotThreads, openPlotNew, openPlotEdit, "plotThreads"]].map(([title, items, onNew, onEdit, key]) => (
                            <div key={key} style={{ marginBottom: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>{title} ({items.length})</span>
                                <button style={sBtnSm} onClick={onNew}>+ Add</button>
                              </div>
                              {items.map((item, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: co.accentBg, borderRadius: 8, padding: "6px 10px", fontSize: 12, margin: "3px 0", cursor: "pointer" }} onClick={() => onEdit(i)}>
                                  {item.status && <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.status === "Active" ? co.green : item.status === "Resolved" ? co.muted : co.orange, flexShrink: 0 }} />}
                                  <span style={{ flex: 1 }}><strong>{item.name}</strong>{item.role && <span style={{ color: co.muted, fontSize: 11 }}> · {item.role}</span>}</span>
                                  <span style={{ fontSize: 10, color: co.accent }}>edit</span>
                                  <button title={item.alwaysInContext === false ? "Minor — click to pin to AI context" : "Pinned to AI context — click to mark as minor"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0, color: item.alwaysInContext === false ? co.muted : co.accent }} onClick={e => { e.stopPropagation(); toggleAlwaysInContext(key, item, i); }}>{item.alwaysInContext === false ? "☆" : "★"}</button>
                                  <button style={{ background: "none", border: "none", color: co.danger, cursor: "pointer", fontSize: 13, padding: 0 }} onClick={e => { e.stopPropagation(); setConfirmModal({ msg: "Delete " + item.name + "?", action: async () => { await fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${item.id}`, { method: "DELETE" }); updateProject(p => ({ ...p, [key]: p[key].filter((_, j) => j !== i) })); setConfirmModal(null); } }); }}>x</button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </> : <>
                  {project.skillLevel === "expert" && <button style={{ ...sBtn, width: "100%", marginBottom: 12, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={suggestRefWorks}>{genTarget === "ref-suggest" ? "..." : "Suggest Reference Works"}</button>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Reference Works</span>
                    <button style={sBtnSm} onClick={() => { setNewRef({ title: "", attributes: {} }); setShowRefModal(true); }}>+ Add</button>
                  </div>
                  {project.referenceWorks.map((r, i) => (
                    <div key={i} style={{ background: co.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8, border: "1px solid " + co.border }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><strong style={{ fontSize: 13 }}>"{r.title}"</strong><button style={{ ...sBtnSm, background: "#fdeaea", color: co.danger }} onClick={async () => { await fetch(`/api/projects/${project.id}/reference-works/${r.id}`, { method: "DELETE" }); updateProject(p => ({ ...p, referenceWorks: p.referenceWorks.filter((_, j) => j !== i) })); }}>Remove</button></div>
                      {Object.entries(r.attributes || {}).map(([k, v]) => <div key={k} style={{ fontSize: 11, color: co.muted }}><span style={{ color: co.accent, fontWeight: 600 }}>{k}:</span> {v}</div>)}
                    </div>
                  ))}
                </>}
          </div>
          <div style={{ padding: 10, borderTop: "1px solid " + co.border, display: "flex", gap: 6 }}>
            <button style={{ ...sBtn, flex: 1 }} onClick={save}>{savedMsg || "Save"}</button>
            <button style={sBtnSm} onClick={exportAll}>Export</button>
          </div>
        </>}
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: co.surface, borderBottom: "1px solid " + co.border, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 4, background: co.surfaceAlt, borderRadius: 10, padding: 3 }}>
            {MODES.map(m => <button key={m} style={{ padding: "6px 16px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, background: mode === m ? co.accent : "transparent", color: mode === m ? "#fff" : co.muted }} onClick={() => setMode(m)}>{m === "brainstorm" ? "Brainstorm" : m === "outline" ? "Outline" : "Write"}</button>)}
          </div>
          <button style={{ ...sBtnSm, background: showAgents ? co.accentBg : co.surfaceAlt, color: showAgents ? co.accent : co.muted, fontWeight: showAgents ? 700 : 400, border: "1px solid " + (showAgents ? co.accent : co.border) }} onClick={() => { setShowAgents(v => !v); setPipelineResults([]); setShowComicStudio(false); setShowProductionStudio(false); }}>⚡ Agents</button>
          {isStoryFormat(project.format) && <button style={{ ...sBtnSm, background: showComicStudio ? co.accentBg : co.surfaceAlt, color: showComicStudio ? co.accent : co.muted, fontWeight: showComicStudio ? 700 : 400, border: "1px solid " + (showComicStudio ? co.accent : co.border) }} onClick={() => { setShowComicStudio(v => !v); setShowProductionStudio(false); setShowAgents(false); setPipelineResults([]); }}>🎨 Comics</button>}
          {isStoryFormat(project.format) && <button style={{ ...sBtnSm, background: showProductionStudio ? co.accentBg : co.surfaceAlt, color: showProductionStudio ? co.accent : co.muted, fontWeight: showProductionStudio ? 700 : 400, border: "1px solid " + (showProductionStudio ? co.accent : co.border) }} onClick={() => { setShowProductionStudio(v => !v); setShowComicStudio(false); setShowAgents(false); setPipelineResults([]); }}>🎬 Studio</button>}
          <div style={{ flex: 1 }} />
          {mode === "write" && <span style={{ fontSize: 11, color: co.muted, background: co.surfaceAlt, padding: "4px 10px", borderRadius: 6 }}>{wordCount} words | {totalWords} total</span>}
          {mode === "write" && undoStack.length > 0 && <button style={{ ...sBtnSm, background: "#fff3e0", color: "#e65100" }} onClick={undoGeneration}>Undo AI</button>}
          {(mode === "brainstorm" || mode === "outline") && streamText && <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 600 }} onClick={saveToNotes}>Save to Notes</button>}
        </div>
        {showAgents && (
          <div style={{ borderBottom: "1px solid " + co.border, background: co.surfaceAlt, padding: "12px 16px", maxHeight: 420, overflowY: "auto" }}>
            {pipelineResults.length === 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>Agent Pipelines — {project.format} / {mode}</div>
                {getPipelines(project.format, mode).length === 0
                  ? <div style={{ fontSize: 12, color: co.muted }}>No pipelines available for this format + mode combination.</div>
                  : getPipelines(project.format, mode).map(pipeline => (
                    <div key={pipeline.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: co.surface, borderRadius: 10, marginBottom: 8, border: "1px solid " + co.border }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{pipeline.name}</div>
                        <div style={{ fontSize: 11, color: co.muted, marginTop: 2 }}>{pipeline.description}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                          {pipeline.agents.map(a => <span key={a} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: co.accentBg, color: co.accent, fontWeight: 600 }}>{AGENT_LABELS[a]}</span>)}
                        </div>
                      </div>
                      <button style={{ ...sBtn, opacity: pipelineRunning || !prompt.trim() ? 0.5 : 1 }} disabled={pipelineRunning || !prompt.trim()} onClick={() => runPipeline(pipeline)}>
                        {pipelineRunning && activePipelineId === pipeline.id ? "Running..." : "Run ▶"}
                      </button>
                    </div>
                  ))}
                {!prompt.trim() && <div style={{ fontSize: 11, color: co.muted, marginTop: 8 }}>Type a prompt below first, then run a pipeline.</div>}
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Pipeline Results</div>
                  <button style={sBtnSm} onClick={() => { setPipelineResults([]); setExpandedAgent(null); }}>← Back</button>
                </div>
                {pipelineResults.map((r, i) => (
                  <div key={r.agent} style={{ marginBottom: 8, border: "1px solid " + co.border, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: co.surface, cursor: "pointer" }} onClick={() => setExpandedAgent(expandedAgent === r.agent ? null : r.agent)}>
                      <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{AGENT_LABELS[r.agent as keyof typeof AGENT_LABELS] ?? r.agent}</span>
                      <span style={{ fontSize: 10, color: co.muted }}>{expandedAgent === r.agent ? "▲" : "▼"}</span>
                    </div>
                    {expandedAgent === r.agent && (
                      <div style={{ padding: 12, background: co.surfaceAlt }}>
                        <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap", marginBottom: 10 }}>{r.output}</div>
                        {i === pipelineResults.length - 1 && (
                          <button style={sBtn} onClick={() => usePipelineOutput(r.output)}>Use Final Output</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {showComicStudio
          ? <ComicStudio project={project} higgsfieldKey={higgsfieldKey} onOpenStudio={() => { setShowComicStudio(false); setShowProductionStudio(true); }} />
          : showProductionStudio
          ? <ProductionStudio project={project} higgsfieldKey={higgsfieldKey} />
          : <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {mode === "write" && selectedText && (
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 110, zIndex: 50, display: "flex", gap: 4, background: co.surface, border: "1px solid " + co.border, borderRadius: 10, padding: "6px 8px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
              {proseLoading
                ? <span style={{ fontSize: 12, color: co.muted, padding: "4px 8px" }}>Generating...</span>
                : <>
                  <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("expand")}>✨ Expand</button>
                  <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("rewrite")}>🔄 Rewrite</button>
                  <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent, fontWeight: 700 }} onClick={() => runProse("show-dont-tell")}>👁 Show Don't Tell</button>
                  <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "0 4px" }} onClick={() => { setSelectedText(""); setSelectedRange(null); }}>×</button>
                </>}
            </div>
          )}
          {mode === "write" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "10px 24px 0" }}>
                <input style={{ background: "transparent", border: "none", fontSize: 20, fontWeight: 700, padding: 0, fontFamily: "Georgia,serif", color: co.text, outline: "none", width: "100%" }} value={activeChap.title} onChange={e => updateChapter("title", e.target.value)} />
              </div>
              {activeChap.summary && <div style={{ margin: "6px 24px", padding: "8px 12px", background: co.accentBg, borderRadius: 8, fontSize: 12, color: co.muted, borderLeft: "3px solid " + co.accent }}><strong style={{ color: co.accent }}>Continuity:</strong> {activeChap.summary}</div>}
              <textarea style={{ flex: 1, background: co.bg, padding: 24, overflow: "auto", fontSize: 15, lineHeight: 1.8, color: co.text, whiteSpace: "pre-wrap", outline: "none", fontFamily: "Georgia,serif", border: "none", resize: "none", boxSizing: "border-box" }} value={activeChap.content} onChange={e => updateChapter("content", e.target.value)} onSelect={handleTextareaSelect} onMouseUp={handleTextareaSelect} placeholder="Start writing..." />
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              {streamText ? <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 15 }}>{mode === "brainstorm" ? "Ask a what-if or describe what you need" : "Describe what to outline"}</div>}
            </div>
          )}
          <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface }}>
            {expandedPrompt ? <textarea style={{ ...sTextarea, flex: 1, minHeight: 80 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe in detail..." /> : <input style={{ ...sInput, flex: 1 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={mode === "brainstorm" ? "What if..." : mode === "outline" ? "Outline..." : "Write the next scene..."} onKeyDown={e => e.key === "Enter" && !generating && generate()} />}
            {["TikTok Script", "YouTube Short", "Instagram Reel"].includes(project.format) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button style={{ ...sBtnSm, opacity: hookScoring || !prompt.trim() ? 0.5 : 1 }} disabled={hookScoring || !prompt.trim()} onClick={scoreHook}>{hookScoring ? "Scoring..." : "Score Hook"}</button>
                {hookScore && (
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: hookScore.score >= 8 ? "#22c55e" : hookScore.score >= 5 ? "#eab308" : "#ef4444" }}>
                      {hookScore.score >= 8 ? "🟢" : hookScore.score >= 5 ? "🟡" : "🔴"} {hookScore.score}/10
                    </span>
                    <div style={{ fontSize: 10, color: co.muted, maxWidth: 100, lineHeight: 1.3, marginTop: 2 }}>{hookScore.feedback}</div>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} onClick={generate} disabled={generating}>{genTarget === "main" ? "..." : "Generate"}</button>
              <button style={{ padding: "2px 8px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, background: "transparent", color: co.muted }} onClick={() => setExpandedPrompt(!expandedPrompt)}>{expandedPrompt ? "Less" : "More"}</button>
            </div>
          </div>
        </div>}
      </div>

      {/* RIGHT */}
      <div style={{ width: rightCollapsed ? 48 : 240, minWidth: rightCollapsed ? 48 : 240, background: co.surface, borderLeft: "1px solid " + co.border, display: "flex", flexDirection: "column", transition: "all 0.2s", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 10px", borderBottom: "1px solid " + co.border }}>
          <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14, padding: "4px" }} onClick={() => setRightCollapsed(!rightCollapsed)}>{rightCollapsed ? "◀" : "▶"}</button>
          {!rightCollapsed && <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>Chapters</span>}
        </div>
        {!rightCollapsed && <>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {project.chapters.map((ch, i) => (
              <div key={ch.id} style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, background: ch.id === project.activeChapter ? co.accentBg : "transparent", color: ch.id === project.activeChapter ? co.accent : co.muted, display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: ch.id === project.activeChapter ? 600 : 400 }} onClick={() => updateProject(p => ({ ...p, activeChapter: ch.id }))}>
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

      {/* MODALS - Entity modals for char/loc/plot */}
      {[
        [showCharModal, setShowCharModal, editCharIdx !== null ? "Edit Character" : "Create Character", CharFields, newChar, setNewChar, charGenPrompt, setCharGenPrompt, saveChar, "char", generateChar, improveChar],
        [showLocModal, setShowLocModal, editLocIdx !== null ? "Edit Location" : "Add Location", LocFields, newLoc, setNewLoc, locGenPrompt, setLocGenPrompt, saveLoc, "loc", generateLoc, improveLoc],
        [showPlotModal, setShowPlotModal, editPlotIdx !== null ? "Edit Plot Thread" : "Add Plot Thread", PlotFields, newPlot, setNewPlot, plotGenPrompt, setPlotGenPrompt, savePlot, "plot", generatePlot, improvePlot],
      ].map(([show, setShow, title, fields, data, setData, gp, setGp, onSave, tKey, genFn, improveFn], mi) => show && (
        <div key={mi} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShow(false)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 540, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800 }}>{title}</h3>
            {mi === 0 && isStoryFormat(project.format) && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: 12, background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border }}>
                {newChar.portraitUrl
                  ? <img src={newChar.portraitUrl} alt="portrait" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 80, height: 80, borderRadius: 8, background: co.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🎨</div>}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Character Portrait</div>
                  <button style={{ ...sBtnSm, opacity: (portraitLoading || !newChar.appearance) ? 0.5 : 1 }} disabled={portraitLoading || !newChar.appearance} onClick={() => editCharIdx !== null && generatePortrait(editCharIdx)}>
                    {portraitLoading ? "Generating..." : newChar.portraitUrl ? "Regenerate" : "Generate Portrait"}
                  </button>
                  {!newChar.appearance && <div style={{ fontSize: 10, color: co.muted, marginTop: 4 }}>Add appearance first</div>}
                </div>
              </div>
            )}
            <div style={{ background: co.accentBg, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 6 }}>AI GENERATE</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={sInput} placeholder="Describe..." value={gp} onChange={e => setGp(e.target.value)} onKeyDown={e => e.key === "Enter" && genFn()} />
                <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={genFn}>{genTarget === tKey ? "..." : "New"}</button>
              </div>
              {data.name && <button style={{ padding: "5px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, background: "#f0e6ff", color: "#7c3aed", width: "100%", marginTop: 8, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={improveFn}>{genTarget === tKey ? "Improving..." : "AI Improve"}</button>}
            </div>
            {fields.map(([key, label, type]) => <div key={key} style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: co.muted, marginBottom: 2, display: "block", fontWeight: 600 }}>{label}</span>{type === "input" ? <input style={sInput} value={data[key] || ""} onChange={e => setData(d => ({ ...d, [key]: e.target.value }))} /> : <textarea style={sTextarea} rows={2} value={data[key] || ""} onChange={e => setData(d => ({ ...d, [key]: e.target.value }))} />}</div>)}
            {tKey === "plot" && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: co.muted, marginBottom: 2, display: "block", fontWeight: 600 }}>Status</span><select style={sInput} value={newPlot.status} onChange={e => setNewPlot(t => ({ ...t, status: e.target.value }))}><option>Active</option><option>Simmering</option><option>Resolved</option></select></div>}
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
              <input style={{ ...sInput, flex: 1 }} placeholder='"The Shining"' value={newRef.title} onChange={e => setNewRef(r => ({ ...r, title: e.target.value }))} />
              <button style={{ ...sBtn, opacity: generating ? 0.5 : 1 }} disabled={generating} onClick={analyzeRefWork}>{genTarget === "ref" ? "..." : "Analyze"}</button>
            </div>
            {Object.keys(newRef.attributes).length > 0 && STYLE_ATTRS.map(a => <div key={a} style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: co.muted, marginBottom: 2, display: "block", fontWeight: 600 }}>{a}</span><input style={sInput} value={newRef.attributes[a] || ""} onChange={e => setNewRef(r => ({ ...r, attributes: { ...r.attributes, [a]: e.target.value } }))} /></div>)}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button style={sBtnSm} onClick={() => setShowRefModal(false)}>Cancel</button>
              <button style={sBtn} disabled={!newRef.title || !Object.keys(newRef.attributes).length} onClick={async () => { const res = await fetch(`/api/projects/${project.id}/reference-works`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRef) }); const created = await res.json(); updateProject(p => ({ ...p, referenceWorks: [...p.referenceWorks, created] })); setShowRefModal(false); }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Prose Result Modal */}
      {proseResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setProseResult(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 600, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{proseResult.mode === "expand" ? "✨ Expanded" : proseResult.mode === "rewrite" ? "🔄 Rewrites" : "👁 Show Don't Tell"}</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setProseResult(null)}>×</button>
            </div>
            {proseResult.mode === "rewrite" && proseResult.variants ? (
              <>
                <div style={{ fontSize: 11, color: co.muted, marginBottom: 12 }}>Select a variant to use:</div>
                {proseResult.variants.map((v, i) => (
                  <div key={i} onClick={() => setProseResult(r => r ? { ...r, chosen: i } : r)} style={{ padding: 14, borderRadius: 10, marginBottom: 8, border: "2px solid " + (proseResult.chosen === i ? co.accent : co.border), cursor: "pointer", background: proseResult.chosen === i ? co.accentBg : co.surfaceAlt, fontSize: 14, lineHeight: 1.7, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: proseResult.chosen === i ? co.accent : co.muted, marginBottom: 6 }}>VARIANT {i + 1}</div>
                    {v}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                  <button style={sBtnSm} onClick={() => setProseResult(null)}>Discard</button>
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

      {/* Confirm Dialog */}
      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{confirmModal.msg}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={sBtnSm} onClick={() => setConfirmModal(null)}>Cancel</button>
              <button style={{ ...sBtn, background: co.danger }} onClick={confirmModal.action}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}