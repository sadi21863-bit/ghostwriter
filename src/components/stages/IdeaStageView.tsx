// src/components/stages/IdeaStageView.tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sTextarea } from "@/lib/styles";
import { isCreatorFormat } from "@/lib/formats";
import { TrendNichePanel } from "@/components/panels/toolbar/tools/TrendNichePanel";
import { TrendAnglesPanel } from "@/components/panels/toolbar/tools/TrendAnglesPanel";
import { ChannelAutopsyPanel } from "@/components/panels/toolbar/tools/ChannelAutopsyPanel";

interface IdeaStageViewProps {
  project: any;
  updateProject: (fn: (p: any) => any) => void;
  onOpenBible: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onOpenActions: () => void;
}

export default function IdeaStageView({ project, updateProject, onOpenBible, prompt, setPrompt, onUpgradeRequired, onOpenActions }: IdeaStageViewProps) {
  const hasPremise = !!project.controllingIdea?.trim();
  const [draft, setDraft] = useState(project.controllingIdea ?? "");
  const [editing, setEditing] = useState(!hasPremise);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controllingIdea: draft }),
      });
      updateProject((p: any) => ({ ...p, controllingIdea: draft }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Premise
        </div>

        {editing ? (
          <>
            <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, marginTop: 0, marginBottom: 12 }}>
              What&apos;s this story really about? A sentence or two — the premise and the idea underneath it.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. A retired assassin is forced back into the trade when the one person she protected is taken — and discovers the people who took them trained her."
              rows={5}
              style={{ ...sTextarea, width: "100%", boxSizing: "border-box" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={{ ...sBtn, opacity: draft.trim() && !saving ? 1 : 0.5 }} disabled={!draft.trim() || saving} onClick={handleSave}>
                {saving ? "Saving…" : "Save premise"}
              </button>
              {hasPremise && (
                <button style={sBtnSm} onClick={() => { setDraft(project.controllingIdea ?? ""); setEditing(false); }}>
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "16px 18px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface, fontSize: 14, color: co.text, lineHeight: 1.6, marginBottom: 12 }}>
              {project.controllingIdea}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={sBtnSm} onClick={() => setEditing(true)}>Edit premise</button>
              {(project.characters || []).length === 0 && (
                <button style={sBtn} onClick={onOpenBible}>Add characters →</button>
              )}
            </div>
            {(project.characters || []).length === 0 && (
              <p style={{ fontSize: 12, color: co.muted, marginTop: 10, lineHeight: 1.6 }}>
                Next: sketch your main characters in the Story Bible — who wants what, and why.
              </p>
            )}
          </>
        )}

        {isCreatorFormat(project.format) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${co.border}` }}>
            <TrendNichePanel format={project.format} projectId={project.id} setPrompt={setPrompt} onUpgradeRequired={onUpgradeRequired} />
            <TrendAnglesPanel format={project.format} prompt={prompt} setPrompt={setPrompt} onUpgradeRequired={onUpgradeRequired} />
            <ChannelAutopsyPanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
            <button style={sBtnSm} onClick={onOpenActions}>More →</button>
          </div>
        )}
      </div>
    </div>
  );
}
