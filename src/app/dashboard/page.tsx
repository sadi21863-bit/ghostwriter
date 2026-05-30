"use client";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import { EmptyState } from "@/components/EmptyState";
import { FORMATS } from "@/lib/formats";

type Project = {
  id: string;
  name: string;
  format: string;
  genres: string[];
  updatedAt: string;
  chapters: { id: string }[];
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState("Novel");
  const [newSkillLevel, setNewSkillLevel] = useState<"beginner" | "expert">("beginner");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [higgsfieldKeySet, setHiggsfieldKeySet] = useState(false);
  const [higgsfieldKeyLast4, setHiggsfieldKeyLast4] = useState("");
  const [higgsfieldInput, setHiggsfieldInput] = useState("");
  const [higgsfieldSecretSet, setHiggsfieldSecretSet] = useState(false);
  const [higgsfieldSecretLast4, setHiggsfieldSecretLast4] = useState("");
  const [higgsfieldSecretInput, setHiggsfieldSecretInput] = useState("");
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [openaiKeyLast4, setOpenaiKeyLast4] = useState("");
  const [openaiInput, setOpenaiInput] = useState("");
  const [imageProviderId, setImageProviderId] = useState("segmind_soul");
  const [trendKeySet, setTrendKeySet] = useState(false);
  const [trendKeyLast4, setTrendKeyLast4] = useState("");
  const [trendKeyInput, setTrendKeyInput] = useState("");
  const [showTrendKeyInput, setShowTrendKeyInput] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [search, setSearch] = useState("");
  const [filterFormat, setFilterFormat] = useState("All");

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
    fetch("/api/user/settings").then(r => r.json()).then(data => {
      setHiggsfieldKeySet(data.higgsfieldKeySet ?? false);
      setHiggsfieldKeyLast4(data.higgsfieldKeyLast4 ?? "");
      setHiggsfieldSecretSet(data.higgsfieldSecretSet ?? false);
      setHiggsfieldSecretLast4(data.higgsfieldSecretLast4 ?? "");
      setOpenaiKeySet(data.openaiKeySet ?? false);
      setOpenaiKeyLast4(data.openaiKeyLast4 ?? "");
      setImageProviderId(data.imageProviderId ?? "segmind_soul");
      setTrendKeySet(data.trendIntelligenceKeySet ?? false);
      setTrendKeyLast4(data.trendIntelligenceKeyLast4 ?? "");
    }).catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/projects")
      .then(r => r.json())
      .then(setProjects)
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  }, [status]);

  const createProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), format: newFormat, skillLevel: newSkillLevel }),
      });
      const p = await res.json();
      setShowCreate(false);
      setNewName("");
      setNewFormat("Novel");
      setNewSkillLevel("beginner");
      router.push("/project/" + p.id);
    } catch {
      setError("Failed to create project");
      setCreating(false);
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg("");
    try {
      const body: Record<string, any> = { imageProviderId };
      if (higgsfieldInput.trim()) body.higgsfieldApiKey = higgsfieldInput.trim();
      if (higgsfieldSecretInput.trim()) body.higgsfieldApiSecret = higgsfieldSecretInput.trim();
      if (openaiInput.trim()) body.openaiApiKey = openaiInput.trim();
      if (trendKeyInput.trim()) body.trendIntelligenceKey = trendKeyInput.trim();
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (higgsfieldInput.trim()) { setHiggsfieldKeySet(true); setHiggsfieldKeyLast4(higgsfieldInput.trim().slice(-4)); setHiggsfieldInput(""); }
        if (higgsfieldSecretInput.trim()) { setHiggsfieldSecretSet(true); setHiggsfieldSecretLast4(higgsfieldSecretInput.trim().slice(-4)); setHiggsfieldSecretInput(""); }
        if (openaiInput.trim()) { setOpenaiKeySet(true); setOpenaiKeyLast4(openaiInput.trim().slice(-4)); setOpenaiInput(""); }
        if (trendKeyInput.trim()) { setTrendKeySet(true); setTrendKeyLast4(trendKeyInput.trim().slice(-4)); setTrendKeyInput(""); setShowTrendKeyInput(false); }
        setSettingsMsg("Saved!");
        setTimeout(() => setSettingsMsg(""), 2000);
      } else {
        setSettingsMsg("Failed to save.");
      }
    } catch {
      setSettingsMsg("Network error.");
    }
    setSettingsSaving(false);
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
    (filterFormat === "All" || p.format === filterFormat)
  );

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
          <span style={{ fontSize: 12, color: "#444", marginRight: 8 }}>
            {session?.user?.name || session?.user?.email}
          </span>
          <button className="gw-hdr-btn" onClick={() => setShowSettings(true)}
            style={{ fontSize: 12, color: "#666", background: "transparent", border: "1px solid #1e1e2a", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
            ⚙ Settings
          </button>
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
          <button className="gw-gold-btn" onClick={() => setShowCreate(true)}
            style={{ background: GW_GOLD, color: "#0d0d10", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Figtree', sans-serif", letterSpacing: 0.3 }}>
            + New Project
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#c54444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginBottom: 24 }}>{error}</div>
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
      </main>

      {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}

      {/* Overlay helper */}
      {(showCreate || showSettings || !!deleteTarget) && (
        <style>{`.gw-modal-input:focus { border-color: ${GW_GOLD} !important; outline: none !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.12) !important; }`}</style>
      )}

      {/* Create project modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }} onClick={() => setShowCreate(false)}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, marginBottom: 24, color: "#1a1a1a" }}>New Project</div>
            <form onSubmit={createProject} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ flex: 1, border: "1px solid " + GW_BORDER, background: "#fff", color: "#888", fontWeight: 600, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="gw-gold-btn"
                  style={{ flex: 1, background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }} onClick={() => setShowSettings(false)}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "28px", width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, marginBottom: 24, color: "#1a1a1a" }}>Settings</div>

            {[
              { title: "Higgsfield Integration", content: (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>API Key</label>
                    {higgsfieldKeySet && <div style={{ fontSize: 11, color: "#16a34a", marginBottom: 6 }}>✓ Connected — ••••{higgsfieldKeyLast4}</div>}
                    <input type="password" value={higgsfieldInput} onChange={e => setHiggsfieldInput(e.target.value)} placeholder={higgsfieldKeySet ? "Enter new key to update" : "hf-xxxxxxxxxxxxxxxx"} className="gw-modal-input" style={inputS} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>API Secret</label>
                    {higgsfieldSecretSet && <div style={{ fontSize: 11, color: "#16a34a", marginBottom: 6 }}>✓ Connected — ••••{higgsfieldSecretLast4}</div>}
                    <input type="password" value={higgsfieldSecretInput} onChange={e => setHiggsfieldSecretInput(e.target.value)} placeholder={higgsfieldSecretSet ? "Enter new secret to update" : "API Secret"} className="gw-modal-input" style={inputS} />
                  </div>
                  <div style={{ fontSize: 11, color: higgsfieldKeySet ? "#16a34a" : "#d97706" }}>
                    {higgsfieldKeySet ? "✅ Comics and Production Studio enabled." : "⚠ Not connected. Get key at higgsfield.ai → Account → API Keys."}
                  </div>
                </div>
              )},
              { title: "Image Generation", content: (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <select value={imageProviderId} onChange={e => setImageProviderId(e.target.value)} className="gw-modal-input" style={{ ...inputS, cursor: "pointer" }}>
                    <option value="segmind_soul">Higgsfield Soul 2.0 — Recommended</option>
                    <option value="openai_gpt_image">GPT Image 2 — OpenAI</option>
                  </select>
                  {imageProviderId === "openai_gpt_image" && (
                    <div>
                      {openaiKeySet && <div style={{ fontSize: 11, color: "#16a34a", marginBottom: 6 }}>✓ Connected — ••••{openaiKeyLast4}</div>}
                      <input type="password" value={openaiInput} onChange={e => setOpenaiInput(e.target.value)} placeholder={openaiKeySet ? "Enter new key to update" : "sk-..."} className="gw-modal-input" style={inputS} />
                    </div>
                  )}
                </div>
              )},
              { title: "Trend Intelligence", content: (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {trendKeySet
                    ? <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, color: "#16a34a" }}>✓ Connected — ••••{trendKeyLast4}</div>
                        <button style={{ background: "none", border: "none", fontSize: 11, color: "#aaa", cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowTrendKeyInput(true)}>Update</button>
                      </div>
                    : <div style={{ fontSize: 11, color: "#aaa" }}>Not connected. Activate from the Trends tab inside any creator project.</div>
                  }
                  {(!trendKeySet || showTrendKeyInput) && (
                    <input type="password" value={trendKeyInput} onChange={e => setTrendKeyInput(e.target.value)} placeholder={trendKeySet ? "Enter new key to update" : "Enter your personal data key"} className="gw-modal-input" style={inputS} />
                  )}
                </div>
              )},
            ].map(({ title, content }) => (
              <div key={title} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid " + GW_BORDER }}>{title}</div>
                {content}
              </div>
            ))}

            {settingsMsg && <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, marginBottom: 14 }}>{settingsMsg}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowSettings(false)}
                style={{ flex: 1, border: "1px solid " + GW_BORDER, background: "#fff", color: "#888", fontWeight: 600, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
                Cancel
              </button>
              <button onClick={saveSettings} disabled={settingsSaving} className="gw-gold-btn"
                style={{ flex: 1, background: GW_GOLD, color: "#0d0d10", border: "none", fontWeight: 700, padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: settingsSaving ? "not-allowed" : "pointer", opacity: settingsSaving ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}>
                {settingsSaving ? "Saving…" : "Save"}
              </button>
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
