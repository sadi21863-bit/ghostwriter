"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useGwTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";

interface FeedItem {
  slug: string;
  title: string;
  blurb: string;
  format: string;
}

export default function ShowcaseDiscoveryPage() {
  useGwTheme();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async (from: number, q?: string) => {
    setLoading(true);
    try {
      const url = q ? `/api/showcase?q=${encodeURIComponent(q)}` : `/api/showcase?cursor=${from}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(prev => (from === 0 || q) ? data.showcases : [...prev, ...data.showcases]);
      setNextCursor(data.nextCursor);
      setCursor(from);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, []);

  // Debounced search — re-queries on pause, falls back to the newest-first
  // feed when the box is cleared.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (query.trim()) load(0, query.trim());
      else load(0);
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--gw-page)", color: "var(--gw-t1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🖼 Showcase</div>
        <ThemeToggle />
      </div>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 60px" }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search showcases…"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--gw-border)", background: "var(--gw-card)", color: "var(--gw-t1)", fontSize: 14, marginBottom: 20, boxSizing: "border-box" }}
        />
        {items.length === 0 && !loading && (
          <p style={{ color: "var(--gw-t3)" }}>{query.trim() ? "No showcases match that search." : "No showcases published yet."}</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {items.map(item => (
            <Link key={item.slug} href={`/showcase/${item.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ border: "1px solid var(--gw-border)", borderRadius: 12, padding: 16, background: "var(--gw-card)", height: "100%" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "var(--gw-t3)", marginBottom: 8 }}>{item.format}</div>
                <div style={{ fontSize: 12, color: "var(--gw-t2)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}>
                  {item.blurb}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {!query.trim() && nextCursor != null && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button
              onClick={() => load(nextCursor)}
              disabled={loading}
              style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid var(--gw-border)", background: "transparent", color: "var(--gw-t1)", cursor: "pointer" }}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
