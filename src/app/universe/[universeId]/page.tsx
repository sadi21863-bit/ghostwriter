"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const GW_GOLD = "#c9a84c";
const GW_BORDER = "#e8e2d4";

export default function UniverseDashboard() {
  const { universeId } = useParams<{ universeId: string }>();
  const router = useRouter();
  const [universe, setUniverse] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [chars, setChars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPremise, setEditPremise] = useState("");
  const [saving, setSaving] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [addingChar, setAddingChar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, s, e, c] = await Promise.all([
      fetch(`/api/universes/${universeId}`).then(r => r.json()),
      fetch(`/api/universes/${universeId}/projects`).then(r => r.json()),
      fetch(`/api/universes/${universeId}/events`).then(r => r.json()),
      fetch(`/api/universes/${universeId}/characters`).then(r => r.json()),
    ]);
    setUniverse(u);
    setEditName(u.name || "");
    setEditPremise(u.premise || "");
    setStories(Array.isArray(s) ? s : []);
    setEvents(Array.isArray(e) ? e : []);
    setChars(Array.isArray(c) ? c : []);
    setLoading(false);
  }, [universeId]);

  useEffect(() => { load(); }, [load]);

  const saveUniverse = async () => {
    setSaving(true);
    await fetch(`/api/universes/${universeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, premise: editPremise }),
    });
    setUniverse((u: any) => ({ ...u, name: editName, premise: editPremise }));
    setSaving(false);
  };

  const addEvent = async () => {
    if (!newEventName.trim()) return;
    setAddingEvent(true);
    const maxSort = events.reduce((m: number, e: any) => Math.max(m, e.timelineSort || 0), 0);
    const res = await fetch(`/api/universes/${universeId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newEventName.trim(), description: newEventDesc.trim(), timelineSort: maxSort + 1 }),
    });
    const e = await res.json();
    setEvents(prev => [...prev, e]);
    setNewEventName("");
    setNewEventDesc("");
    setAddingEvent(false);
  };

  const addChar = async () => {
    if (!newCharName.trim()) return;
    setAddingChar(true);
    const res = await fetch(`/api/universes/${universeId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCharName.trim() }),
    });
    const c = await res.json();
    setChars(prev => [...prev, c]);
    setNewCharName("");
    setAddingChar(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Figtree', sans-serif", color: "#888" }}>
      Loading universe…
    </div>
  );

  if (!universe || universe.error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Figtree', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "#1a1a1a", marginBottom: 12 }}>Universe not found</div>
        <Link href="/dashboard" style={{ color: GW_GOLD, fontWeight: 600 }}>← Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf9f7", fontFamily: "'Figtree', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${GW_BORDER}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>←</button>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "#1a1a1a" }}>
          🌌 {universe.name}
        </div>
        <span style={{ fontSize: 10, background: "rgba(29,158,117,0.12)", color: "#1d9e75", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>UNIVERSE</span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Universe Info */}
        <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 14, border: `1px solid ${GW_BORDER}`, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Universe Details</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#aaa", display: "block", marginBottom: 4 }}>NAME</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${GW_BORDER}`, borderRadius: 8, fontSize: 14, fontFamily: "'Figtree', sans-serif", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#aaa", display: "block", marginBottom: 4 }}>PREMISE / WORLD RULES</label>
            <textarea value={editPremise} onChange={e => setEditPremise(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${GW_BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "'Figtree', sans-serif", resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <button onClick={saveUniverse} disabled={saving} style={{ background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Stories Timeline */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${GW_BORDER}`, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Stories ({stories.length})</div>
            <button onClick={() => router.push("/dashboard")} style={{ fontSize: 11, background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>+ Add Story</button>
          </div>
          {stories.length === 0 ? (
            <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "20px 0" }}>No stories linked yet.<br />Create a project with "Your Universe" type and link it here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stories.map((s: any, i: number) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#faf9f7", borderRadius: 10, border: `1px solid ${GW_BORDER}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: GW_GOLD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.timelineSort ?? i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "#aaa" }}>{s.format}{s.phase ? ` · ${s.phase}` : ""} · {(s.chapters || []).reduce((a: number, c: any) => a + (c.wordCount || 0), 0).toLocaleString()} words</div>
                  </div>
                  <Link href={`/project/${s.id}`} style={{ fontSize: 11, color: GW_GOLD, fontWeight: 600, textDecoration: "none" }}>Open →</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canonical Events */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${GW_BORDER}`, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Canonical Events ({events.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {events.map((e: any) => (
              <div key={e.id} style={{ padding: "10px 12px", background: "#faf9f7", borderRadius: 10, border: `1px solid ${GW_BORDER}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: GW_GOLD, flexShrink: 0, minWidth: 20 }}>#{e.timelineSort}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>{e.name}</div>
                    {e.description && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{e.description}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input value={newEventName} onChange={e => setNewEventName(e.target.value)} placeholder="Event name…" style={{ padding: "7px 10px", border: `1px solid ${GW_BORDER}`, borderRadius: 8, fontSize: 12, fontFamily: "'Figtree', sans-serif" }} />
            <input value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} placeholder="Description (optional)…" style={{ padding: "7px 10px", border: `1px solid ${GW_BORDER}`, borderRadius: 8, fontSize: 12, fontFamily: "'Figtree', sans-serif" }} />
            <button onClick={addEvent} disabled={addingEvent || !newEventName.trim()} style={{ background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "7px 0", borderRadius: 8, fontSize: 12, cursor: (addingEvent || !newEventName.trim()) ? "not-allowed" : "pointer", opacity: (addingEvent || !newEventName.trim()) ? 0.5 : 1 }}>
              {addingEvent ? "Adding…" : "+ Add Event"}
            </button>
          </div>
        </div>

        {/* Universe Characters */}
        <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 14, border: `1px solid ${GW_BORDER}`, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Universe Characters ({chars.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {chars.map((c: any) => (
              <div key={c.id} style={{ padding: "8px 14px", background: "#faf9f7", borderRadius: 20, border: `1px solid ${GW_BORDER}`, fontSize: 12, fontWeight: 600, color: c.isAlive ? "#1a1a1a" : "#aaa", textDecoration: c.isAlive ? "none" : "line-through" }}>
                {c.name}{!c.isAlive && " (deceased)"}
              </div>
            ))}
            {chars.length === 0 && <div style={{ fontSize: 12, color: "#bbb" }}>No universe-level characters yet.</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newCharName} onChange={e => setNewCharName(e.target.value)} placeholder="Character name…" onKeyDown={e => e.key === "Enter" && addChar()} style={{ flex: 1, padding: "7px 10px", border: `1px solid ${GW_BORDER}`, borderRadius: 8, fontSize: 12, fontFamily: "'Figtree', sans-serif" }} />
            <button onClick={addChar} disabled={addingChar || !newCharName.trim()} style={{ background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "7px 16px", borderRadius: 8, fontSize: 12, cursor: (addingChar || !newCharName.trim()) ? "not-allowed" : "pointer", opacity: (addingChar || !newCharName.trim()) ? 0.5 : 1 }}>
              {addingChar ? "…" : "+ Add"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
