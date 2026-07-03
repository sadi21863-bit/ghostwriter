// No "use client" directive here on purpose — this constant needs to be
// importable from server components (layout.tsx's bootstrap script) as well
// as client components. Every export from a "use client" module becomes an
// opaque client-reference proxy when imported server-side, which breaks even
// plain string constants, so it can't live in theme.ts.
export const GW_THEME_STORAGE_KEY = "gw-theme";
