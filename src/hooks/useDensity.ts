import { useState, useEffect } from "react";
import { normalizeDensity, type Density } from "@/lib/modes/density";

export type { Density };

const KEY = "gw:density";

/**
 * Density preference. Backward compatible: called with no args it uses the
 * per-browser localStorage default. Pass `{ projectDensity, onChange }` to make it
 * a per-project setting (projects.densityLevel) — the picker then persists via
 * onChange instead of localStorage.
 */
export function useDensity(opts?: { projectDensity?: string | null; onChange?: (d: Density) => void }) {
  const projectScoped = opts?.projectDensity != null;
  const [density, setDensity] = useState<Density>(() => projectScoped ? normalizeDensity(opts!.projectDensity) : "standard");

  useEffect(() => {
    if (projectScoped) { setDensity(normalizeDensity(opts!.projectDensity)); return; }
    const stored = localStorage.getItem(KEY);
    if (stored) setDensity(normalizeDensity(stored));
  }, [projectScoped, opts?.projectDensity]);

  function changeDensity(d: Density) {
    setDensity(d);
    if (opts?.onChange) opts.onChange(d);
    else localStorage.setItem(KEY, d);
  }

  return { density, changeDensity };
}
