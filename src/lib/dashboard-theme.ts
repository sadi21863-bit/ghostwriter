// Dashboard ("Studio") brand palette — gold/cream with serif headings,
// intentionally distinct from the in-editor `co`/`panel` tokens in styles.ts
// (which use a purple accent for WritingRoom/the legacy toolbar shell).
// Centralized here so a future palette tweak is one edit instead of a
// find-and-replace across dozens of inline hex literals.
export const GW_GOLD = "#c9a84c";
export const GW_DARK = "#0d0d10";
export const GW_CREAM = "#faf9f5";
export const GW_BORDER = "#ede9df";
export const GW_TEXT = "#1a1a1a";
export const GW_MUTED = "#888";
export const GW_MUTED_LIGHT = "#aaa";
export const GW_SURFACE_ALT = "#f5f4f0";

// CSS custom-property scheme for the dashboard's dark/light toggle, keyed off
// a `data-theme` attribute on <html>. Gold stays the accent in both themes
// (unlike the design mockup this was ported from, which used an olive/lime
// accent) and the header stays fixed-dark in both themes so the navbar keeps
// matching Home.tsx/login, which don't participate in this toggle. Light
// values map 1:1 to the GW_* constants above so toggling to light reproduces
// today's production look exactly.
export const GW_THEME_CSS = `
:root[data-theme="dark"]{
  --gw-page:#0d0d10;--gw-card:#17171c;--gw-sunk:#121216;--gw-border:#232329;
  --gw-header:#0d0d10;--gw-header-bd:#1a1a22;
  --gw-t1:#f2f0e6;--gw-t2:#a3a39a;--gw-t3:#75746a;--gw-t4:#4c4b44;
  --gw-accent:#c9a84c;--gw-accent-l:#e0c068;--gw-accent-ink:#0d0d10;
  --gw-accent-bg:rgba(201,168,76,.12);--gw-accent-bd:rgba(201,168,76,.34);--gw-glow:rgba(201,168,76,.20);
  --gw-sel:#231f0a;--gw-sel-text:#e0c068;
  --gw-shadow:0 16px 44px rgba(0,0,0,.55),0 0 26px rgba(201,168,76,.08);
}
:root[data-theme="light"]{
  --gw-page:#faf9f5;--gw-card:#ffffff;--gw-sunk:#f5f4f0;--gw-border:#ede9df;
  --gw-header:#0d0d10;--gw-header-bd:#1e1e2a;
  --gw-t1:#1a1a1a;--gw-t2:#888;--gw-t3:#aaa;--gw-t4:#ccc;
  --gw-accent:#c9a84c;--gw-accent-l:#b8963e;--gw-accent-ink:#0d0d10;
  --gw-accent-bg:rgba(201,168,76,.12);--gw-accent-bd:rgba(201,168,76,.34);--gw-glow:rgba(201,168,76,.15);
  --gw-sel:#fefce8;--gw-sel-text:#92400e;
  --gw-shadow:0 8px 32px rgba(0,0,0,.10);
}
html.gw-no-transition *{transition:none!important;animation-duration:0s!important}
@keyframes gw-mark-in{from{opacity:0;transform:scale(.5) rotate(-12deg);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes gw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes gw-spring{from{opacity:0;transform:scale(.92) translateY(10px)}to{opacity:1;transform:none}}
@keyframes orbit-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes orbit-spin-rev{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
@keyframes star-twinkle{0%,100%{opacity:.15}50%{opacity:.75}}
@keyframes core-pulse{0%,100%{box-shadow:0 0 22px var(--gw-glow)}50%{box-shadow:0 0 38px var(--gw-glow)}}
.gw-logo{animation:gw-mark-in .8s cubic-bezier(.16,1,.3,1) both,gw-float 5s ease-in-out 1s infinite;transition:transform .35s,box-shadow .35s,filter .35s;will-change:transform}
.gw-logo:hover{transform:scale(1.13) rotate(-5deg);box-shadow:0 0 0 3px rgba(201,168,76,.16),0 8px 22px rgba(201,168,76,.4);filter:saturate(1.25) brightness(1.08)}
.gw-modal{animation:gw-spring .34s cubic-bezier(.34,1.56,.64,1)}
.theme-toggle{position:fixed;bottom:22px;right:22px;z-index:60;width:46px;height:46px;border-radius:50%;border:1px solid var(--gw-border);background:var(--gw-card);color:var(--gw-t1);cursor:pointer;font-size:19px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(0,0,0,.18);transition:transform .2s,background .3s,border-color .3s}
.theme-toggle:hover{transform:scale(1.08) rotate(12deg)}
`;
