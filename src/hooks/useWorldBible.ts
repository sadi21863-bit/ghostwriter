"use client";
import { useState } from "react";

export function useWorldBible({
  project, updateProject, setProject, setErrorMsg,
}: {
  project: any; updateProject: (fn: any) => void; setProject: (fn: any) => void; setErrorMsg: (msg: string | null) => void;
}) {
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<any[]>([]);
  const [suggestingLinks, setSuggestingLinks] = useState(false);
  const [quickStartLoading, setQuickStartLoading] = useState(false);

  const generatePortrait = async (charIdx: number): Promise<string | null> => {
    if (portraitLoading) return null;
    const char = project.characters[charIdx];
    if (!char?.appearance) return null;
    setPortraitLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${char.id}/portrait`, { method: "POST" });
      const data = await res.json();
      if (data.portraitUrl) {
        updateProject((p: any) => ({
          ...p, characters: p.characters.map((c: any, i: number) => i === charIdx ? { ...c, portraitUrl: data.portraitUrl } : c),
        }));
        setPortraitLoading(false);
        return data.portraitUrl;
      }
    } catch (e) { setErrorMsg("Portrait generation failed. Check your Higgsfield API key."); }
    setPortraitLoading(false);
    return null;
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
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: suggestion.type, characterId: suggestion.characterId, targetId: suggestion.targetId }),
    });
    setLinkSuggestions(prev => prev.filter((s: any) => !(s.characterId === suggestion.characterId && s.targetId === suggestion.targetId)));
  };

  const quickStartStory = async (onSuccess: (outline: string) => void, setSavedMsg: (m: string) => void) => {
    if (quickStartLoading) return;
    setQuickStartLoading(true);
    try {
      const res = await fetch(`/api/ai/quick-start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, title: project.name, format: project.format, genres: project.genres }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.outline || "Story skeleton generated! Check your World Bible.");
        const projRes = await fetch("/api/projects/" + project.id);
        const updated = await projRes.json();
        setProject({ ...updated, activeChapter: updated.chapters?.[0]?.id || null });
        setSavedMsg("Story generated!");
        setTimeout(() => setSavedMsg(""), 2000);
      }
    } catch (e) { setErrorMsg("Story generation failed. Please try again."); }
    setQuickStartLoading(false);
  };

  return {
    portraitLoading,
    linkSuggestions, setLinkSuggestions,
    suggestingLinks,
    quickStartLoading,
    generatePortrait, suggestLinks, confirmLink, quickStartStory,
  };
}
