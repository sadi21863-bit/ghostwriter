"use client";
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardCommandPaletteProps = {
  projects: { id: string; name: string; format: string }[];
  onNewProject: () => void;
  onImportManuscript: () => void;
  onRestartOnboarding: () => void;
};

export function DashboardCommandPalette({ projects, onNewProject, onImportManuscript, onRestartOnboarding }: DashboardCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  const close = () => { setOpen(false); setSearch(""); };

  const itemStyle: React.CSSProperties = {
    padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 14,
    color: "var(--gw-t1)", outline: "none",
  };
  const groupHeadingStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "var(--gw-t3)",
    textTransform: "uppercase", letterSpacing: 1, padding: "8px 12px 4px",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "14vh", zIndex: 9999 }}
      onClick={close}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="gw-modal"
        style={{ width: 520, maxWidth: "90vw", background: "var(--gw-card)", borderRadius: 16, border: "1px solid var(--gw-border)", overflow: "hidden", boxShadow: "0 28px 80px rgba(0,0,0,.5)" }}
      >
        <Command>
          <Command.Input
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder="Jump to a project, or run a command…"
            style={{
              width: "100%", padding: "15px 18px", fontSize: 15, background: "transparent", border: "none",
              borderBottom: "1px solid var(--gw-border)", color: "var(--gw-t1)", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
          <Command.List style={{ padding: 8, maxHeight: 340, overflowY: "auto" }}>
            <Command.Empty style={{ padding: 24, textAlign: "center", color: "var(--gw-t3)", fontSize: 13 }}>No matches</Command.Empty>

            <Command.Group heading="Actions">
              <div style={groupHeadingStyle}>Actions</div>
              <Command.Item onSelect={() => { onNewProject(); close(); }} style={itemStyle}>+ New project</Command.Item>
              <Command.Item onSelect={() => { onImportManuscript(); close(); }} style={itemStyle}>⇪ Import manuscript</Command.Item>
              <Command.Item onSelect={() => { onRestartOnboarding(); close(); }} style={itemStyle}>✦ Restart onboarding</Command.Item>
              <Command.Item onSelect={() => { router.push("/settings"); close(); }} style={itemStyle}>⚙ Open Settings</Command.Item>
            </Command.Group>

            {projects.length > 0 && (
              <Command.Group heading="Projects">
                <div style={groupHeadingStyle}>Projects</div>
                {projects.map(p => (
                  <Command.Item key={p.id} onSelect={() => { router.push("/project/" + p.id); close(); }} style={itemStyle}>
                    ▤ Open &ldquo;{p.name}&rdquo; <span style={{ color: "var(--gw-t3)", fontSize: 11 }}>· {p.format}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
