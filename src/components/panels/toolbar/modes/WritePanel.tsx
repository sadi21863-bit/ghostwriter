"use client";
import { useRef, useState, useEffect } from "react";
import { getLoadingMessage } from "@/lib/loadingMessages";
import { co, sInput, sTextarea, sBtn, sBtnSm } from "@/lib/styles";
import { toast } from '@/lib/toast';
import { ProsePanel } from "../tools/ProsePanel";
import { ScoreHookPanel } from "../tools/ScoreHookPanel";
import { TitleHookPanel } from "../tools/TitleHookPanel";
import type { HookScore, ProseResult } from "../types";
import { SlashCommandPalette } from "@/components/editor/SlashCommandPalette";
import type { SlashCommandId } from "@/lib/slash-commands";
import { appendToTipTap } from "@/hooks/ai-shared";
import { suggestSkill } from "@/lib/ai/skill-router";
import type { SkillSuggestion } from "@/lib/ai/skill-router";
import { EMOTIONAL_TONES, ARC_POSITIONS } from "@/lib/arc";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { SceneView } from "@/components/editor/SceneView";
import type { Scene } from "@/types";
import { isStoryFormat, isCreatorFormat } from "@/lib/formats";
import { CAMERA_PRESETS, VIRAL_PRESETS } from "@/lib/higgsfield/presets";
import { parseBeatList } from "@/lib/modes/beats";

function parseBrainstormOptions(text: string): { label: string; name: string; content: string }[] | null {
  const headerRe = /OPTION\s+([A-C])\s+[-—–]\s+([^\n:]+)/gi;
  const headers: { label: string; name: string; pos: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    headers.push({ label: m[1], name: m[2].trim(), pos: m.index });
  }
  if (headers.length < 3) return null;
  return headers.slice(0, 3).map((h, i) => {
    const start = text.indexOf('\n', h.pos) + 1;
    const end = i + 1 < 3 ? headers[i + 1].pos : text.length;
    return { label: h.label, name: h.name, content: text.slice(start, end).trim() };
  });
}

interface Props {
  mode: string;
  project: any;
  activeChap: any;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  genTarget: string;
  streamText: string;
  setStreamText: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  expandedPrompt: boolean;
  setExpandedPrompt: (v: boolean) => void;
  selectedText: string;
  setSelectedText: (v: string) => void;
  setSelectedRange: (v: any) => void;
  proseLoading: boolean;
  proseResult: ProseResult | null;
  setProseResult: (v: ProseResult | null) => void;
  runProse: (mode: string) => Promise<void>;
  replaceSelection: (text: string) => void;
  hookScore: HookScore | null;
  hookScoring: boolean;
  scoreHook: () => Promise<void>;
  generate: (opts?: { cameraPresetId?: string; referencePassage?: string; additionalContext?: string }) => Promise<void>;
  expandBeat: (beatText: string) => Promise<void>;
  cohostVoice: string;
  setCohostVoice: (v: string) => void;
  handleTextareaSelect?: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onUpgradeRequired?: (feature: string) => void;
  onSlashCommand?: (id: SlashCommandId) => void;
  skillSuggestion?: SkillSuggestion | null;
  onSkillSuggestionChange?: (s: SkillSuggestion | null) => void;
  onDismissSkillSuggestion?: () => void;
  onAcceptSkillSuggestion?: (mode: string) => void;
  insertIntoEditor?: (text: string) => void;
}

export function WritePanel({
  mode, project, activeChap, updateChapter,
  generating, genTarget, streamText, setStreamText,
  prompt, setPrompt, expandedPrompt, setExpandedPrompt,
  selectedText, setSelectedText, setSelectedRange,
  proseLoading, proseResult, setProseResult, runProse, replaceSelection,
  hookScore, hookScoring, scoreHook,
  generate, expandBeat, cohostVoice, setCohostVoice, onUpgradeRequired, onSlashCommand,
  skillSuggestion, onSkillSuggestionChange, onDismissSkillSuggestion, onAcceptSkillSuggestion,
  insertIntoEditor,
}: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [slashOpen, setSlashOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'document' | 'scenes'>('document');
  const [cameraMode, setCameraMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referencePassage, setReferencePassage] = useState("");
  const [researchFirst, setResearchFirst] = useState(true);
  const [researchBrief, setResearchBrief] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchExpanded, setResearchExpanded] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceDirectives, setReferenceDirectives] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [expandedBeats, setExpandedBeats] = useState<Set<number>>(new Set());
  const [expandingBeatIndex, setExpandingBeatIndex] = useState<number | null>(null);
  const [expandingBeats, setExpandingBeats] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSlashOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const updateArcTag = async (field: 'arcPosition' | 'emotionalTone', value: string) => {
    updateChapter(field, value);
    if (!activeChap?.id || !project?.id) return;
    try {
      await fetch(`/api/projects/${project.id}/chapters/${activeChap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch { /* silent */ }
  };

  const handleExpandBeat = async (beat: string, index: number) => {
    setExpandingBeatIndex(index);
    try {
      await expandBeat(beat);
      setExpandedBeats(prev => new Set([...prev, index]));
    } catch {
      toast.error('Expansion failed');
    } finally {
      setExpandingBeatIndex(null);
    }
  };

  const handleExpandAllBeats = async (beats: string[]) => {
    setExpandingBeats(true);
    for (let i = 0; i < beats.length; i++) {
      if (expandedBeats.has(i)) continue;
      await handleExpandBeat(beats[i], i);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setExpandingBeats(false);
  };

  const handleEditorChange = (json: string, wordCount: number) => {
    updateChapter('content', json);
    updateChapter('wordCount', wordCount);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!activeChap?.id || !project?.id) return;
      try {
        await fetch(`/api/projects/${project.id}/chapters/${activeChap.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: json, wordCount }),
        });
      } catch { /* silent */ }
    }, 1500);
  };

  const handleScenesChange = (scenes: Scene[]) => {
    updateChapter('scenes', scenes);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!activeChap?.id || !project?.id) return;
      try {
        await fetch(`/api/projects/${project.id}/chapters/${activeChap.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenes }),
        });
      } catch { /* silent */ }
    }, 1500);
  };

  const handleAnalyzeVideo = async () => {
    if (!referenceUrl.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze-reference-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: referenceUrl }),
      });
      const data = await res.json();
      if (data.directives) setReferenceDirectives(data.directives);
    } catch { /* silent */ }
    finally { setIsAnalyzing(false); }
  };

  const viewToggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11,
    background: active ? co.surface : 'transparent',
    color: active ? co.text : co.muted,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Prose floating toolbar + modal */}
      <ProsePanel
        mode={mode}
        selectedText={selectedText}
        setSelectedText={setSelectedText}
        setSelectedRange={setSelectedRange}
        proseLoading={proseLoading}
        proseResult={proseResult}
        setProseResult={setProseResult}
        runProse={runProse}
        replaceSelection={replaceSelection}
      />

      {/* Write mode — editor */}
      {mode === "write" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 24px 0" }}>
            <input
              style={{ background: "transparent", border: "none", fontSize: 20, fontWeight: 700, padding: 0, fontFamily: "Georgia,serif", color: co.text, outline: "none", width: "100%" }}
              value={activeChap.title}
              onChange={e => updateChapter("title", e.target.value)}
            />
          </div>

          {/* Arc tags + view toggle */}
          <div style={{ display: 'flex', gap: 8, padding: '6px 24px', flexShrink: 0, alignItems: 'center' }}>
            <select
              value={activeChap.arcPosition ?? ''}
              onChange={e => updateArcTag('arcPosition', e.target.value)}
              style={{ fontSize: 11, padding: '3px 8px', background: co.surface, border: '1px solid ' + co.border, borderRadius: 6, color: activeChap.arcPosition ? co.text : co.muted, cursor: 'pointer' }}
            >
              <option value="">Arc position...</option>
              {ARC_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={activeChap.emotionalTone ?? ''}
              onChange={e => updateArcTag('emotionalTone', e.target.value)}
              style={{ fontSize: 11, padding: '3px 8px', background: co.surface, border: '1px solid ' + co.border, borderRadius: 6, color: activeChap.emotionalTone ? co.text : co.muted, cursor: 'pointer' }}
            >
              <option value="">Emotional tone...</option>
              {EMOTIONAL_TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* View toggle */}
            <div style={{ marginLeft: 'auto', display: 'flex', background: co.surfaceAlt, borderRadius: 6, padding: 2 }}>
              <button onClick={() => setViewMode('document')} style={viewToggleStyle(viewMode === 'document')}>Document</button>
              <button onClick={() => setViewMode('scenes')} style={viewToggleStyle(viewMode === 'scenes')}>Scenes</button>
            </div>
          </div>

          {activeChap.summary && (
            <div style={{ margin: "6px 24px", padding: "8px 12px", background: co.accentBg, borderRadius: 8, fontSize: 12, color: co.muted, borderLeft: "3px solid " + co.accent }}>
              <strong style={{ color: co.accent }}>Continuity:</strong> {activeChap.summary}
            </div>
          )}

          {viewMode === 'document' ? (
            <ChapterEditor
              content={activeChap.content ?? ''}
              onChange={handleEditorChange}
              placeholder="Begin writing..."
              autoFocus
            />
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
              <SceneView
                scenes={activeChap.scenes ?? []}
                characters={project.characters ?? []}
                onScenesChange={handleScenesChange}
              />
            </div>
          )}
        </div>
      ) : mode === "cohost" ? (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {streamText ? (
            <div>
              {streamText.split("\n").map((line: string, i: number) => (
                <div key={i} style={{
                  marginBottom: line.startsWith("[CO-HOST]") || line.startsWith("[HOST TALKING POINTS]") ? 8 : 2,
                  fontWeight: line.startsWith("[CO-HOST]") || line.startsWith("[HOST TALKING POINTS]") ? 700 : 400,
                  color: line.startsWith("[CO-HOST]") ? co.accent : co.text,
                  fontSize: 14, lineHeight: 1.7, fontFamily: "system-ui",
                }}>{line}</div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8, color: co.muted }}>
              <div style={{ fontSize: 15 }}>Co-host Simulator</div>
              <div style={{ fontSize: 12 }}>Output shows [CO-HOST] questions + [HOST TALKING POINTS] bullets — your recording guide.</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {streamText ? (
            (() => {
              const opts = mode === 'brainstorm' ? parseBrainstormOptions(streamText) : null;
              if (opts) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, color: co.muted, marginBottom: 4 }}>Choose a direction to develop:</div>
                    {opts.map((opt, i) => (
                      <div key={i} onClick={() => setSelectedOption(selectedOption === i ? null : i)} style={{
                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${selectedOption === i ? co.accent : co.border}`,
                        background: selectedOption === i ? co.accentBg : co.surface,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: co.accent, marginBottom: 6 }}>
                          OPTION {opt.label} — {opt.name}
                        </div>
                        <div style={{ fontSize: 13, color: co.text, lineHeight: 1.6 }}>{opt.content}</div>
                        {selectedOption === i && (
                          <button style={{ ...sBtn, marginTop: 10, fontSize: 12 }} onClick={e => {
                            e.stopPropagation();
                            setPrompt(`Develop: ${opt.name}`);
                            setStreamText('');
                            setSelectedOption(null);
                          }}>
                            Develop this direction →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
              const beats = mode === 'outline' ? parseBeatList(streamText) : null;
              if (beats) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 12, color: co.muted }}>{beats.length} beats generated</div>
                      <button
                        onClick={() => handleExpandAllBeats(beats)}
                        disabled={expandingBeats}
                        style={{ ...sBtnSm, fontSize: 11, opacity: expandingBeats ? 0.6 : 1, cursor: expandingBeats ? 'default' : 'pointer' }}
                      >
                        {expandingBeats ? 'Expanding...' : 'Expand all to draft →'}
                      </button>
                    </div>
                    {beats.map((beat, i) => (
                      <div key={i} style={{
                        padding: '10px 12px', borderRadius: 8,
                        background: expandedBeats.has(i) ? co.accentBg : co.surface,
                        border: `1px solid ${expandedBeats.has(i) ? co.accent : co.border}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: co.muted, marginRight: 6 }}>BEAT {i + 1}</span>
                            <span style={{ fontSize: 12, color: co.text }}>{beat}</span>
                          </div>
                          {!expandedBeats.has(i) && (
                            <button
                              onClick={() => handleExpandBeat(beat, i)}
                              disabled={expandingBeatIndex === i}
                              style={{ ...sBtnSm, marginLeft: 8, flexShrink: 0, fontSize: 10, opacity: expandingBeatIndex === i ? 0.6 : 1, cursor: expandingBeatIndex === i ? 'default' : 'pointer' }}
                            >
                              {expandingBeatIndex === i ? '...' : 'Expand →'}
                            </button>
                          )}
                          {expandedBeats.has(i) && (
                            <span style={{ fontSize: 10, color: co.green, marginLeft: 8, flexShrink: 0 }}>✓ Added</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia,serif" }}>{streamText}</div>;
            })()
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.muted, fontSize: 15 }}>
              {mode === "brainstorm" ? "Ask a what-if or describe what you need" : "Describe what to outline"}
            </div>
          )}
        </div>
      )}

      {/* Co-host insert bar */}
      {mode === "cohost" && streamText && !generating && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, justifyContent: "flex-end", background: co.surfaceAlt, flexShrink: 0 }}>
          <button style={sBtnSm} onClick={() => setStreamText("")}>Discard</button>
          <button style={sBtn} onClick={() => {
            if (insertIntoEditor) { insertIntoEditor(streamText); } else { updateChapter("content", appendToTipTap(activeChap?.content || "", streamText)); }
            setStreamText("");
          }}>Insert into Chapter</button>
        </div>
      )}

      <SlashCommandPalette
        open={slashOpen}
        onClose={() => setSlashOpen(false)}
        onSelect={(id) => { onSlashCommand?.(id); setSlashOpen(false); }}
      />

      {/* Skill suggestion banner */}
      {skillSuggestion && (
        <div style={{
          margin: '0 16px 8px', padding: '10px 14px',
          background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ flex: 1, fontSize: 12, color: '#9898A6', lineHeight: 1.5 }}>
            <strong style={{ color: '#F2F2F3' }}>{skillSuggestion.label} suggested</strong>
            {' — '}{skillSuggestion.reason}
          </span>
          <button
            onClick={() => onAcceptSkillSuggestion?.(skillSuggestion.mode)}
            style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.4)', borderRadius: 6, color: '#D97706', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
          >
            Switch
          </button>
          <button
            onClick={onDismissSkillSuggestion}
            style={{ fontSize: 11, padding: '4px 8px', background: 'transparent', border: 'none', color: '#9898A6', cursor: 'pointer', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Research-before-script — creator formats brainstorm/outline only */}
      {(mode === "brainstorm" || mode === "outline") && isCreatorFormat(project.format) && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, background: co.surfaceAlt }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={researchFirst} onChange={e => setResearchFirst(e.target.checked)} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: co.text }}>Research before scripting</div>
              <div style={{ fontSize: 11, color: co.muted }}>Finds audience questions, content gaps, and trending angles first.</div>
            </div>
          </label>
          {researchBrief && (
            <div style={{
              marginTop: 8, padding: '8px 10px',
              background: 'rgba(29,158,117,0.05)',
              border: '1px solid rgba(29,158,117,0.15)',
              borderRadius: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: co.accent }}>
                  ✓ Research brief ready
                </span>
                <button
                  onClick={() => setResearchExpanded(e => !e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                           fontSize: 10, color: co.muted }}
                >
                  {researchExpanded ? 'Hide ▲' : 'View ▼'}
                </button>
              </div>
              {researchExpanded && (
                <div style={{
                  marginTop: 6, fontSize: 11, color: co.muted,
                  whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto',
                }}>
                  {researchBrief}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* YouTube reference video — creator formats brainstorm only */}
      {mode === "brainstorm" && isCreatorFormat(project.format) && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, background: co.surfaceAlt }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: co.text, marginBottom: 6 }}>Reference video (optional)</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={referenceUrl}
              onChange={e => setReferenceUrl(e.target.value)}
              placeholder="YouTube URL — AI will analyze structure + style"
              style={{ ...sInput, flex: 1, fontSize: 11 }}
            />
            <button
              onClick={handleAnalyzeVideo}
              disabled={isAnalyzing || !referenceUrl.trim()}
              style={{ ...sBtnSm, opacity: isAnalyzing || !referenceUrl.trim() ? 0.5 : 1, flexShrink: 0 }}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze"}
            </button>
          </div>
          {referenceDirectives && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: co.surface, borderRadius: 6, fontSize: 11, color: co.muted, maxHeight: 80, overflowY: "auto", border: "1px solid " + co.border }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: co.accent }}>Video analyzed ✓</div>
              {referenceDirectives.slice(0, 200)}...
            </div>
          )}
        </div>
      )}

      {/* Write like this — reference passage */}
      {(mode === "write" || mode === "brainstorm") && (
        <div style={{ padding: "6px 16px", borderTop: "1px solid " + co.border, background: co.surfaceAlt }}>
          <button
            onClick={() => setReferenceOpen(p => !p)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: co.muted, display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}
          >
            <span>{referenceOpen ? "▾" : "▸"}</span>
            Write like a specific passage (optional)
          </button>
          {referenceOpen && (
            <textarea
              value={referencePassage}
              onChange={e => setReferencePassage(e.target.value)}
              placeholder="Paste a passage you want to write like. The AI will extract its specific craft techniques and apply them — different from Style DNA which applies general work principles."
              rows={4}
              style={{ ...sTextarea, fontSize: 11, marginTop: 6, width: "100%", boxSizing: "border-box" }}
            />
          )}
        </div>
      )}

      {/* Camera language section — story formats only */}
      {isStoryFormat(project.format) && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid " + co.border, background: co.surfaceAlt }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={cameraMode} onChange={e => { setCameraMode(e.target.checked); if (!e.target.checked) setSelectedPreset(""); }} />
            <span style={{ fontSize: 12, color: co.muted }}>Generate with camera language</span>
          </label>
          {cameraMode && (
            <select
              value={selectedPreset}
              onChange={e => setSelectedPreset(e.target.value)}
              style={{ marginTop: 6, fontSize: 11, width: "100%", ...sInput }}
            >
              <option value="">No specific preset</option>
              <optgroup label="Camera Presets">
                {Object.values(CAMERA_PRESETS).map(p => (
                  <option key={p.id} value={p.id}>{p.label} — {p.description}</option>
                ))}
              </optgroup>
              <optgroup label="Viral Presets">
                {Object.values(VIRAL_PRESETS).map(p => (
                  <option key={p.id} value={p.id}>{p.label} — {p.description}</option>
                ))}
              </optgroup>
            </select>
          )}
        </div>
      )}

      {/* Prompt bar */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid " + co.border, display: "flex", gap: 8, background: co.surface }}>
        {mode === "cohost" && (
          <select style={{ ...sInput, width: 180, flexShrink: 0 }} value={cohostVoice} onChange={e => setCohostVoice(e.target.value)}>
            <option value="curious_generalist">Curious Generalist</option>
            <option value="skeptical_expert">Skeptical Expert</option>
            <option value="enthusiastic_newcomer">Enthusiastic Newcomer</option>
          </select>
        )}
        {expandedPrompt
          ? <textarea style={{ ...sTextarea, flex: 1, minHeight: 80 }} value={prompt} onChange={e => {
              setPrompt(e.target.value);
              onSkillSuggestionChange?.(suggestSkill(e.target.value, mode));
            }} placeholder="Describe in detail..." />
          : <input
              style={{ ...sInput, flex: 1 }}
              value={prompt}
              onChange={e => {
                setPrompt(e.target.value);
                onSkillSuggestionChange?.(suggestSkill(e.target.value, mode));
              }}
              placeholder={
                mode === "cohost" ? "Episode topic or segment to simulate..."
                : mode === "brainstorm" ? "What if..."
                : mode === "outline" ? "Outline..."
                : "Write the next scene..."
              }
              onKeyDown={e => e.key === "Enter" && !generating && generate()}
            />
        }

        <TitleHookPanel
          format={project.format}
          mode={mode}
          prompt={prompt}
          topic={activeChap.title}
          setSavedMsg={() => {}}
          onUpgradeRequired={onUpgradeRequired}
        />

        <ScoreHookPanel
          format={project.format}
          prompt={prompt}
          hookScore={hookScore}
          hookScoring={hookScoring}
          scoreHook={scoreHook}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button style={{ ...sBtn, opacity: generating || researching ? 0.5 : 1 }} disabled={generating || researching} onClick={async () => {
            let researchContext = '';
            if ((mode === 'brainstorm' || mode === 'outline') && isCreatorFormat(project.format) && researchFirst && prompt.trim()) {
              setResearching(true);
              try {
                const res = await fetch('/api/ai/creator-research', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ topic: prompt, format: project.format }),
                });
                const data = await res.json();
                if (data.researchBrief) { researchContext = data.researchBrief; setResearchBrief(data.researchBrief); }
              } catch { /* research failure must never block generation */ }
              finally { setResearching(false); }
            }
            const extraCtx = [referenceDirectives, researchContext].filter(Boolean).join('\n\n');
            generate({ cameraPresetId: cameraMode && selectedPreset ? selectedPreset : undefined, referencePassage: referencePassage.trim() || undefined, additionalContext: extraCtx || undefined });
          }}>
            {generating && genTarget === "main" ? getLoadingMessage(mode) : "Generate"}
          </button>
          <button style={{ padding: "2px 8px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, background: "transparent", color: co.muted }} onClick={() => setExpandedPrompt(!expandedPrompt)}>
            {expandedPrompt ? "Less" : "More"}
          </button>
        </div>
      </div>
    </div>
  );
}
