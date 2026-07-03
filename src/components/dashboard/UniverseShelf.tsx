"use client";
import { useMemo, useState } from "react";
import { SHELF_PALETTE, hashPaletteIndex } from "./shelfColor";

type Universe = { id: string; name: string; premise: string; updatedAt: string };
type ShelfProject = { id: string; name: string; universeId?: string | null };

export function UniverseConstellation({ onCreate }: { onCreate: () => void }) {
  const [hov, setHov] = useState(false);
  const stars = useMemo(
    () => Array.from({ length: 34 }, (_, i) => ({ x: (i * 53 + 7) % 100, y: (i * 89 + 11) % 100, s: 1 + (i * 13) % 3, d: (i % 6) * 0.5 })),
    []
  );
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid var(--gw-border)",
        background: "radial-gradient(120% 100% at 50% 42%, var(--gw-sunk), var(--gw-page) 130%)",
        height: 238, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {stars.map((s, i) => (
        <span
          key={i}
          style={{
            position: "absolute", left: s.x + "%", top: s.y + "%", width: s.s, height: s.s, borderRadius: "50%",
            background: "var(--gw-t2)", animation: `star-twinkle ${2.6 + s.d}s ${s.d}s ease-in-out infinite`,
          }}
        />
      ))}
      {[74, 116, 158].map((r, i) => (
        <div
          key={r}
          style={{
            position: "absolute", left: "50%", top: "50%", width: r, height: r, marginLeft: -r / 2, marginTop: -r / 2,
            borderRadius: "50%", border: "1px dashed var(--gw-border)", opacity: hov ? 0.65 : 0.35,
            animation: `${i % 2 ? "orbit-spin-rev" : "orbit-spin"} ${16 + i * 7}s linear infinite`, transition: "opacity .4s",
          }}
        />
      ))}
      <button
        onClick={onCreate}
        style={{
          position: "relative", zIndex: 2, width: 58, height: 58, borderRadius: "50%",
          background: "radial-gradient(circle, var(--gw-accent), var(--gw-accent-l) 60%, transparent 100%)",
          border: "none", cursor: "pointer", animation: "core-pulse 3.4s ease-in-out infinite",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--gw-accent-ink)",
          fontWeight: 700, transition: "transform .25s", transform: hov ? "scale(1.08)" : "none",
        }}
      >+</button>
      <div style={{ position: "absolute", bottom: 20, textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--gw-t1)" }}>Ignite your first universe</div>
        <div style={{ fontSize: 11.5, color: "var(--gw-t3)", marginTop: 4, maxWidth: 340, lineHeight: 1.5 }}>
          Build your own Cosmere or MCU — standalone stories orbiting one shared world.
        </div>
      </div>
    </div>
  );
}

function UniverseOrbCard({ universe, projects, onDelete }: {
  universe: Universe; projects: ShelfProject[]; onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  const linked = projects.filter(p => p.universeId === universe.id);
  const color = SHELF_PALETTE[hashPaletteIndex(universe.name, SHELF_PALETTE.length)];
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", flexShrink: 0, width: 200, height: 228, borderRadius: 16, cursor: "pointer", overflow: "hidden",
        background: `radial-gradient(120% 100% at 50% 30%, ${color}18, var(--gw-card) 75%)`,
        border: "1px solid " + (hov ? color + "70" : "var(--gw-border)"),
        boxShadow: hov ? `0 20px 44px rgba(0,0,0,.4), 0 0 22px ${color}30` : "0 4px 14px rgba(0,0,0,.22)",
        transform: hov ? "translateY(-6px)" : "none", transition: "all .3s cubic-bezier(.16,1,.3,1)",
        display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 14px 14px",
      }}
    >
      <div style={{ position: "relative", width: 84, height: 84, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px dashed " + color + "55", animation: "orbit-spin 14s linear infinite" }} />
        <div style={{
          position: "absolute", left: "50%", top: "50%", width: 22, height: 22, marginLeft: -11, marginTop: -11,
          borderRadius: "50%", background: color + "2a", border: "1px solid " + color + "66",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
        }}>🌌</div>
        {linked.slice(0, 6).map((p, i) => {
          const angle = (i / Math.max(linked.length, 1)) * 2 * Math.PI;
          const r = 38, cx = 42, cy = 42;
          const x = cx + Math.cos(angle) * r - 4, y = cy + Math.sin(angle) * r - 4;
          return (
            <div
              key={p.id}
              title={p.name}
              style={{ position: "absolute", left: x, top: y, width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: "0 0 6px " + color }}
            />
          );
        })}
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 15.5, color: "var(--gw-t1)", textAlign: "center", marginBottom: 6 }}>{universe.name}</div>
      <div style={{
        fontSize: 11, color: "var(--gw-t3)", textAlign: "center", lineHeight: 1.5, overflow: "hidden",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, flex: 1,
      }}>{universe.premise}</div>
      <div style={{ fontSize: 10, color: "var(--gw-t4)", marginTop: 8 }}>{linked.length} {linked.length === 1 ? "story" : "stories"}</div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{
          position: "absolute", top: 10, right: 11, background: "rgba(0,0,0,.35)", border: "none", borderRadius: "50%",
          width: 20, height: 20, cursor: "pointer", color: "#fff", fontSize: 10, opacity: hov ? 1 : 0,
          transition: "opacity .15s", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >✕</button>
    </div>
  );
}

export function UniverseShelf({ universes, projects, onDelete, onNew }: {
  universes: Universe[]; projects: ShelfProject[]; onDelete: (id: string) => void; onNew: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "4px 4px 10px" }}>
      {universes.map(u => (
        <UniverseOrbCard key={u.id} universe={u} projects={projects} onDelete={() => onDelete(u.id)} />
      ))}
      <div
        onClick={onNew}
        style={{
          flexShrink: 0, width: 200, height: 228, borderRadius: 16, border: "1.5px dashed var(--gw-border)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: "pointer", color: "var(--gw-t3)", transition: "all .25s", background: "transparent",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gw-accent)"; e.currentTarget.style.color = "var(--gw-accent)"; e.currentTarget.style.background = "var(--gw-accent-bg)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--gw-border)"; e.currentTarget.style.color = "var(--gw-t3)"; e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>New Universe</span>
      </div>
    </div>
  );
}
