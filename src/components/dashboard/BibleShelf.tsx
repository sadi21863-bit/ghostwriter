"use client";
import { useState } from "react";
import { SHELF_PALETTE, hashPaletteIndex } from "./shelfColor";

type Bible = { id: string; name: string; premise: string; projectIds: string[]; updatedAt: string };
type ShelfProject = { id: string; name: string };

function BibleSpine({ bible, projects, active, onSelect, onDelete }: {
  bible: Bible; projects: ShelfProject[]; active: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  const color = SHELF_PALETTE[hashPaletteIndex(bible.name, SHELF_PALETTE.length)];
  const linked = projects.filter(p => bible.projectIds.includes(p.id));
  const gap = linked.length > 1 ? 120 / (linked.length - 1) : 0;
  const lit = hov || active;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onSelect}
      style={{
        position: "relative", flexShrink: 0, width: 168, height: 228, borderRadius: "7px 11px 11px 7px",
        cursor: "pointer", overflow: "hidden",
        background: `linear-gradient(160deg, ${color}22 0%, var(--gw-card) 58%)`,
        border: "1px solid " + (lit ? color + "80" : "var(--gw-border)"),
        boxShadow: lit ? `0 22px 44px rgba(0,0,0,.4), 0 0 0 1px ${color}40, 0 0 26px ${color}33` : "0 4px 14px rgba(0,0,0,.22)",
        transform: lit ? "translateY(-9px) rotate(-1.4deg)" : "none",
        transition: "all .32s cubic-bezier(.16,1,.3,1)", display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ height: 6, background: color, boxShadow: lit ? "0 0 16px " + color : "none", transition: "box-shadow .3s" }} />
      <div style={{
        position: "absolute", top: 6, right: 0, bottom: 0, width: 7,
        background: `repeating-linear-gradient(180deg, var(--gw-border) 0px, var(--gw-border) 1px, transparent 1px, transparent 5px)`,
        opacity: 0.55,
      }} />
      <div style={{ flex: 1, padding: "18px 16px 14px", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "22", border: "1px solid " + color + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginBottom: 12 }}>📖</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 16.5, color: "var(--gw-t1)", lineHeight: 1.24, marginBottom: 8 }}>{bible.name}</div>
        <div style={{ width: 24, height: 1, background: color, opacity: 0.55, marginBottom: 8 }} />
        <div style={{
          fontSize: 11, color: "var(--gw-t3)", lineHeight: 1.55, flex: 1, overflow: "hidden",
          display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const,
          fontStyle: "italic", fontFamily: "'Cormorant Garamond',serif",
        }}>{bible.premise}</div>
        <div style={{ marginTop: 10 }}>
          <svg width="100%" height={18} style={{ display: "block", overflow: "visible" }}>
            {linked.map((p, i) => {
              const x = 8 + i * gap;
              const px = 8 + (i - 1) * gap;
              return (
                <g key={p.id}>
                  {i > 0 && <line x1={px} y1={9} x2={x} y2={9} stroke={color} strokeOpacity={0.45} strokeWidth={1} />}
                  <circle cx={x} cy={9} r={3.5} fill={color} />
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 10, color: "var(--gw-t4)", marginTop: 3 }}>{linked.length} linked {linked.length === 1 ? "project" : "projects"}</div>
        </div>
      </div>
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

function NewBibleSpine({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0, width: 168, height: 228, borderRadius: "7px 11px 11px 7px",
        border: "1.5px dashed " + (hov ? "var(--gw-accent)" : "var(--gw-border)"),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
        cursor: "pointer", color: hov ? "var(--gw-accent)" : "var(--gw-t3)", transition: "all .25s",
        background: hov ? "var(--gw-accent-bg)" : "transparent",
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, padding: "0 20px", textAlign: "center" }}>New Series Bible</span>
    </div>
  );
}

export function BibleShelf({ bibles, projects, onDelete, onNewClick, activeId, onSelect }: {
  bibles: Bible[]; projects: ShelfProject[]; onDelete: (id: string) => void;
  onNewClick: () => void; activeId: string | null; onSelect: (bible: Bible | null) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "4px 4px 20px", alignItems: "flex-end" }}>
        {bibles.map(b => (
          <BibleSpine
            key={b.id}
            bible={b}
            projects={projects}
            active={activeId === b.id}
            onSelect={() => onSelect(activeId === b.id ? null : b)}
            onDelete={() => onDelete(b.id)}
          />
        ))}
        <NewBibleSpine onClick={onNewClick} />
      </div>
      <div style={{ height: 4, background: "linear-gradient(90deg, transparent, var(--gw-border) 12%, var(--gw-border) 88%, transparent)", marginTop: -16, borderRadius: 2 }} />
      <div style={{ height: 16, background: "linear-gradient(180deg, rgba(0,0,0,.16), transparent)", opacity: 0.5 }} />
    </div>
  );
}
