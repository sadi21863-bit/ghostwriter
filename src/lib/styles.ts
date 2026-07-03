// Both token sets resolve to the same theme-aware CSS custom properties
// (defined in globals.css, toggled via `data-theme` on <html>) so the main
// editor shell (`co`) and floating overlays (`panel`) flip together instead
// of drifting out of sync. Status colors (danger/green/orange/success) stay
// literal — they're semantic, not theme, colors.
export const co = {
  bg: "var(--color-bg-base)", surface: "var(--color-bg-surface)", surfaceAlt: "var(--color-bg-elevated)",
  border: "var(--color-border-default)",
  text: "var(--color-text-primary)", muted: "var(--color-text-secondary)",
  accent: "var(--color-accent)", accentBg: "var(--color-accent-dim)",
  danger: "#d94545", green: "#2d9e5e", orange: "#c9860a",
};

/** Dark overlay panel tokens — used by floating panels rendered on a dark background (StoryHealthPanel, SprintMode, etc.) */
export const panel = {
  bg:      "var(--color-bg-surface)",
  surface: "var(--color-bg-elevated)",
  deeper:  "var(--color-bg-base)",
  border:  "var(--color-border-default)",
  text:    "var(--color-text-primary)",
  muted:   "var(--color-text-secondary)",
  accent:  "var(--color-accent)",
  warn:    "var(--color-accent)",
  danger:  "#f87171",
  success: "#22c55e",
  orange:  "#f59e0b",
};

export const sInput: any = {
  background: co.surfaceAlt, border: "1px solid " + co.border, borderRadius: 8,
  color: co.text, padding: "8px 10px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box",
};
export const sTextarea: any = { ...sInput, resize: "vertical", fontFamily: "inherit" };
export const sBtn: any = {
  padding: "7px 16px", border: "none", borderRadius: 8, cursor: "pointer",
  fontWeight: 600, fontSize: 12, background: co.accent, color: "var(--color-accent-fg)", whiteSpace: "nowrap",
};
export const sBtnSm: any = {
  padding: "4px 10px", border: "1px solid " + co.border, borderRadius: 6,
  cursor: "pointer", fontSize: 11, background: co.surfaceAlt, color: co.muted,
};
