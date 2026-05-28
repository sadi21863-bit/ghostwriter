"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";
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

  const createProject = async (e: React.FormEvent) => {
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

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg">
        <span className="text-brand font-semibold text-base">Loading…</span>
      </div>
    );
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

  return (
    <div className="min-h-screen bg-surface-bg">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-extrabold text-brand">GhostWriter</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:block">
            {session?.user?.name || session?.user?.email}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">Your Projects</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand text-white font-bold px-4 py-2 rounded-lg hover:bg-brand-light transition-colors text-sm"
          >
            + New Project
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2 mb-5">
            {error}
          </p>
        )}

        {projects.length > 0 && (
          <div className="flex gap-3 mb-6">
            <input type="text" placeholder="Search projects..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="All">All formats</option>
              {FORMATS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        )}

        {(() => {
          const filteredProjects = projects.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) &&
            (filterFormat === "All" || p.format === filterFormat)
          );
          return projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-300 text-5xl mb-4">✦</p>
            <p className="text-gray-500 text-base font-medium mb-2">No projects yet</p>
            <p className="text-gray-400 text-sm mb-6">Create your first project to start writing.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-brand text-white font-bold px-6 py-2.5 rounded-lg hover:bg-brand-light transition-colors text-sm"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(p => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push("/project/" + p.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-gray-900 truncate text-base">{p.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.format} · {p.chapters?.length ?? 0} chapter{(p.chapters?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                    {p.genres?.length > 0 && (
                      <p className="text-xs text-brand mt-1 truncate">{p.genres.slice(0, 3).join(", ")}</p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                    className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-base font-bold p-1 rounded leading-none"
                    title="Delete project"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-300 mt-4">
                  {new Date(p.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        );
        })()}
      </main>

      {/* Onboarding Modal */}
      {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}

      {/* Create project modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold mb-5">New Project</h2>
            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Title</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My Novel"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Format</label>
                <select
                  value={newFormat}
                  onChange={e => setNewFormat(e.target.value)}
                  className={inputCls}
                >
                  {FORMATS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Experience Level</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewSkillLevel("beginner")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${newSkillLevel === "beginner"
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    🎯 Beginner
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSkillLevel("expert")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${newSkillLevel === "expert"
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    ⭐ Expert
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {newSkillLevel === "beginner"
                    ? "Quick start: AI generates story from minimal input"
                    : "Full control: Build detailed world with AI as assistant"}
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-brand text-white font-bold py-2 rounded-lg text-sm hover:bg-brand-light disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold mb-5">⚙️ Settings</h2>
            <div className="mb-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
                Higgsfield Integration
              </div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                Higgsfield API Key
              </label>
              {higgsfieldKeySet ? (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600 font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1">
                    ••••••••••••••••  last4: {higgsfieldKeyLast4}
                  </span>
                  <button
                    onClick={() => setHiggsfieldInput("")}
                    className="text-sm text-brand font-semibold hover:underline"
                  >
                    Update
                  </button>
                </div>
              ) : null}
              <input
                type="password"
                value={higgsfieldInput}
                onChange={e => setHiggsfieldInput(e.target.value)}
                placeholder={higgsfieldKeySet ? "Enter new key to update" : "hf-xxxxxxxxxxxxxxxx"}
                className={inputCls}
              />
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 mt-3">
                Higgsfield API Secret
              </label>
              {higgsfieldSecretSet ? (
                <p className="text-xs text-green-600 font-semibold mb-2">Connected — last 4: {higgsfieldSecretLast4}</p>
              ) : null}
              <input
                type="password"
                value={higgsfieldSecretInput}
                onChange={e => setHiggsfieldSecretInput(e.target.value)}
                placeholder={higgsfieldSecretSet ? "Enter new secret to update" : "Higgsfield API Secret (required for Soul ID training)"}
                className={inputCls}
              />
              {higgsfieldKeySet ? (
                <p className="text-xs text-green-600 font-semibold mt-2">
                  ✅ Connected — Comics and Production Studio are enabled.
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ Not connected. Get your key at higgsfield.ai → Account → API Keys.
                  Your credits pay for image and video generation directly.
                </p>
              )}
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
                Image Generation
              </div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Provider</label>
              <select value={imageProviderId} onChange={e => setImageProviderId(e.target.value)} className={inputCls}>
                <option value="segmind_soul">Higgsfield Soul 2.0 — Recommended (best for character-consistent comic panels)</option>
                <option value="openai_gpt_image">GPT Image 2 — OpenAI (superior general image quality, uses OpenAI key)</option>
              </select>
              {imageProviderId === "openai_gpt_image" && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">OpenAI API Key</label>
                  {openaiKeySet && <p className="text-xs text-green-600 font-semibold mb-2">Connected — last 4: {openaiKeyLast4}</p>}
                  <input type="password" value={openaiInput} onChange={e => setOpenaiInput(e.target.value)}
                    placeholder={openaiKeySet ? "Enter new key to update" : "sk-..."} className={inputCls} />
                  <p className="text-xs text-gray-400 mt-1">Your credits pay for GPT Image 2 generation directly.</p>
                </div>
              )}
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
                Trend Intelligence
              </div>
              {trendKeySet ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-600">✓ Connected — last 4: {trendKeyLast4}</p>
                    <p className="text-xs text-gray-400 mt-1">Powers live Instagram Reels trend analysis.</p>
                  </div>
                  <button className="text-xs text-gray-400 underline" onClick={() => setShowTrendKeyInput(true)}>Update</button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Not connected. Activate from the Trends tab inside any creator project.</p>
              )}
              {(!trendKeySet || showTrendKeyInput) && (
                <div className="mt-3">
                  <input type="password" value={trendKeyInput} onChange={e => setTrendKeyInput(e.target.value)}
                    placeholder={trendKeySet ? "Enter new key to update" : "Enter your personal data key"} className={inputCls} />
                </div>
              )}
            </div>
            {settingsMsg && (
              <p className="text-sm text-green-600 font-semibold mb-3">{settingsMsg}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={settingsSaving}
                className="flex-1 bg-brand text-white font-bold py-2 rounded-lg text-sm hover:bg-brand-light disabled:opacity-50"
              >
                {settingsSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-2">Delete &ldquo;{deleteTarget.name}&rdquo;?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This permanently deletes the project and all its chapters. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white font-bold py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
