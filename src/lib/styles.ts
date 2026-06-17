export const co = {
  bg: "#f8f7f4", surface: "#ffffff", surfaceAlt: "#f0efe9", border: "#e2e0d8",
  text: "#1a1a1a", muted: "#777", accent: "#5b4ccc", accentBg: "#5b4ccc12",
  danger: "#d94545", green: "#2d9e5e", orange: "#c9860a",
};

/** Dark overlay panel tokens — used by floating panels rendered on a dark background (StoryHealthPanel, SprintMode, etc.) */
export const panel = {
  bg:      "#18181B",
  surface: "#2a2a30",
  deeper:  "#111113",
  border:  "#3a3a45",
  text:    "#F2F2F3",
  muted:   "#9898A6",
  accent:  "#818cf8",
  warn:    "#D97706",
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
  fontWeight: 600, fontSize: 12, background: co.accent, color: "#fff", whiteSpace: "nowrap",
};
export const sBtnSm: any = {
  padding: "4px 10px", border: "1px solid " + co.border, borderRadius: 6,
  cursor: "pointer", fontSize: 11, background: co.surfaceAlt, color: co.muted,
};
