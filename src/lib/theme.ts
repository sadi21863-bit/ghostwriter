"use client";
import { useEffect, useState } from "react";
import { GW_THEME_STORAGE_KEY } from "@/lib/theme-constants";

export type GwTheme = "dark" | "light";
export { GW_THEME_STORAGE_KEY };

/** Shared dark/light theme toggle, backed by `data-theme` on <html> +
 * localStorage. The initial value is bootstrapped pre-paint by an inline
 * script in layout.tsx; this hook just keeps React state in sync with it. */
export function useGwTheme(): [GwTheme, () => void] {
  const [theme, setTheme] = useState<GwTheme>("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GW_THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("gw-no-transition");
    setTheme(next);
    try { localStorage.setItem(GW_THEME_STORAGE_KEY, next); } catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("gw-no-transition")));
  };

  return [theme, toggleTheme];
}
