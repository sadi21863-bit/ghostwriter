"use client";
import type { FormEvent } from "react";
import { useEffect, useState, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFeatureIsOn } from "@growthbook/growthbook-react";
import Onboarding from "@/components/Onboarding";
import { EmptyState } from "@/components/EmptyState";
import { FORMATS } from "@/lib/formats";
import { FLAGS } from "@/lib/growthbook";
import Home from "@/components/Home";
import { toast } from "@/lib/toast";

function EmailVerifiedCheck() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("email_verified") === "1") {
      toast.success("Email verified! Your account is all set.");
      router.replace("/dashboard");
    }
  }, [searchParams, router]);
  return null;
}

type Project = {
  id: string;
  name: string;
  format: string;
  genres: string[];
  updatedAt: string;
  chapters: { id: string }[];
};

interface BraindumpResult {
  projectName: string; premise: string; format: string; genres: string[];
  controllingIdea: string; characters: Array<{name: string; role: string; description: string}>;
  worldFacts: string[]; openConflicts: string[]; suggestedTitle: string;
}

export default function Dashboard() {
  const homeRedesign = useFeatureIsOn(FLAGS.homeRedesign);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState("Novel");
  const [newSkillLevel, setNewSkillLevel] = useState<"beginner" | "expert">("beginner");
  const [newStoryType, setNewStoryType] = useState<"linear" | "series" | "universe-story">("linear");
  const [creationMode, setCreationMode] = useState<'structured' | 'braindump' | 'import'>('structured');
  const [braindumpText, setBraindumpText] = useState('');
  const [braindumpProcessing, setBraindumpProcessing] = useState(false);
  const [braindumpResult, setBraindumpResult] = useState<BraindumpResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [subscription, setSubscription] = useState<{ tier: string; status: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterFormat, setFilterFormat] = useState("All");
  const [seriesBibles, setSeriesBibles] = useState<{ id: string; name: string; premise: string; projectIds: string[]; updatedAt: string }[]>([]);
  const [universes, setUniverses] = useState<{ id: string; name: string; premise: string; updatedAt: string }[]>([]);
  const [seriesUniverseExpanded, setSeriesUniverseExpanded] = useState(false);
  const [seriesFilter, setSeriesFilter] = useState<{ id: string; name: string; projectIds: string[] } | null>(null);
  const [pendingSeriesLink, setPendingSeriesLink] = useState<string | null>(null);
  const [creatingUniverse, setCreatingUniverse] = useState(false);
  const [showCreateUniverse, setShowCreateUniverse] = useState(false);
  const [newUniverseName, setNewUniverseName] = useState("");
  const [showCreateBible, setShowCreateBible] = useState(false);
  const [newBibleName, setNewBibleName] = useState("");
  const [newBiblePremise, setNewBiblePremise] = useState("");
  const [newBibleProjectIds, setNewBibleProjectIds] = useState<string[]>([]);
  const [creatingBible, setCreatingBible] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const hasSeenOnboarding = localStorage.getItem("ghostwriter_onboarding_seen");
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, [status]);


  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/projects")
      .then(r => r.json())
      .then(setProjects)
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
    fetch("/api/series-bibles")
      .then(r => r.json())
      .then(d => setSeriesBibles(d.bibles ?? []))
      .catch(() => {});
    fetch("/api/universes")
      .then(r => r.json())
      .then(d => setUniverses(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/subscription")
      .then(r => r.json())
      .then(d => setSubscription(d))
      .catch(() => {});
  }, [status]);

  const createBible = async () => {
    if (!newBibleName.trim()) return;
    setCreatingBible(true);
    const res = await fetch("/api/series-bibles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBibleName.trim(), premise: newBiblePremise, projectIds: newBibleProjectIds }),
    });
    const { bible } = await res.json();
    if (bible) setSeriesBibles(prev => [bible, ...prev]);
    setNewBibleName(""); setNewBiblePremise(""); setNewBibleProjectIds([]);
    setShowCreateBible(false); setCreatingBible(false);
  };

  const createUniverse = async () => {
    if (!newUniverseName.trim()) return;
    setCreatingUniverse(true);
    const res = await fetch("/api/universes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newUniverseName.trim() }),
    });
    const u = await res.json();
    if (u?.id) setUniverses(prev => [u, ...prev]);
    setNewUniverseName(""); setShowCreateUniverse(false); setCreatingUniverse(false);
  };

  const deleteBible = async (id: string) => {
    await fetch(`/api/series-bibles/${id}`, { method: "DELETE" });
    setSeriesBibles(prev => prev.filter(b => b.id !== id));
  };

  const createProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), format: newFormat, skillLevel: newSkillLevel, storyType: newStoryType }),
      });
      const p = await res.json();
      if (pendingSeriesLink) {
        const updatedProjectIds = [...(seriesFilter?.projectIds ?? []), p.id];
        fetch(`/api/series-bibles/${pendingSeriesLink}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: updatedProjectIds }),
        }).then(r => r.json()).then(({ bible }) => {
          if (bible) {
            setSeriesBibles(prev => prev.map(b => b.id === bible.id ? bible : b));
            setSeriesFilter(f => f && f.id === bible.id ? { ...f, projectIds: bible.projectIds } : f);
          }
        }).catch(() => {});
        setPendingSeriesLink(null);
      }
      setShowCreate(false);
      setNewName("");
      setNewFormat("Novel");
      setNewSkillLevel("beginner");
      setNewStoryType("linear");
      router.push("/project/" + p.id);
    } catch {
      setError("Failed to create project");
      setCreating(false);
    }
  };

  const handleProcessBraindump = async () => {
    if (braindumpText.trim().length < 50) return;
    setBraindumpProcessing(true);
    try {
      const res = await fetch('/api/ai/braindump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: braindumpText }),
      });
      const data = await res.json();
      if (data.result) setBraindumpResult(data.result);
      else setError(data.error || 'Could not process braindump');
    } catch {
      setError('Processing failed. Please try again.');
    } finally {
      setBraindumpProcessing(false);
    }
  };

  const handleCreateFromBraindump = async () => {
    if (!braindumpResult) return;
    setCreating(true);
    try {
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: braindumpResult.projectName,
          format: braindumpResult.format,
          genres: braindumpResult.genres,
          storyType: 'linear',
        }),
      });
      if (!projRes.ok) throw new Error('Failed to create project');
      const proj = await projRes.json();

      await fetch(`/api/projects/${proj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres: braindumpResult.genres,
          controllingIdea: braindumpResult.controllingIdea,
        }),
      });

      await Promise.all(braindumpResult.characters.map(char =>
        fetch(`/api/projects/${proj.id}/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: char.name,
            role: char.role,
            personality: char.description,
          }),
        })
      ));

      await Promise.all(braindumpResult.worldFacts.map(fact =>
        fetch(`/api/projects/${proj.id}/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fact.length > 50 ? fact.substring(0, 50) : fact,
            description: fact,
          }),
        })
      ));

      setShowCreate(false);
      setCreationMode('structured');
      setBraindumpText('');
      setBraindumpResult(null);
      router.push(`/project/${proj.id}`);
    } catch {
      setError('Failed to create project. Please try again.');
      setCreating(false);
    }
  };


  const handleScrivenerImport = async () => {
    if (!importFile) return;
    setImporting(true); setImportMsg('');
    try {
      const form = new FormData();
      form.append('file', importFile);
      form.append('projectName', importName || importFile.name.replace(/\.(zip|scriv)$/i, ''));
      const res = await fetch('/api/projects/import/scrivener', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) { setImportMsg(data.error); }
      else {
        setShowCreate(false);
        setCreationMode('structured');
        setImportFile(null);
        setImportName('');
        router.push('/project/' + data.project.id);
      }
    } catch { setImportMsg('Import failed. Try again.'); }
    setImporting(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/projects/" + deleteTarget.id, { method: "DELETE" });
      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
    } catch {
      setError("Failed to delete project");
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const GW_DARK = "#0d0d10";
  const GW_GOLD = "#c9a84c";
  const GW_CREAM = "#faf9f5";
  const GW_BORDER = "#ede9df";

  const FORMAT_COLORS: Record<string, string> = {
    "Novel": "#5b4ccc", "Screenplay": "#0ea5e9", "Web Series": "#8b5cf6",
    "YouTube Long-form": "#ef4444", "YouTube Short": "#f97316", "TikTok Script": "#ec4899",
    "TikTok Native": "#fe2c55", "Instagram Reel": "#a855f7", "Podcast Episode": "#10b981",
  };

  const inputS: React.CSSProperties = {
    width: "100%", padding: "10px 14px", background: "#f5f4f0", border: "1px solid " + GW_BORDER,
    borderRadius: 10, fontSize: 13, color: "#1a1a1a", outline: "none", boxSizing: "border-box",
    fontFamily: "'Figtree', sans-serif",
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterFormat === "All" || p.format === filterFormat) &&
    (!seriesFilter || seriesFilter.projectIds.includes(p.id))
  );

  if (homeRedesign) return <Home />;

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: GW_DARK }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Figtree:wght@400;500;600;700&display=swap');`}</style>
        <span style={{ color: GW_GOLD, fontSize: 14, fontFamily: "'Figtree', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: GW_CREAM, fontFamily: "'Figtree', sans-serif" }}>
      <Suspense fallback={null}><EmailVerifiedCheck /></Suspense>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Figtree:wght@400;500;600;700&display=swap');
        @keyframes gw-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .gw-card { animation: gw-in 0.3s ease both; transition: box-shadow 0.2s, transform 0.18s; }
        .gw-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.10) !important; transform: translateY(-2px); }
        .gw-card .gw-del { opacity: 0; transition: opacity 0.15s; }
        .gw-card:hover .gw-del { opacity: 1; }
        .gw-input:focus { border-color: ${GW_GOLD} !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.12) !important; }
        .gw-gold-btn { transition: background 0.2s, transform 0.15s; }
        .gw-gold-btn:hover:not(:disabled) { background: #b8963e !important; transform: translateY(-1px); }
        .gw-hdr-btn { transition: color 0.15s, background 0.15s; }
        .gw-hdr-btn:hover { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
      `}</style>

      {/* Header */}
      <header style={{ background: GW_DARK, borderBottom: "1px solid #1a1a22", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: GW_GOLD, fontWeight: 600, letterSpacing: 1 }}>
          GhostWriter
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#444", marginRight: 4 }}>
            {session?.user?.name || session?.user?.email}
          </span>
          {subscription && (
            <a href="/settings" style={{
              fontSize: 11, fontWeight: 700, textDecoration: "none", padding: "3px 10px", borderRadius: 20,
              background: subscription.tier === "free" ? "rgba(201,168,76,0.12)" : "rgba(34,197,94,0.12)",
              color: subscription.tier === "free" ? GW_GOLD : "#22c55e",
            }}>
              {subscription.tier === "free" ? "Free → Upgrade" : subscription.tier.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </a>
          )}
          <a href="/settings" className="gw-hdr-btn"
            style={{ fontSize: 12, color: "#666", background: "transparent", border: "1px solid #1e1e2a", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "'Figtree', sans-serif", textDecoration: "none" }}>
            ⚙ Settings
          </a>
          <button className="gw-hdr-btn" onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ fontSize: 12, color: "#666", background: "transparent", border: "1px solid #1e1e2a", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>

        {/* Page title + action */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 8 }}>Studio</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, color: "#1a1a1a", fontWeight: 600, lineHeight: 1, margin: 0 }}>
              Your Projects
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button className="gw-gold-btn" onClick={() => setShowCreate(true)}
              style={{ background: GW_GOLD, color: "#0d0d10", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Figtree', sans-serif", letterSpacing: 0.3 }}>
              + New Project
            </button>
            <button onClick={() => { setCreationMode('import'); setShowCreate(true); }}
              style={{ background: "transparent", color: "#bbb", border: "none", padding: 0, fontSize: 11, cursor: "pointer", fontFamily: "'Figtree', sans-serif", textDecoration: "underline" }}>
              Import existing manuscript
            </button>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#c54444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginBottom: 24 }}>{error}</div>
        )}

        {seriesFilter && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fefce8", border: "1px solid " + GW_GOLD, borderRadius: 10, padding: "10px 16px", marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: "#92400e" }}>
              Showing books in series: <strong>{seriesFilter.name}</strong> ({filteredProjects.length})
            </span>
            <button onClick={() => { setPendingSeriesLink(seriesFilter.id); setShowCreate(true); }}
              style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, background: GW_GOLD, color: "#0d0d10", border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
              + Add a book to this series
            </button>
            <button onClick={() => setSeriesFilter(null)}
              style={{ fontSize: 12, color: "#92400e", background: "none", border: "1px solid " + GW_GOLD, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
              ✕ Clear filter
            </button>
          </div>
        )}

        {projects.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
            <input type="text" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} className="gw-input"
              style={{ ...inputS, flex: 1 }} />
            <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)} className="gw-input"
              style={{ ...inputS, width: "auto", cursor: "pointer" }}>
              <option value="All">All formats</option>
              {FORMATS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        )}

        {projects.length === 0 ? (
          <div style={{ padding: "80px 0" }}>
            <EmptyState
              icon="✨"
              title="Your stories live here"
              description="Start a novel, screenplay, YouTube channel, or podcast project."
              action={{ label: "New Project", onClick: () => setShowCreate(true) }}
            />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filteredProjects.map((p, idx) => {
              const accentColor = FORMAT_COLORS[p.format] ?? "#5b4ccc";
              return (
                <div key={p.id} className="gw-card"
                  style={{ background: "#fff", borderRadius: 14, border: "1px solid " + GW_BORDER, padding: 0, cursor: "pointer", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", animationDelay: `${idx * 0.04}s`, position: "relative" }}
                  onClick={() => router.push("/project/" + p.id)}
                >
                  <div style={{ height: 3, background: accentColor }} />
                  <div style={{ padding: "18px 20px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, marginBottom: 4 }}>{p.name}</h2>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, background: accentColor + "18", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.8 }}>{p.format}</span>
                          <span style={{ fontSize: 11, color: "#aaa" }}>{p.chapters?.length ?? 0} chapter{(p.chapters?.length ?? 0) !== 1 ? "s" : ""}</span>
                        </div>
                        {p.genres?.length > 0 && (
                          <div style={{ fontSize: 11, color: "#888", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.genres.slice(0, 3).join(" · ")}</div>
                        )}
                      </div>
                      <button className="gw-del" onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: "2px 4px", marginLeft: 8, lineHeight: 1 }}
                        title="Delete project">✕</button>
                    </div>
                    <div style={{ fontSize: 11, color: "#ccc", marginTop: 14 }}>
                      {new Date(p.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      {/* ── Series & Universes ──────────────────────────────────────── */}
      <section style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid " + GW_BORDER }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, cursor: "pointer" }} onClick={() => setSeriesUniverseExpanded(v => !v)}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>📚 Series & Universes</span>
          <span style={{ fontSize: 11, color: "#aaa", background: "#f5f4f0", padding: "2px 8px", borderRadius: 10 }}>{seriesBibles.length + universes.length}</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#aaa" }}>{seriesUniverseExpanded ? "▲" : "▼"}</span>
        </div>

        {seriesUniverseExpanded && (
          <>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Series Bibles</div>
              <button
                onClick={() => setShowCreateBible(v => !v)}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: GW_GOLD, color: "#0d0d10", border: "none", cursor: "pointer" }}
              >
                + New Series Bible
              </button>
            </div>

            {showCreateBible && (
              <div style={{ padding: 20, borderRadius: 12, background: "#fff", border: "1px solid " + GW_BORDER, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#1a1a1a" }}>New Series Bible</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    value={newBibleName}
                    onChange={e => setNewBibleName(e.target.value)}
                    placeholder="Series name (e.g. The Ember Chronicles)"
                    style={inputS}
                  />
                  <textarea
                    value={newBiblePremise}
                    onChange={e => setNewBiblePremise(e.target.value)}
                    placeholder="Premise — 2-3 sentences about what this series is about"
                    rows={3}
                    style={{ ...inputS, resize: "vertical", fontFamily: "'Figtree', sans-serif" }}
                  />
                  {projects.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Link Projects</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {projects.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setNewBibleProjectIds(prev =>
                              prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                            )}
                            style={{
                              padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                              background: newBibleProjectIds.includes(p.id) ? GW_GOLD : "#f5f4f0",
                              color: newBibleProjectIds.includes(p.id) ? "#0d0d10" : "#555",
                              border: "1px solid " + (newBibleProjectIds.includes(p.id) ? GW_GOLD : GW_BORDER),
                              fontWeight: newBibleProjectIds.includes(p.id) ? 600 : 400,
                            }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={createBible} disabled={creatingBible || !newBibleName.trim()} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: GW_GOLD, color: "#0d0d10", border: "none", cursor: (creatingBible || !newBibleName.trim()) ? "not-allowed" : "pointer", opacity: (creatingBible || !newBibleName.trim()) ? 0.6 : 1 }}>
                      {creatingBible ? "Creating…" : "Create"}
                    </button>
                    <button onClick={() => { setShowCreateBible(false); setNewBibleName(""); setNewBiblePremise(""); setNewBibleProjectIds([]); }} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, border: "1px solid " + GW_BORDER, background: "#fff", color: "#888", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {seriesBibles.length === 0 && !showCreateBible && (
              <p style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>No series bibles yet. Create one to track elements that span multiple books.</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {seriesBibles.map(b => {
                const active = seriesFilter?.id === b.id;
                return (
                <div key={b.id}
                  onClick={() => setSeriesFilter(active ? null : { id: b.id, name: b.name, projectIds: b.projectIds })}
                  style={{ background: active ? "#fefce8" : "#fff", borderRadius: 12, border: `1px solid ${active ? GW_GOLD : GW_BORDER}`, padding: "16px 18px", position: "relative", cursor: "pointer" }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>{b.name}</div>
                  {b.premise && (
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {b.premise}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: active ? "#92400e" : "#bbb", fontWeight: active ? 700 : 400 }}>
                    {(b.projectIds as string[]).length} linked project{(b.projectIds as string[]).length !== 1 ? "s" : ""} · {new Date(b.updatedAt).toLocaleDateString()}
                    {active && " · showing in projects above"}
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteBible(b.id); if (active) setSeriesFilter(null); }} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 13 }}>✕</button>
                </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>🌌 Universes</span>
                <span style={{ fontSize: 9, background: "rgba(29,158,117,0.12)", color: "#1d9e75", padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>NEW</span>
              </div>
              <button onClick={() => setShowCreateUniverse(true)} style={{ fontSize: 12, fontWeight: 600, background: GW_GOLD, color: "#0d0d10", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
                + New Universe
              </button>
            </div>
            {showCreateUniverse && (
              <div style={{ padding: 20, borderRadius: 12, background: "#fff", border: "1px solid " + GW_BORDER, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#1a1a1a" }}>New Universe</div>
                <input
                  value={newUniverseName}
                  onChange={e => setNewUniverseName(e.target.value)}
                  placeholder="Universe name…"
                  onKeyDown={e => e.key === "Enter" && createUniverse()}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + GW_BORDER, fontSize: 13, marginBottom: 12, fontFamily: "'Figtree', sans-serif", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={createUniverse} disabled={creatingUniverse || !newUniverseName.trim()} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: GW_GOLD, color: "#0d0d10", border: "none", cursor: (creatingUniverse || !newUniverseName.trim()) ? "not-allowed" : "pointer", opacity: (creatingUniverse || !newUniverseName.trim()) ? 0.6 : 1 }}>
                    {creatingUniverse ? "Creating…" : "Create"}
                  </button>
                  <button onClick={() => { setShowCreateUniverse(false); setNewUniverseName(""); }} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, border: "1px solid " + GW_BORDER, background: "#fff", color: "#888", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {universes.length === 0 && !showCreateUniverse && (
              <p style={{ fontSize: 13, color: "#aaa", padding: "16px 0" }}>No universes yet. Create one to build your own Cosmere or MCU — multiple standalone stories in one shared world.</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {universes.map(u => (
                <a key={u.id} href={`/universe/${u.id}`} style={{ textDecoration: "none", display: "block", background: "#fff", borderRadius: 12, border: "1px solid " + GW_BORDER, padding: "16px 18px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>🌌 {u.name}</div>
                  {u.premise && (
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                      {u.premise}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
          </>
        )}
      </section>
      </main>

      {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}

      {/* Overlay helper */}
      {(showCreate || !!deleteTarget) && (
        <style>{`.gw-modal-input:focus { border-color: ${GW_GOLD} !important; outline: none !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.12) !important; }`}</style>
      )}

      {/* Create project modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }} onClick={() => { setShowCreate(false); setCreationMode('structured'); setBraindumpText(''); setBraindumpResult(null); setPendingSeriesLink(null); }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 400, maxHeight: "85vh", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "28px 28px 0" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, marginBottom: 20, color: "#1a1a1a" }}>New Project</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => { setCreationMode('structured'); setBraindumpResult(null); }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    background: creationMode === 'structured' ? GW_GOLD : '#f5f4f0',
                    border: `1px solid ${creationMode === 'structured' ? GW_GOLD : GW_BORDER}`,
                    color: creationMode === 'structured' ? '#0d0d10' : '#888',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Start structured
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode('braindump')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    background: creationMode === 'braindump' ? GW_GOLD : '#f5f4f0',
                    border: `1px solid ${creationMode === 'braindump' ? GW_GOLD : GW_BORDER}`,
                    color: creationMode === 'braindump' ? '#0d0d10' : '#888',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  ✨ Braindump
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode('import')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    background: creationMode === 'import' ? GW_GOLD : '#f5f4f0',
                    border: `1px solid ${creationMode === 'import' ? GW_GOLD : GW_BORDER}`,
                    color: creationMode === 'import' ? '#0d0d10' : '#888',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  📄 Import manuscript
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 28px" }}>
              {creationMode === 'structured' && (
              <form id="create-project-form" onSubmit={createProject} style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Title</label>
                  <input autoFocus type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Novel" className="gw-modal-input" style={inputS} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Format</label>
                  <select value={newFormat} onChange={e => setNewFormat(e.target.value)} className="gw-modal-input" style={{ ...inputS, cursor: "pointer" }}>
                    {FORMATS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>What kind of story?</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {([
                      { id: "linear", label: "One Story", desc: "A single story, beginning to end.", examples: "Novel · Screenplay · Film", icon: "◆" },
                      { id: "series", label: "Book Series", desc: "Multiple books where each builds on the last.", examples: "Harry Potter · Mistborn · Web Serials", icon: "📚" },
                      { id: "universe-story", label: "Your Universe", desc: "Separate stories in one world — each stands alone but connects.", examples: "MCU · Cosmere · Star Wars", icon: "🌌", badge: "NEW" },
                    ] as { id: "linear" | "series" | "universe-story"; label: string; desc: string; examples: string; icon: string; badge?: string }[]).map(type => (
                      <button key={type.id} type="button" onClick={() => setNewStoryType(type.id)}
                        style={{ textAlign: "left", padding: "10px 12px", background: newStoryType === type.id ? "#fefce8" : "#f9f9f9", border: `1px solid ${newStoryType === type.id ? GW_GOLD : GW_BORDER}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 14 }}>{type.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{type.label}</span>
                          {type.badge && <span style={{ fontSize: 9, background: "rgba(29,158,117,0.12)", color: "#1d9e75", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>{type.badge}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "#888" }}>{type.desc}</div>
                        <div style={{ fontSize: 10, color: "#aaa" }}>e.g. {type.examples}</div>
                      </button>
                    ))}
                    <button type="button" disabled style={{ textAlign: "left", padding: "10px 12px", background: "#f9f9f9", border: `1px solid ${GW_BORDER}`, borderRadius: 10, cursor: "default", opacity: 0.45 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 14 }}>▶</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>Multiple Storylines</span>
                        <span style={{ fontSize: 9, color: "#aaa", marginLeft: "auto" }}>Coming soon</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#888" }}>Different characters in parallel, eventually converging.</div>
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Experience Level</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {(["beginner", "expert"] as const).map(lvl => (
                      <button key={lvl} type="button" onClick={() => setNewSkillLevel(lvl)}
                        style={{ flex: 1, padding: "10px 0", border: `1px solid ${newSkillLevel === lvl ? GW_GOLD : GW_BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Figtree', sans-serif", background: newSkillLevel === lvl ? "#fefce8" : "#fff", color: newSkillLevel === lvl ? "#92400e" : "#888", transition: "all 0.15s" }}>
                        {lvl === "beginner" ? "🎯 Beginner" : "⭐ Expert"}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>
                    {newSkillLevel === "beginner" ? "Quick start: AI generates story from minimal input" : "Full control: Build detailed world with AI as assistant"}
                  </div>
                </div>
              </form>
              )}

              {creationMode === 'braindump' && !braindumpResult && (
                <div style={{ paddingBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                    Write anything you know about your story. Don't organize it — fragments, character
                    names, scenes you imagine, themes, contradictions. The messier the better.
                  </div>
                  <textarea
                    value={braindumpText}
                    onChange={e => setBraindumpText(e.target.value)}
                    placeholder="e.g. A detective in 1920s Bombay who solves murders but is secretly haunted by his own past crime. Something about monsoon season. The villain might be a woman — no, definitely a woman, charming and ruthless. There's a train. The detective has a bad leg. He drinks too much. A young journalist keeps interfering..."
                    rows={8}
                    style={{ ...inputS, resize: 'vertical', fontFamily: "'Figtree', sans-serif" }}
                  />
                </div>
              )}

              {creationMode === 'import' && (
                <div style={{ paddingBottom: 20 }}>
                  <p style={{ fontSize: 12, color: "#aaa", marginBottom: 14, lineHeight: 1.6 }}>
                    Currently supports <strong>Scrivener</strong> project exports. In Scrivener: <strong>File → Export → Files</strong> → select <strong>RTF</strong> → OK. Zip the exported folder and upload here. (Word/.docx and plain-text import are planned but not yet available.)
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>ZIP File (Scrivener export)</label>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null;
                          setImportFile(f);
                          if (f && !importName) setImportName(f.name.replace(/\.(zip|scriv)$/i, ''));
                        }}
                        style={{ fontSize: 12, color: "#888", width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Project Name</label>
                      <input
                        type="text"
                        value={importName}
                        onChange={e => setImportName(e.target.value)}
                        placeholder="My Novel"
                        className="gw-modal-input"
                        style={inputS}
                      />
                    </div>
                    {importMsg && <div style={{ fontSize: 12, color: "#ef4444" }}>{importMsg}</div>}
                  </div>
                </div>
              )}

              {braindumpResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1d9e75' }}>
                    ✓ Found your story — review before creating:
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Project name</label>
                    <input
                      value={braindumpResult.projectName}
                      onChange={e => setBraindumpResult({...braindumpResult, projectName: e.target.value})}
                      style={inputS}
                    />
                  </div>

                  <div style={{ padding: '8px 12px', background: '#f5f4f0', borderRadius: 8,
                                fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                    {braindumpResult.premise}
                  </div>

                  {braindumpResult.characters.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                        Characters found ({braindumpResult.characters.length})
                      </div>
                      {braindumpResult.characters.map((c, i) => (
                        <div key={i} style={{ fontSize: 12, padding: '6px 10px', color: '#555',
                                              background: '#f5f4f0', borderRadius: 6, marginBottom: 4 }}>
                          <strong>{c.name}</strong> ({c.role}) — {c.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "16px 28px 24px", borderTop: "1px solid " + GW_BORDER }}>
              {creationMode === 'structured' && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => { setShowCreate(false); setCreationMode('structured'); setBraindumpText(''); setBraindumpResult(null); setPendingSeriesLink(null); }}
                    style={{ flex: 1, border: "1px solid " + GW_BORDER, background: "#fff", color: "#888", fontWeight: 600, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
                    Cancel
                  </button>
                  <button type="submit" form="create-project-form" disabled={creating} className="gw-gold-btn"
                    style={{ flex: 1, background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}>
                    {creating ? "Creating…" : "Create"}
                  </button>
                </div>
              )}

              {creationMode === 'braindump' && !braindumpResult && (
                <>
                  <button
                    type="button"
                    onClick={handleProcessBraindump}
                    disabled={braindumpText.trim().length < 50 || braindumpProcessing}
                    className="gw-gold-btn"
                    style={{ width: '100%', padding: '10px', borderRadius: 10,
                             background: GW_GOLD, color: '#0d0d10', border: 'none',
                             cursor: braindumpText.trim().length < 50 ? 'default' : 'pointer',
                             opacity: braindumpText.trim().length < 50 ? 0.5 : 1,
                             fontSize: 13, fontWeight: 700, fontFamily: "'Figtree', sans-serif" }}
                  >
                    {braindumpProcessing ? 'Organizing your ideas...' : 'Organize into a project →'}
                  </button>
                  <button type="button" onClick={() => { setShowCreate(false); setCreationMode('structured'); setBraindumpText(''); setBraindumpResult(null); setPendingSeriesLink(null); }}
                    style={{ marginTop: 8, width: '100%', border: '1px solid ' + GW_BORDER, background: '#fff', color: '#888', fontWeight: 600, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
                    Cancel
                  </button>
                </>
              )}

              {creationMode === 'import' && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => { setShowCreate(false); setCreationMode('structured'); setImportFile(null); setImportName(''); setImportMsg(''); }}
                    style={{ flex: 1, border: "1px solid " + GW_BORDER, background: "#fff", color: "#888", fontWeight: 600, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
                    Cancel
                  </button>
                  <button onClick={handleScrivenerImport} disabled={!importFile || importing} className="gw-gold-btn"
                    style={{ flex: 1, background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: (!importFile || importing) ? "not-allowed" : "pointer", opacity: (!importFile || importing) ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}>
                    {importing ? "Importing…" : "Import"}
                  </button>
                </div>
              )}

              {braindumpResult && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setBraindumpResult(null)}
                    style={{ flex: 1, border: '1px solid ' + GW_BORDER, background: '#fff', color: '#888', fontWeight: 600, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}
                  >
                    ← Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateFromBraindump}
                    disabled={creating}
                    className="gw-gold-btn"
                    style={{ flex: 2, background: GW_GOLD, color: '#0d0d10', border: 'none', fontWeight: 700, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}
                  >
                    {creating ? 'Creating…' : 'Create project →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "28px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, marginBottom: 10, color: "#1a1a1a" }}>Delete &ldquo;{deleteTarget.name}&rdquo;?</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 24, lineHeight: 1.6 }}>This permanently deletes the project and all its chapters. This cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, border: "1px solid " + GW_BORDER, background: "#fff", color: "#888", fontWeight: 600, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ flex: 1, background: "#ef4444", color: "#fff", border: "none", fontWeight: 700, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
