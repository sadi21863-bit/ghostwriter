// Centralised design tokens for the light "literary studio" surfaces.
// Enhanced palette: warm paper + bronze-gold ink — cohesive with the dark
// gold landing, and deliberately away from the generic purple-on-white look.
export const co = {
  bg: "#f6f4ef",          // warm paper
  surface: "#fffdf9",     // near-white warm card
  surfaceAlt: "#efeae0",  // subtle inset panel
  border: "#e6e0d4",      // warm hairline border
  text: "#221f1a",        // warm ink
  muted: "#8b8575",       // muted clay
  accent: "#b45309",      // bronze-amber (brand gold, readable on paper)
  accentBg: "rgba(180,83,9,0.08)",
  danger: "#be3a30", green: "#2c8a57", orange: "#c9860a",
};

/** Dark overlay panel tokens — used by floating panels rendered on a dark background (StoryHealthPanel, SprintMode, etc.) */
export const panel = {
  bg:      "#18181B",
  surface: "#2a2a30",
  deeper:  "#111113",
  border:  "#3a3a45",
  text:    "#F2F2F3",
  muted:   "#9898A6",
  accent:  "#f0a83d",
  warn:    "#D97706",
  danger:  "#f87171",
  success: "#22c55e",
  orange:  "#f59e0b",
};

export const sInput: any = {
  background: co.surface, border: "1px solid " + co.border, borderRadius: 8,
  color: co.text, padding: "9px 12px", fontSize: 13, width: "100%", outline: "none",
  boxSizing: "border-box", transition: "border-color .15s ease, box-shadow .15s ease",
};
export const sTextarea: any = { ...sInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 };
export const sBtn: any = {
  padding: "8px 16px", border: "none", borderRadius: 8, cursor: "pointer",
  fontWeight: 600, fontSize: 12, background: co.accent, color: "#fffdf9", whiteSpace: "nowrap",
  letterSpacing: "0.01em", boxShadow: "0 1px 2px rgba(80,45,5,0.14)",
  transition: "filter .15s ease, transform .12s ease, box-shadow .15s ease",
};
export const sBtnSm: any = {
  padding: "5px 11px", border: "1px solid " + co.border, borderRadius: 7,
  cursor: "pointer", fontSize: 11, background: co.surface, color: co.text, fontWeight: 500,
  transition: "background .15s ease, border-color .15s ease, color .15s ease",
};
