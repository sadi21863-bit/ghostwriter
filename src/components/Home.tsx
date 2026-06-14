"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import BraindumpModal from "@/components/BraindumpModal";
import { EmptyState } from "@/components/EmptyState";
import { nextAction, getContinueChapterId, type GuideAction, type GuideProject } from "@/lib/guide/next-action";

type ProjectSummary = {
  id: string;
  name: string;
  format: string;
  genres: string[];
  updatedAt: string;
  chapters: { id: string; title: string; wordCount: number; sortOrder: number }[];
  characters: { id: string; name: string }[];
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

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideAction, setGuideAction] = useState<GuideAction | null>(null);
  const [showBraindump, setShowBraindump] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/projects")
      .then(r => r.json())
      .then((data: ProjectSummary[]) => {
        setProjects(data);
        setLoading(false);
        const mostRecent = data[0];
        if (!mostRecent) return;
        fetch(`/api/projects/${mostRecent.id}`)
          .then(r => r.json())
          .then((detail: GuideProject) => setGuideAction(nextAction(detail)))
          .catch(() => {});
      })
      .catch(() => setLoading(false));
  }, [status]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: GW_DARK }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Figtree:wght@400;500;600;700&display=swap');`}</style>
        <span style={{ color: GW_GOLD, fontSize: 14, fontFamily: "'Figtree', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Loading…</span>
      </div>
    );
  }

  const mostRecent = projects[0];
  const others = projects.slice(1);
  const continueChapterId = mostRecent ? getContinueChapterId(mostRecent.chapters, guideAction) : null;
  const continueHref = mostRecent
    ? `/project/${mostRecent.id}${continueChapterId ? `?chapter=${continueChapterId}` : ""}`
    : "";

  return (
    <div style={{ minHeight: "100vh", background: GW_CREAM, fontFamily: "'Figtree', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Figtree:wght@400;500;600;700&display=swap');
        @keyframes gw-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .gw-card { animation: gw-in 0.3s ease both; transition: box-shadow 0.2s, transform 0.18s; }
        .gw-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.10) !important; transform: translateY(-2px); }
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

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
        {!mostRecent ? (
          <div style={{ padding: "80px 0" }}>
            <EmptyState
              icon="✨"
              title="Your stories live here"
              description="Start a novel, screenplay, YouTube channel, or podcast project."
              action={{ label: "New story", onClick: () => setShowBraindump(true) }}
            />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 12 }}>Continue</div>
            <div className="gw-card" onClick={() => router.push(continueHref)}
              style={{ background: "#fff", borderRadius: 16, border: "1px solid " + GW_BORDER, padding: "28px 28px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: FORMAT_COLORS[mostRecent.format] ?? "#5b4ccc", background: (FORMAT_COLORS[mostRecent.format] ?? "#5b4ccc") + "18", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {mostRecent.format}
                </span>
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: "#1a1a1a", fontWeight: 600, margin: "0 0 12px" }}>
                {mostRecent.name}
              </h1>
              {guideAction && (
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 20px" }}>
                  {guideAction.message}
                </p>
              )}
              <button className="gw-gold-btn" style={{ background: GW_GOLD, color: "#0d0d10", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Figtree', sans-serif", letterSpacing: 0.3 }}>
                {guideAction?.cta ? `${guideAction.cta} →` : "Continue writing →"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
              <button className="gw-gold-btn" onClick={() => setShowBraindump(true)}
                style={{ background: "transparent", color: "#888", border: "1px solid " + GW_BORDER, borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
                + New story
              </button>
            </div>

            {others.length > 0 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 12 }}>Other projects</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {others.map(p => (
                    <div key={p.id} className="gw-card" onClick={() => router.push(`/project/${p.id}`)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#fff", borderRadius: 10, border: "1px solid " + GW_BORDER, cursor: "pointer" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{p.format}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {showBraindump && <BraindumpModal onClose={() => setShowBraindump(false)} />}
    </div>
  );
}
