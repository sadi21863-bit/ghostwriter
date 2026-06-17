import { useState, useEffect } from "react";

export type Density = "simple" | "standard" | "full";

const KEY = "gw:density";

export function useDensity() {
  const [density, setDensity] = useState<Density>("standard");

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as Density | null;
    if (stored === "simple" || stored === "standard" || stored === "full") {
      setDensity(stored);
    }
  }, []);

  function changeDensity(d: Density) {
    setDensity(d);
    localStorage.setItem(KEY, d);
  }

  return { density, changeDensity };
}
