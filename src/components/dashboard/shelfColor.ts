// Deterministic per-item accent color for the Series Bible and Universe
// shelves, so the same bible/universe always gets the same color across
// re-renders without needing to persist a color field.
export const SHELF_PALETTE = ["#84cc16", "#a78bfa", "#22d3ee", "#fbbf24", "#fb7185", "#f97316"];

export function hashPaletteIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % mod;
}
