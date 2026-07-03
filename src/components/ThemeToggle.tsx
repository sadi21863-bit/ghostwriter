"use client";
import { useGwTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, toggleTheme] = useGwTheme();
  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle light / dark">
      {theme === "dark" ? "🕯️" : "🌑"}
    </button>
  );
}
