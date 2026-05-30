"use client";
import { Command } from "cmdk";
import { useEffect, useState } from "react";

type CommandPaletteProps = {
  chapters: { id: string; title: string }[];
  characters: { id: string; name: string }[];
  modes: string[];
  onNavigate: (target: string, id?: string) => void;
  onSwitchMode: (mode: string) => void;
  onRunCheck: (check: string) => void;
};

export function CommandPalette({
  chapters, characters, modes, onNavigate, onSwitchMode, onRunCheck
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  const itemStyle: React.CSSProperties = {
    padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 14,
    color: "var(--color-text-primary)", outline: "none",
  };

  const groupHeadingStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)",
    textTransform: "uppercase", letterSpacing: 1, padding: "8px 12px 4px",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 120, zIndex: 9999,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, background: "var(--color-bg-elevated)",
          borderRadius: 12, border: "1px solid var(--color-border-default)",
          overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <Command>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            style={{
              width: "100%", padding: "16px 20px", fontSize: 16,
              background: "transparent", border: "none",
              borderBottom: "1px solid var(--color-border-subtle)",
              color: "var(--color-text-primary)", outline: "none",
              boxSizing: "border-box",
            }}
          />
          <Command.List style={{ padding: "8px 0", maxHeight: 360, overflowY: "auto" }}>
            <Command.Empty style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
              No results.
            </Command.Empty>

            <Command.Group heading="Modes" style={{ padding: "0 8px" }}>
              <div style={groupHeadingStyle}>Modes</div>
              {modes.map(mode => (
                <Command.Item key={mode} onSelect={() => { onSwitchMode(mode); setOpen(false); setSearch(""); }}
                  style={itemStyle}>
                  Switch to {mode} mode
                </Command.Item>
              ))}
            </Command.Group>

            {chapters.length > 0 && (
              <Command.Group heading="Chapters" style={{ padding: "0 8px" }}>
                <div style={groupHeadingStyle}>Chapters</div>
                {chapters.map(ch => (
                  <Command.Item key={ch.id} onSelect={() => { onNavigate("chapter", ch.id); setOpen(false); setSearch(""); }}
                    style={itemStyle}>
                    Go to: {ch.title}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {characters.length > 0 && (
              <Command.Group heading="Characters" style={{ padding: "0 8px" }}>
                <div style={groupHeadingStyle}>Characters</div>
                {characters.map(c => (
                  <Command.Item key={c.id} onSelect={() => { onNavigate("character", c.id); setOpen(false); setSearch(""); }}
                    style={itemStyle}>
                    Character: {c.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Story Health" style={{ padding: "0 8px" }}>
              <div style={groupHeadingStyle}>Story Health</div>
              {["tension-curve", "dead-scenes", "scene-validator", "theme-tracker", "transportation-check"].map(check => (
                <Command.Item key={check} onSelect={() => { onRunCheck(check); setOpen(false); setSearch(""); }}
                  style={itemStyle}>
                  Run: {check.replace(/-/g, " ")}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Navigation" style={{ padding: "0 8px" }}>
              <div style={groupHeadingStyle}>Navigation</div>
              {[
                ["Go to Dashboard", "dashboard"],
                ["Open World Bible", "world-bible"],
                ["Open Production Studio", "production"],
                ["Settings", "settings"],
              ].map(([label, target]) => (
                <Command.Item key={target} onSelect={() => { onNavigate(target); setOpen(false); setSearch(""); }}
                  style={itemStyle}>
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
