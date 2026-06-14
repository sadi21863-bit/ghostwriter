"use client";
import { useState, useEffect } from "react";
import { co, sBtn, sBtnSm, sInput, sTextarea } from "@/lib/styles";
import { DEFAULT_CHAR, DEFAULT_LOC, DEFAULT_PLOT } from "@/lib/formats";
import { EmptyState } from "@/components/EmptyState";

const entityApiPath: Record<string, string> = {
  characters: "characters",
  locations: "locations",
  plotThreads: "plot-threads",
};

const CAST_VISIBLE: [string, string][] = [
  ["desires", "Want"],
  ["arc", "Need"],
  ["fears", "Contradiction"],
  ["speechPattern", "Voice note"],
];
const CAST_MORE: [string, string, string][] = [
  ["role", "Role", "input"],
  ["age", "Age", "input"],
  ["appearance", "Appearance", "textarea"],
  ["personality", "Personality", "textarea"],
  ["thinkingStyle", "Thinking style", "textarea"],
  ["behavior", "Behavior patterns", "textarea"],
  ["habits", "Habits & quirks", "textarea"],
  ["backstory", "Backstory", "textarea"],
];
const WORLD_VISIBLE: [string, string][] = [
  ["description", "Description"],
  ["atmosphere", "Atmosphere"],
  ["history", "History"],
  ["sensoryDetails", "Sensory details"],
];
const THREADS_VISIBLE: [string, string][] = [
  ["description", "Description"],
  ["stakes", "Stakes"],
  ["connections", "Connections"],
];

interface EntityCardProps {
  item: any;
  visibleFields: [string, string][];
  moreFields: [string, string, string][];
  hasStatus?: boolean;
  onSave: (draft: any) => Promise<void>;
  onDelete: () => void;
}

function EntityCard({ item, visibleFields, moreFields, hasStatus, onSave, onDelete }: EntityCardProps) {
  const [draft, setDraft] = useState<any>(item);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(item); }, [item]);

  const set = (field: string, value: string) => setDraft((d: any) => ({ ...d, [field]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(item);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 2 };

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={draft.name ?? ""} onChange={e => set("name", e.target.value)} placeholder="Name" style={{ ...sInput, fontWeight: 700, flex: 1 }} />
        {hasStatus && (
          <select value={draft.status ?? "Active"} onChange={e => set("status", e.target.value)} style={{ ...sInput, width: 110, flexShrink: 0 }}>
            <option>Active</option>
            <option>Simmering</option>
            <option>Resolved</option>
          </select>
        )}
        <button style={{ background: "none", border: "none", color: co.danger, cursor: "pointer", fontSize: 16, padding: "0 4px" }} onClick={onDelete} aria-label="Delete">×</button>
      </div>
      {visibleFields.map(([field, label]) => (
        <div key={field}>
          <span style={labelStyle}>{label}</span>
          <textarea value={draft[field] ?? ""} onChange={e => set(field, e.target.value)} style={{ ...sTextarea, minHeight: 50, fontSize: 12 }} />
        </div>
      ))}
      {moreFields.length > 0 && (
        <button style={{ ...sBtnSm, alignSelf: "flex-start" }} onClick={() => setExpanded(e => !e)}>
          {expanded ? "Less ▴" : "More details ▾"}
        </button>
      )}
      {expanded && moreFields.map(([field, label, type]) => (
        <div key={field}>
          <span style={labelStyle}>{label}</span>
          {type === "input"
            ? <input value={draft[field] ?? ""} onChange={e => set(field, e.target.value)} style={{ ...sInput, fontSize: 12 }} />
            : <textarea value={draft[field] ?? ""} onChange={e => set(field, e.target.value)} style={{ ...sTextarea, minHeight: 50, fontSize: 12 }} />}
        </div>
      ))}
      {dirty && (
        <button style={{ ...sBtn, alignSelf: "flex-start", opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}

interface StoryBibleProps {
  project: any;
  updateProject: (fn: (p: any) => any) => void;
  open: boolean;
  onClose: () => void;
  onOpenAdvanced: () => void;
  setConfirmModal: (v: any) => void;
}

export default function StoryBible({ project, updateProject, open, onClose, onOpenAdvanced, setConfirmModal }: StoryBibleProps) {
  const [tab, setTab] = useState<"cast" | "world" | "threads">("cast");

  if (!open) return null;

  const key = tab === "cast" ? "characters" : tab === "world" ? "locations" : "plotThreads";
  const items: any[] = project[key] || [];
  const visibleFields = tab === "cast" ? CAST_VISIBLE : tab === "world" ? WORLD_VISIBLE : THREADS_VISIBLE;
  const moreFields = tab === "cast" ? CAST_MORE : [];
  const tabLabel = tab === "cast" ? "character" : tab === "world" ? "location" : "thread";
  const emptyIcon = tab === "cast" ? "👤" : tab === "world" ? "🗺️" : "🧵";
  const emptyTitle = tab === "cast" ? "No characters yet" : tab === "world" ? "No locations yet" : "No plot threads yet";

  const handleAdd = async () => {
    const defaults = tab === "cast" ? { ...DEFAULT_CHAR, name: "New character" }
      : tab === "world" ? { ...DEFAULT_LOC, name: "New location" }
      : { ...DEFAULT_PLOT, name: "New thread" };
    const res = await fetch(`/api/projects/${project.id}/${entityApiPath[key]}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(defaults) });
    const created = await res.json();
    updateProject((p: any) => ({ ...p, [key]: [...(p[key] || []), created] }));
  };

  const handleSave = async (id: string, draft: any) => {
    const res = await fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const updated = await res.json();
    updateProject((p: any) => ({ ...p, [key]: p[key].map((x: any) => x.id === id ? updated : x) }));
  };

  const handleDelete = (item: any) => {
    setConfirmModal({
      msg: `Delete ${item.name}?`,
      action: async () => {
        await fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${item.id}`, { method: "DELETE" });
        updateProject((p: any) => ({ ...p, [key]: p[key].filter((x: any) => x.id !== item.id) }));
        setConfirmModal(null);
      },
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, background: co.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${co.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: co.text }}>Story Bible</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtnSm} onClick={onOpenAdvanced}>Advanced settings →</button>
          <button style={sBtnSm} onClick={onClose}>Close ×</button>
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", gap: 4, padding: "10px 24px", borderBottom: `1px solid ${co.border}` }}>
        {([
          ["cast", `Cast (${(project.characters || []).length})`],
          ["world", `World (${(project.locations || []).length})`],
          ["threads", `Threads (${(project.plotThreads || []).length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: tab === t ? co.accentBg : "transparent", color: tab === t ? co.accent : co.muted,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button style={sBtn} onClick={handleAdd}>+ Add {tabLabel}</button>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={`Add your first ${tabLabel} to start building your Story Bible.`} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {items.map((item: any) => (
              <EntityCard
                key={item.id}
                item={item}
                visibleFields={visibleFields}
                moreFields={moreFields}
                hasStatus={tab === "threads"}
                onSave={draft => handleSave(item.id, draft)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
