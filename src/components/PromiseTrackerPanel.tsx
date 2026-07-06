"use client";
import { useEffect, useState } from "react";
import { co, sBtnSm, sInput } from "@/lib/styles";
import { toast } from "@/lib/toast";
import { priorityColor, promiseStatusLabel, threadStatusLabel } from "@/lib/story/promise-tracker";

interface StoryPromise {
  id: string;
  threadId: string | null;
  setup: string;
  payoffIntent: string;
  status: string;
  priority: string;
}

interface StoryThread {
  id: string;
  name: string;
  threadType: string;
  status: string;
  notes: string;
  promises: StoryPromise[];
}

interface Checkpoint {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  snapshot: {
    totalWordCount: number;
    chapterCount: number;
    openThreadCount: number;
    openPromises: number;
    healthScore: number;
  };
}

interface PromiseTrackerPanelProps {
  project: any;
}

// Surfaces storyThreads/storyPromises/storyCheckpoints (src/db/schema.ts) — a
// fully-built CRUD backend (/api/projects/[id]/story-state,
// /api/projects/[id]/checkpoints) that had zero UI anywhere before this panel.
// Deliberately named "Promise Tracker," not "Threads," to avoid colliding with
// the World Bible's separate, already-UI'd plotThreads "Threads" tab — these
// are a different, more surgical setup->payoff concept, not a replacement.
export default function PromiseTrackerPanel({ project }: PromiseTrackerPanelProps) {
  const [threads, setThreads] = useState<StoryThread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newThreadName, setNewThreadName] = useState("");
  const [addingThread, setAddingThread] = useState(false);
  const [promiseDraftFor, setPromiseDraftFor] = useState<string | null>(null);
  const [promiseSetup, setPromiseSetup] = useState("");
  const [promisePayoff, setPromisePayoff] = useState("");

  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null);
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${project.id}/story-state`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.threads) setThreads(d.threads); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [project.id]);

  const loadCheckpoints = async () => {
    if (checkpoints !== null) return;
    const res = await fetch(`/api/projects/${project.id}/checkpoints`);
    const d = await res.json().catch(() => null);
    if (d?.checkpoints) setCheckpoints(d.checkpoints);
  };

  const addThread = async () => {
    if (!newThreadName.trim()) return;
    setAddingThread(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/story-state`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "thread", name: newThreadName.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (d?.id) setThreads(prev => [...prev, { ...d, promises: [] }]);
      else toast.error("Couldn't create the thread.");
      setNewThreadName("");
    } finally {
      setAddingThread(false);
    }
  };

  const addPromise = async (threadId: string) => {
    if (!promiseSetup.trim()) return;
    const res = await fetch(`/api/projects/${project.id}/story-state`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "promise", threadId, setup: promiseSetup.trim(), payoffIntent: promisePayoff.trim() }),
    });
    const d = await res.json().catch(() => null);
    if (d?.id) {
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, promises: [...t.promises, d] } : t));
    } else {
      toast.error("Couldn't add the promise.");
    }
    setPromiseSetup(""); setPromisePayoff(""); setPromiseDraftFor(null);
  };

  const markPromisePaidOff = async (threadId: string, promiseId: string) => {
    setThreads(prev => prev.map(t => t.id === threadId
      ? { ...t, promises: t.promises.map(p => p.id === promiseId ? { ...p, status: "paid_off" } : p) }
      : t));
    const res = await fetch(`/api/projects/${project.id}/story-state`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promiseId, status: "paid_off" }),
    });
    if (!res.ok) toast.error("Couldn't update the promise. Try again.");
  };

  const toggleThreadResolved = async (thread: StoryThread) => {
    const next = thread.status === "resolved" ? "open" : "resolved";
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, status: next } : t));
    const res = await fetch(`/api/projects/${project.id}/story-state`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.id, status: next }),
    });
    if (!res.ok) toast.error("Couldn't update the thread. Try again.");
  };

  const saveCheckpoint = async () => {
    setSavingCheckpoint(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/checkpoints`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => null);
      if (d?.checkpoint) {
        setCheckpoints(prev => [d.checkpoint, ...(prev ?? [])]);
        toast.success("Checkpoint saved.");
      } else {
        toast.error("Couldn't save a checkpoint.");
      }
    } finally {
      setSavingCheckpoint(false);
    }
  };

  const deleteCheckpoint = async (checkpointId: string) => {
    setCheckpoints(prev => (prev ?? []).filter(c => c.id !== checkpointId));
    await fetch(`/api/projects/${project.id}/checkpoints`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkpointId }),
    }).catch(() => {});
  };

  if (!loaded) return null;

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>📜 Promise Tracker</div>
        <span style={{ fontSize: 11, color: co.muted }}>
          {threads.reduce((n, t) => n + t.promises.filter(p => p.status !== "paid_off").length, 0)} open
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {threads.map(thread => {
          const resolved = thread.status === "resolved";
          return (
            <div key={thread.id} style={{ border: `1px solid ${co.border}`, borderRadius: 8, padding: "10px 12px", background: co.bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: co.text, flex: 1 }}>{thread.name}</span>
                <span style={{ fontSize: 10, color: co.muted }}>{thread.threadType}</span>
                <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 20, background: resolved ? `color-mix(in srgb, ${co.green} 10%, transparent)` : co.surfaceAlt, color: resolved ? co.green : co.muted }}>
                  {threadStatusLabel(thread.status)}
                </span>
                <button style={{ ...sBtnSm, ...(resolved ? { borderColor: co.green, color: co.green } : {}) }} onClick={() => toggleThreadResolved(thread)}>
                  {resolved ? "✓ Resolved" : "Resolve"}
                </button>
              </div>

              {thread.promises.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {thread.promises.map(p => {
                    const paidOff = p.status === "paid_off";
                    return (
                      <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor(p.priority), marginTop: 5, flexShrink: 0 }} title={`Priority ${p.priority}`} />
                        <div style={{ flex: 1 }}>
                          <span style={{ color: co.text, textDecoration: paidOff ? "line-through" : "none" }}>{p.setup}</span>
                          {p.payoffIntent && <div style={{ color: co.muted, fontSize: 11, marginTop: 2 }}>→ {p.payoffIntent}</div>}
                        </div>
                        <span style={{ fontSize: 10, color: paidOff ? co.green : co.muted }}>{promiseStatusLabel(p.status)}</span>
                        {!paidOff && (
                          <button style={{ ...sBtnSm, padding: "2px 8px" }} onClick={() => markPromisePaidOff(thread.id, p.id)}>Mark Paid Off</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {promiseDraftFor === thread.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  <input autoFocus style={{ ...sInput, fontSize: 12 }} placeholder="What's being set up…" value={promiseSetup}
                    onChange={e => setPromiseSetup(e.target.value)} />
                  <input style={{ ...sInput, fontSize: 12 }} placeholder="Intended payoff (optional)…" value={promisePayoff}
                    onChange={e => setPromisePayoff(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addPromise(thread.id); }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={sBtnSm} onClick={() => addPromise(thread.id)}>Add</button>
                    <button style={{ ...sBtnSm, color: co.muted }} onClick={() => { setPromiseDraftFor(null); setPromiseSetup(""); setPromisePayoff(""); }}>×</button>
                  </div>
                </div>
              ) : (
                <button style={{ ...sBtnSm, marginTop: 8, fontSize: 10, padding: "2px 8px" }} onClick={() => { setPromiseDraftFor(thread.id); setPromiseSetup(""); setPromisePayoff(""); }}>+ Add promise</button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <input style={{ ...sInput, fontSize: 12 }} placeholder="New thread name…" value={newThreadName}
          onChange={e => setNewThreadName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addThread(); }} />
        <button style={{ ...sBtnSm, opacity: addingThread ? 0.6 : 1 }} disabled={addingThread} onClick={addThread}>+ Add Thread</button>
      </div>

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${co.border}` }}>
        <button style={{ ...sBtnSm, fontSize: 10 }} onClick={() => { const next = !showCheckpoints; setShowCheckpoints(next); if (next) loadCheckpoints(); }}>
          {showCheckpoints ? "▾" : "▸"} Checkpoints
        </button>
        {showCheckpoints && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <button style={{ ...sBtnSm, opacity: savingCheckpoint ? 0.6 : 1, alignSelf: "flex-start" }} disabled={savingCheckpoint} onClick={saveCheckpoint}>
              {savingCheckpoint ? "Saving…" : "📍 Save Checkpoint"}
            </button>
            {(checkpoints ?? []).map(cp => (
              <div key={cp.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, border: `1px solid ${co.border}`, borderRadius: 6, padding: "6px 10px" }}>
                <span style={{ color: co.text, fontWeight: 600, flex: 1 }}>{cp.name}</span>
                <span style={{ color: co.muted }}>{cp.snapshot.totalWordCount} words</span>
                <span style={{ color: co.muted }}>Health {cp.snapshot.healthScore}</span>
                <span style={{ color: co.muted }}>{new Date(cp.createdAt).toLocaleDateString()}</span>
                <button style={{ ...sBtnSm, padding: "2px 8px", color: co.muted }} onClick={() => deleteCheckpoint(cp.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
