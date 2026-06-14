"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import type { EntitySuggestion } from "@/lib/ai/entity-extraction";

interface EntitySuggestionsChipProps {
  suggestions: EntitySuggestion[];
  onAccept: (s: EntitySuggestion) => void;
  onReject: (s: EntitySuggestion) => void;
}

export default function EntitySuggestionsChip({ suggestions, onAccept, onReject }: EntitySuggestionsChipProps) {
  const [open, setOpen] = useState(false);

  if (!suggestions.length) return null;

  const typeLabel = (type: EntitySuggestion["type"]) => type === "characters" ? "Character" : type === "locations" ? "Location" : "Plot thread";

  return (
    <div style={{ position: "fixed", bottom: 90, right: 24, zIndex: 1250, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      {open && (
        <div style={{ width: 340, maxHeight: 420, overflow: "auto", background: co.surface, border: `1px solid ${co.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ border: `1px solid ${co.border}`, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {typeLabel(s.type)} · {s.entity.name}
              </div>
              {s.changes.map(c => (
                <div key={c.field} style={{ fontSize: 12, color: co.text }}>
                  <span style={{ fontWeight: 700 }}>{c.label}: </span>
                  {c.oldValue && <span style={{ color: co.muted, textDecoration: "line-through" }}>{c.oldValue} </span>}
                  <span>{c.newValue}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                <button style={sBtn} onClick={() => onAccept(s)}>Accept</button>
                <button style={sBtnSm} onClick={() => onReject(s)}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        style={{ ...sBtn, borderRadius: 20, padding: "8px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        onClick={() => setOpen(o => !o)}
      >
        {suggestions.length} update{suggestions.length === 1 ? "" : "s"} suggested
      </button>
    </div>
  );
}
