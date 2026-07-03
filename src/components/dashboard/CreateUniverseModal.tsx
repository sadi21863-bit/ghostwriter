"use client";
import { useState } from "react";

type ShelfProject = { id: string; name: string };
type Universe = { id: string; name: string; premise: string; updatedAt: string };

const inputS: React.CSSProperties = {
  width: "100%", padding: "9px 13px", background: "var(--gw-sunk)", border: "1px solid var(--gw-border)",
  borderRadius: 8, fontSize: 13, color: "var(--gw-t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

export function CreateUniverseModal({ projects, onClose, onCreated }: {
  projects: ShelfProject[];
  onClose: () => void;
  onCreated: (universe: Universe, linkedProjectIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [premise, setPremise] = useState("");
  const [storyIds, setStoryIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id: string) => setStoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/universes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), premise: premise.trim() }),
      });
      const universe = await res.json();
      if (storyIds.length > 0) {
        await Promise.all(storyIds.map(projectId =>
          fetch(`/api/universes/${universe.id}/projects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          })
        ));
      }
      onCreated(universe, storyIds);
      onClose();
    } catch {
      setError("Failed to create universe. Please try again.");
      setCreating(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="gw-modal"
        style={{ background: "var(--gw-card)", borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.35)" }}
      >
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, color: "var(--gw-t1)", marginBottom: 22 }}>🌌 New Universe</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--gw-t3)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Universe Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Ember Cosmos" style={inputS} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--gw-t3)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Premise</label>
          <textarea
            value={premise}
            onChange={e => setPremise(e.target.value)}
            placeholder="What binds these stories together?"
            rows={3}
            style={{ ...inputS, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }}
          />
        </div>

        {projects.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--gw-t3)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Link existing stories (optional)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {projects.map(p => {
                const sel = storyIds.includes(p.id);
                return (
                  <span
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    style={{
                      padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: "1px solid " + (sel ? "var(--gw-accent)" : "var(--gw-border)"),
                      background: sel ? "var(--gw-accent-bg)" : "transparent",
                      color: sel ? "var(--gw-accent)" : "var(--gw-t3)", transition: "all .15s",
                    }}
                  >{p.name}</span>
                );
              })}
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px 18px", background: "transparent", color: "var(--gw-t2)", border: "1px solid var(--gw-border)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={creating || !name.trim()}
            style={{
              flex: 1, padding: "10px 20px", background: (creating || !name.trim()) ? "#566b34" : "var(--gw-accent)",
              color: "var(--gw-accent-ink)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: (creating || !name.trim()) ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >{creating ? "Igniting…" : "Ignite Universe ✦"}</button>
        </div>
      </div>
    </div>
  );
}
