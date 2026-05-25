"use client";
import { useState, useEffect, useRef } from "react";
import { isCreatorFormat, getChapterLabel } from "@/lib/formats";

export function useProjectState(projectId: string) {
  const [project, setProject] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [storyMemories, setStoryMemories] = useState<any[]>([]);
  const [creatorBible, setCreatorBible] = useState<any>(null);
  const [higgsfieldKey, setHiggsfieldKey] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<any>(null);

  const chapterSaveTimer = useRef<any>(null);
  const bibleSaveTimer = useRef<any>(null);

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

  useEffect(() => {
    fetch("/api/projects/" + projectId)
      .then(r => { if (!r.ok) throw new Error("Failed to load project"); return r.json(); })
      .then(data => setProject({ ...data, activeChapter: data.chapters?.[0]?.id || null }))
      .catch(() => setLoadError("Failed to load project. Please refresh."));
  }, [projectId]);

  const updateProject = (fn: any) => setProject((p: any) => typeof fn === "function" ? fn(p) : fn);

  const updateChapter = (f: string, v: any) => {
    updateProject((p: any) => ({ ...p, chapters: p.chapters.map((c: any) => c.id === p.activeChapter ? { ...c, [f]: v } : c) }));
    const chapId = project.activeChapter;
    const projId = project.id;
    clearTimeout(chapterSaveTimer.current);
    chapterSaveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${projId}/chapters/${chapId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [f]: v }),
      }).then(() => {
        if (f === "content" && v && v.trim().split(/\s+/).length > 200) {
          fetch(`/api/ai/summarize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: v }) })
            .then(r => r.json())
            .then(data => {
              if (data.summary) {
                fetch(`/api/projects/${projId}/chapters/${chapId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: data.summary }) });
                updateProject((p: any) => ({ ...p, chapters: p.chapters.map((c: any) => c.id === chapId ? { ...c, summary: data.summary } : c) }));
              }
            }).catch(() => {});
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
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }),
      }).catch(() => { setErrorMsg("Failed to save Creator Bible changes."); });
    }, 1500);
  };

  const save = async () => {
    try {
      await fetch("/api/projects/" + project.id, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: project.name, format: project.format, genres: project.genres, notes: project.notes }),
      });
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
      project.chapters.forEach((c: any) => { txt += `── ${label.toUpperCase()}: ${c.title} ──\n\n${c.content || "(empty)"}\n\n`; });
    } else {
      txt += `# ${project.name}\n${project.format} | ${project.genres.join(", ")}\n\n`;
      project.chapters.forEach((c: any) => { txt += `## ${c.title}\n\n${c.content || "(empty)"}\n\n`; });
    }
    navigator.clipboard.writeText(txt);
    setSavedMsg("Copied"); setTimeout(() => setSavedMsg(""), 1500);
  };

  const addChapter = async () => {
    const label = getChapterLabel(project.format);
    const title = label + " " + (project.chapters.length + 1);
    const res = await fetch(`/api/projects/${project.id}/chapters`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, sortOrder: project.chapters.length }),
    });
    const newChap = await res.json();
    updateProject((p: any) => ({ ...p, chapters: [...p.chapters, newChap], activeChapter: newChap.id }));
  };

  const deleteChapter = (id: string) => {
    if (project.chapters.length <= 1) return;
    setConfirmModal({
      msg: "Delete this chapter?", action: async () => {
        await fetch(`/api/projects/${project.id}/chapters/${id}`, { method: "DELETE" });
        updateProject((p: any) => { const f = p.chapters.filter((c: any) => c.id !== id); return { ...p, chapters: f, activeChapter: f[0].id }; });
        setConfirmModal(null);
      },
    });
  };

  const moveChapter = async (i: number, dir: number) => {
    const ni = i + dir;
    if (ni < 0 || ni >= project.chapters.length) return;
    const updated = [...project.chapters];
    [updated[i], updated[ni]] = [updated[ni], updated[i]];
    await Promise.all([
      fetch(`/api/projects/${project.id}/chapters/${updated[i].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) }),
      fetch(`/api/projects/${project.id}/chapters/${updated[ni].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: ni }) }),
    ]);
    updateProject((p: any) => ({ ...p, chapters: updated }));
  };

  const toggleGenre = (g: string) =>
    updateProject((p: any) => ({ ...p, genres: p.genres.includes(g) ? p.genres.filter((x: any) => x !== g) : [...p.genres, g] }));

  const toggleAlwaysInContext = async (key: string, item: any, i: number) => {
    const apiPath: Record<string, string> = { characters: "characters", locations: "locations", plotThreads: "plot-threads" };
    const newVal = item.alwaysInContext === false;
    fetch(`/api/projects/${project.id}/${apiPath[key]}/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alwaysInContext: newVal }),
    }).catch(() => { setErrorMsg("Failed to update context priority."); });
    updateProject((p: any) => ({ ...p, [key]: p[key].map((e: any, j: number) => j === i ? { ...e, alwaysInContext: newVal } : e) }));
  };

  return {
    project, setProject, loadError,
    savedMsg, setSavedMsg,
    storyMemories, setStoryMemories,
    creatorBible, setCreatorBible,
    higgsfieldKey,
    errorMsg, setErrorMsg,
    confirmModal, setConfirmModal,
    updateProject, updateChapter, updateCreatorBible,
    save, exportAll, addChapter, deleteChapter, moveChapter, toggleGenre, toggleAlwaysInContext,
  };
}
