"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  format: string;
  genres: string[];
  updatedAt: string;
  chapters: { id: string }[];
};

const FORMATS = ["Novel", "Screenplay", "Web Series"];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState("Novel");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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
        body: JSON.stringify({ name: newName.trim(), format: newFormat }),
      });
      const p = await res.json();
      setShowCreate(false);
      setNewName("");
      setNewFormat("Novel");
      router.push("/project/" + p.id);
    } catch {
      setError("Failed to create project");
      setCreating(false);
    }
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

        {projects.length === 0 ? (
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
            {projects.map(p => (
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
        )}
      </main>

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
