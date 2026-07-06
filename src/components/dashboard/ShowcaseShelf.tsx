"use client";
import { SHELF_PALETTE, hashPaletteIndex } from "./shelfColor";

type ShelfShowcase = { projectId: string; slug: string; title: string; visibility: string };
type ShelfProject = { id: string; name: string; format: string };

const VISIBILITY_BADGE: Record<string, { label: string; color: string }> = {
  private: { label: "Private", color: "var(--gw-t3)" },
  unlisted: { label: "Unlisted", color: "#fbbf24" },
  public: { label: "Public", color: "#22d3ee" },
};

function ShowcaseCard({ showcase, project, onOpen }: {
  showcase: ShelfShowcase; project: ShelfProject | undefined; onOpen: () => void;
}) {
  const name = showcase.title || project?.name || "Untitled";
  const color = SHELF_PALETTE[hashPaletteIndex(name, SHELF_PALETTE.length)];
  const badge = VISIBILITY_BADGE[showcase.visibility] ?? VISIBILITY_BADGE.private;

  return (
    <div
      onClick={onOpen}
      style={{
        flexShrink: 0, width: 168, borderRadius: 12, cursor: "pointer", padding: 16,
        background: `linear-gradient(160deg, ${color}22 0%, var(--gw-card) 58%)`,
        border: "1px solid var(--gw-border)",
        boxShadow: "0 4px 14px rgba(0,0,0,.18)",
        transition: "transform .2s",
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "22", border: "1px solid " + color + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginBottom: 10 }}>🖼</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--gw-t1)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
      <div style={{ fontSize: 11, color: "var(--gw-t3)", marginBottom: 8 }}>{project?.format ?? ""}</div>
      <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, background: badge.color + "1a", padding: "2px 8px", borderRadius: 8 }}>{badge.label}</span>
    </div>
  );
}

export function ShowcaseShelf({ showcases, projects, onOpen }: {
  showcases: ShelfShowcase[]; projects: ShelfProject[]; onOpen: (projectId: string) => void;
}) {
  if (showcases.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "4px 4px 12px" }}>
      {showcases.map(sc => (
        <ShowcaseCard
          key={sc.projectId}
          showcase={sc}
          project={projects.find(p => p.id === sc.projectId)}
          onOpen={() => onOpen(sc.projectId)}
        />
      ))}
    </div>
  );
}
