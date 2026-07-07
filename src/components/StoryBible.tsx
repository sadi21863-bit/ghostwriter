"use client";
import { useState, useEffect } from "react";
import { co, sBtn, sBtnSm, sInput, sTextarea } from "@/lib/styles";
import { DEFAULT_CHAR, DEFAULT_LOC, DEFAULT_PLOT } from "@/lib/formats";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/lib/toast";

const entityApiPath: Record<string, string> = {
  characters: "characters",
  locations: "locations",
  plotThreads: "plot-threads",
  worldEntities: "world-entities",
};

// World Elements: the seven kinds group into three visible sections. Each section's
// first kind is the default for its "+ Add" button.
const ELEMENT_SECTIONS: { title: string; icon: string; kinds: string[] }[] = [
  { title: "Objects & Artifacts",     icon: "🗡️", kinds: ["object", "weapon"] },
  { title: "Organizations & Factions", icon: "🏛️", kinds: ["organization", "faction"] },
  { title: "Phenomena & Entities",     icon: "🌀", kinds: ["phenomenon", "entity", "concept"] },
];
const ELEMENT_KIND_LABEL: Record<string, string> = {
  object: "Object", weapon: "Weapon", organization: "Organization", faction: "Faction",
  phenomenon: "Phenomenon", entity: "Entity", concept: "Concept",
};
// The flat properties fields shown in a world-element card's "More details".
const ELEMENT_PROP_FIELDS: [string, string][] = [
  ["origin", "Origin"],
  ["significance", "Significance"],
  ["goal", "Goal"],
  ["leader", "Leader"],
  ["nature", "Nature"],
  ["manifestation", "Manifestation"],
  ["notes", "Notes"],
];

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
    try { await onSave(draft); } catch { /* toasted by onSave; keep draft so the user can retry */ } finally { setSaving(false); }
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

interface WorldEntityCardProps {
  item: any;
  onSave: (draft: any) => Promise<void>;
  onDelete: () => void;
}

// Dedicated card for world elements: name + kind selector + summary + description +
// a flexible flat properties editor. Properties live in draft.properties (JSONB).
function WorldEntityCard({ item, onSave, onDelete }: WorldEntityCardProps) {
  const [draft, setDraft] = useState<any>(item);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(item); }, [item]);

  const set = (field: string, value: string) => setDraft((d: any) => ({ ...d, [field]: value }));
  const setProp = (field: string, value: string) =>
    setDraft((d: any) => ({ ...d, properties: { ...(d.properties || {}), [field]: value } }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(item);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); } catch { /* toasted by onSave; keep draft for retry */ } finally { setSaving(false); }
  };

  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 2 };

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={draft.name ?? ""} onChange={e => set("name", e.target.value)} placeholder="Name" style={{ ...sInput, fontWeight: 700, flex: 1 }} />
        <select value={draft.kind ?? "object"} onChange={e => set("kind", e.target.value)} style={{ ...sInput, width: 130, flexShrink: 0 }}>
          {Object.entries(ELEMENT_KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <button style={{ background: "none", border: "none", color: co.danger, cursor: "pointer", fontSize: 16, padding: "0 4px" }} onClick={onDelete} aria-label="Delete">×</button>
      </div>
      <div>
        <span style={labelStyle}>Summary</span>
        <textarea value={draft.summary ?? ""} onChange={e => set("summary", e.target.value)} style={{ ...sTextarea, minHeight: 44, fontSize: 12 }} />
      </div>
      <div>
        <span style={labelStyle}>Description</span>
        <textarea value={draft.description ?? ""} onChange={e => set("description", e.target.value)} style={{ ...sTextarea, minHeight: 56, fontSize: 12 }} />
      </div>
      <button style={{ ...sBtnSm, alignSelf: "flex-start" }} onClick={() => setExpanded(e => !e)}>
        {expanded ? "Less ▴" : "More details ▾"}
      </button>
      {expanded && ELEMENT_PROP_FIELDS.map(([field, label]) => (
        <div key={field}>
          <span style={labelStyle}>{label}</span>
          <input value={draft.properties?.[field] ?? ""} onChange={e => setProp(field, e.target.value)} style={{ ...sInput, fontSize: 12 }} />
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

interface WorldElementsTabProps {
  items: any[];
  adding: boolean;
  onAdd: (kind: string) => void;
  onSave: (id: string, draft: any) => Promise<void>;
  onDelete: (item: any) => void;
}

// The Elements tab: world entities grouped into three sections by kind. Each section
// has its own "+ Add" (seeding the section's first kind) and shows its matching cards.
function WorldElementsTab({ items, adding, onAdd, onSave, onDelete }: WorldElementsTabProps) {
  if (items.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <EmptyState icon="🗡️" title="No world elements yet" description="Add objects, weapons, organizations, factions, or phenomena to enrich your world." />
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {ELEMENT_SECTIONS.map(s => (
            <button key={s.title} style={{ ...sBtnSm, opacity: adding ? 0.6 : 1 }} disabled={adding} onClick={() => onAdd(s.kinds[0])}>
              {s.icon} + {s.title}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {ELEMENT_SECTIONS.map(section => {
        const sectionItems = items.filter(i => section.kinds.includes(i.kind));
        return (
          <div key={section.title}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: co.text }}>{section.icon} {section.title}</span>
              <button style={{ ...sBtnSm, opacity: adding ? 0.6 : 1 }} disabled={adding} onClick={() => onAdd(section.kinds[0])}>+ Add</button>
            </div>
            {sectionItems.length === 0 ? (
              <span style={{ fontSize: 12, color: co.muted }}>None yet.</span>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {sectionItems.map(item => (
                  <WorldEntityCard
                    key={item.id}
                    item={item}
                    onSave={draft => onSave(item.id, draft)}
                    onDelete={() => onDelete(item)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
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
  const [tab, setTab] = useState<"cast" | "world" | "threads" | "elements">("cast");

  if (!open) return null;

  const key = tab === "cast" ? "characters" : tab === "world" ? "locations" : tab === "threads" ? "plotThreads" : "worldEntities";
  const items: any[] = project[key] || [];
  const visibleFields = tab === "cast" ? CAST_VISIBLE : tab === "world" ? WORLD_VISIBLE : THREADS_VISIBLE;
  const moreFields = tab === "cast" ? CAST_MORE : [];
  const tabLabel = tab === "cast" ? "character" : tab === "world" ? "location" : "thread";
  const emptyIcon = tab === "cast" ? "👤" : tab === "world" ? "🗺️" : "🧵";
  const emptyTitle = tab === "cast" ? "No characters yet" : tab === "world" ? "No locations yet" : "No plot threads yet";

  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (adding) return; // guards against duplicate cards from rapid multi-click while the request is in flight
    setAdding(true);
    const defaults = tab === "cast" ? { ...DEFAULT_CHAR, name: "New character" }
      : tab === "world" ? { ...DEFAULT_LOC, name: "New location" }
      : { ...DEFAULT_PLOT, name: "New thread" };
    try {
      const res = await fetch(`/api/projects/${project.id}/${entityApiPath[key]}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(defaults) });
      if (!res.ok) { toast.error(`Couldn't add ${tabLabel} — try again`); return; }
      const created = await res.json();
      updateProject((p: any) => ({ ...p, [key]: [...(p[key] || []), created] }));
    } finally {
      setAdding(false);
    }
  };

  const handleAddElement = async (kind: string) => {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/world-entities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `New ${ELEMENT_KIND_LABEL[kind] ?? kind}`, kind }),
      });
      if (!res.ok) { toast.error("Couldn't add element — try again"); return; }
      const created = await res.json();
      if (created.similarEntities?.length) {
        toast.warning(`This looks similar to an existing element: ${created.similarEntities.map((m: any) => m.name).join(", ")}. Created anyway — check for a duplicate.`);
      }
      updateProject((p: any) => ({ ...p, worldEntities: [...(p.worldEntities || []), created] }));
    } finally {
      setAdding(false);
    }
  };

  const handleSave = async (id: string, draft: any) => {
    const res = await fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    if (!res.ok) {
      toast.error("Couldn't save — try again");
      throw new Error("Save failed"); // keeps the card's local draft (and its Save button) intact instead of silently reverting
    }
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
          ["elements", `Elements (${(project.worldEntities || []).length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: tab === t ? co.accentBg : "transparent", color: tab === t ? co.accent : co.muted,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {tab === "elements" ? (
          <WorldElementsTab
            items={items}
            adding={adding}
            onAdd={handleAddElement}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button style={{ ...sBtn, opacity: adding ? 0.6 : 1 }} disabled={adding} onClick={handleAdd}>{adding ? "Adding…" : `+ Add ${tabLabel}`}</button>
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
          </>
        )}
      </div>
    </div>
  );
}
