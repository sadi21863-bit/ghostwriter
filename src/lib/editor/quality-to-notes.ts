// Editor #4 follow-up — AI auto-scan: turn a quality-check result into persisted
// editor_notes. Pure mapper so the conversion is unit-testable; the panel runs the
// quality-check, maps here, and POSTs the rows to /editor-notes (source: quality_check).

export interface QualityCheckResult {
  ruleViolations?: { rule?: string; violation?: string; severity?: string }[];
  knowledgeViolations?: { character?: string; state?: string; entity?: string; violation?: string }[];
  povBreaks?: { text?: string; issue?: string }[];
  slopMarkers?: { type?: string; text?: string; suggestion?: string }[];
}

export interface EditorNoteInput {
  type: "issue" | "suggestion";
  severity: "high" | "medium" | "low";
  category: string;
  message: string;
  suggestedFix?: string;
  source: "quality_check";
}

const sev = (s: string | undefined): "high" | "medium" | "low" =>
  s === "high" || s === "low" ? s : "medium";

/** Map a quality-check payload to editor-note rows. Drops entries with no message. */
export function qualityCheckToNotes(r: QualityCheckResult): EditorNoteInput[] {
  const notes: EditorNoteInput[] = [];

  for (const v of r.ruleViolations ?? []) {
    if (!v?.violation) continue;
    notes.push({
      type: "issue", severity: sev(v.severity), category: "rule", source: "quality_check",
      message: v.rule ? `Rule "${v.rule}": ${v.violation}` : v.violation,
    });
  }

  for (const k of r.knowledgeViolations ?? []) {
    if (!k?.violation) continue;
    notes.push({
      type: "issue", severity: "high", category: "continuity", source: "quality_check",
      message: `${k.character ?? "A character"} (${k.state ?? "knowledge"}) re: ${k.entity ?? "?"} — ${k.violation}`,
    });
  }

  for (const p of r.povBreaks ?? []) {
    const msg = p?.issue || p?.text;
    if (!msg) continue;
    notes.push({ type: "issue", severity: "medium", category: "pov", source: "quality_check", message: `POV break: ${msg}` });
  }

  for (const m of r.slopMarkers ?? []) {
    if (!m?.text) continue;
    notes.push({
      type: "suggestion", severity: "low", category: "prose", source: "quality_check",
      message: `${m.type ?? "prose"}: "${m.text}"`,
      suggestedFix: m.suggestion,
    });
  }

  return notes;
}
