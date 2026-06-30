import { useState, useEffect } from "react";
import { normalizeDensity, type Density } from "@/lib/modes/density";

export type { Density };

const KEY = "gw:density";

export function useDensity() {
  const [density, setDensity] = useState<Density>("standard");

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored) setDensity(normalizeDensity(stored));
  }, []);

  function changeDensity(d: Density) {
    setDensity(d);
    localStorage.setItem(KEY, d);
  }

  return { density, changeDensity };
}
