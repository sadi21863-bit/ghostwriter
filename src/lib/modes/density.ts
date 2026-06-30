// Density — how many modes the toolbar surfaces. Simple (core only) → Standard
// (core + specialised) → Full (everything incl. advanced). The level + the
// "is this mode visible at this density" rule were inline magic in ToolbarPanel;
// this is the single source so the picker, the hook, and the filter agree.

export type Density = "simple" | "standard" | "full";
export const DENSITY_LEVELS: Density[] = ["simple", "standard", "full"];

const RANK: Record<Density, number> = { simple: 0, standard: 1, full: 2 };

export interface DensityMeta {
  level: Density;
  label: string;
  description: string;
}

export const DENSITY_META: Record<Density, DensityMeta> = {
  simple:   { level: "simple",   label: "Simple",   description: "Core modes only — just the essentials." },
  standard: { level: "standard", label: "Standard", description: "Core plus specialised modes." },
  full:     { level: "full",     label: "Full",     description: "Every mode, including advanced tools." },
};

export function densityRank(d: Density): number {
  return RANK[d] ?? RANK.standard;
}

/** Coerce any stored/garbage value to a valid density. Default: standard. */
export function normalizeDensity(v: string | null | undefined): Density {
  return v === "simple" || v === "full" ? v : "standard";
}

/** A mode shows at the current density when the density meets the mode's floor. */
export function isModeVisibleAtDensity(minDensity: Density | undefined | null, density: Density): boolean {
  if (!minDensity) return true; // no floor → always shown
  return densityRank(density) >= densityRank(minDensity);
}
