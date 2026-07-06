"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";
import { rankEventCounts, formatUsd, formatCompact } from "@/lib/admin/ops-dashboard";

interface CostReport {
  period: string;
  totalEstimatedCostUSD: number;
  costByModel: Record<string, { tokens: number; costUSD: number }>;
  topUsers: { userId: string; costUSD: number }[];
  topModes: { mode: string; tokens: number }[];
  note: string;
}
interface Analytics {
  counts: Record<string, number>;
  total: number;
}
interface CacheStats {
  totalHits: number;
  byType: Record<string, number>;
  topEntries: { cacheType: string; inputKey: string; hitCount: number; lastHitAt: string | null }[];
}
interface FlaggedShowcase {
  slug: string;
  title: string;
  flagReason: string;
  visibility: string;
}

const card: React.CSSProperties = {
  background: co.surface, border: `1px solid ${co.border}`, borderRadius: 10,
  padding: 16, marginBottom: 16,
};
const h2: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: co.text, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: co.text, borderBottom: `1px solid ${co.border}` };

export default function AdminOpsDashboard() {
  const [secret, setSecret] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<CostReport | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [flagged, setFlagged] = useState<FlaggedShowcase[]>([]);
  const [moderating, setModerating] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${secret}` };
      const [costRes, analyticsRes, cacheRes, flaggedRes] = await Promise.all([
        fetch("/api/admin/cost-report", { headers }),
        fetch("/api/admin/analytics", { headers }),
        fetch("/api/admin/cache-stats", { headers }),
        fetch("/api/admin/flagged-showcases", { headers }),
      ]);
      if (!costRes.ok || !analyticsRes.ok || !cacheRes.ok || !flaggedRes.ok) {
        throw new Error("Unauthorized or server error — check the admin secret.");
      }
      setCost(await costRes.json());
      setAnalytics(await analyticsRes.json());
      setCache(await cacheRes.json());
      setFlagged((await flaggedRes.json()).showcases ?? []);
      setConnected(true);
    } catch (e: any) {
      setError(e.message || "Failed to load.");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function moderate(slug: string, action: "unpublish" | "dismiss") {
    setModerating(prev => ({ ...prev, [slug]: true }));
    try {
      await fetch("/api/admin/flagged-showcases", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action }),
      });
      setFlagged(prev => prev.filter(f => f.slug !== slug));
    } finally {
      setModerating(prev => ({ ...prev, [slug]: false }));
    }
  }

  if (!connected) {
    return (
      <div style={{ minHeight: "100vh", background: co.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...card, width: 360 }}>
          <div style={h2}>Ops Dashboard</div>
          <p style={{ fontSize: 12, color: co.muted, marginBottom: 12 }}>
            Enter the admin secret to view cost, analytics, and cache stats. The secret is only held in this page's memory — it is never persisted.
          </p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            style={{ ...sInput, marginBottom: 10 }}
            onKeyDown={(e) => e.key === "Enter" && secret && load()}
          />
          {error && <p style={{ fontSize: 12, color: co.danger, marginBottom: 10 }}>{error}</p>}
          <button style={sBtn} onClick={load} disabled={!secret || loading}>
            {loading ? "Connecting…" : "Connect"}
          </button>
        </div>
      </div>
    );
  }

  const eventRanks = analytics ? rankEventCounts(analytics.counts) : [];

  return (
    <div style={{ minHeight: "100vh", background: co.bg, padding: "32px 24px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: co.text }}>Ops Dashboard</div>
          <button style={sBtnSm} onClick={load} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh"}</button>
        </div>

        {cost && (
          <div style={card}>
            <div style={h2}>Cost — last {cost.period}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: co.accent, marginBottom: 8 }}>{formatUsd(cost.totalEstimatedCostUSD)}</div>
            <p style={{ fontSize: 11, color: co.muted, marginBottom: 12 }}>{cost.note}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, marginBottom: 6 }}>BY MODEL</div>
                {Object.entries(cost.costByModel).map(([model, v]) => (
                  <div key={model} style={row}>
                    <span>{model}</span>
                    <span>{formatUsd(v.costUSD)} · {formatCompact(v.tokens)} tok</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, marginBottom: 6 }}>TOP MODES</div>
                {cost.topModes.slice(0, 8).map((m) => (
                  <div key={m.mode} style={row}>
                    <span>{m.mode}</span>
                    <span>{formatCompact(m.tokens)} tok</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, marginBottom: 6 }}>TOP USERS BY SPEND</div>
              {cost.topUsers.slice(0, 10).map((u) => (
                <div key={u.userId} style={row}>
                  <span style={{ fontFamily: "monospace", fontSize: 11 }}>{u.userId}</span>
                  <span>{formatUsd(u.costUSD)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {analytics && (
          <div style={card}>
            <div style={h2}>Platform events — last 30d ({formatCompact(analytics.total)} total)</div>
            {eventRanks.map((e) => (
              <div key={e.event} style={row}>
                <span>{e.event}</span>
                <span>{formatCompact(e.count)}</span>
              </div>
            ))}
            {eventRanks.length === 0 && <p style={{ fontSize: 12, color: co.muted }}>No events recorded.</p>}
          </div>
        )}

        <div style={card}>
          <div style={h2}>Flagged Showcases ({flagged.length})</div>
          {flagged.length === 0 && <p style={{ fontSize: 12, color: co.muted }}>No flagged showcases.</p>}
          {flagged.map(f => (
            <div key={f.slug} style={{ ...row, alignItems: "center" }}>
              <span>
                <strong>{f.title}</strong> <span style={{ color: co.muted }}>({f.visibility})</span>
                <div style={{ fontSize: 11, color: co.muted }}>{f.flagReason}</div>
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                <button style={sBtnSm} disabled={moderating[f.slug]} onClick={() => moderate(f.slug, "unpublish")}>Unpublish</button>
                <button style={sBtnSm} disabled={moderating[f.slug]} onClick={() => moderate(f.slug, "dismiss")}>Dismiss</button>
              </span>
            </div>
          ))}
        </div>

        {cache && (
          <div style={card}>
            <div style={h2}>Semantic cache — top 50 entries by hit count</div>
            <div style={{ fontSize: 13, color: co.text, marginBottom: 8 }}>{formatCompact(cache.totalHits)} total hits</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {Object.entries(cache.byType).map(([type, hits]) => (
                <span key={type} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: co.accentBg, color: co.accent }}>
                  {type}: {formatCompact(hits)}
                </span>
              ))}
            </div>
            {cache.topEntries.map((e, i) => (
              <div key={i} style={row}>
                <span style={{ fontFamily: "monospace", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>
                  [{e.cacheType}] {e.inputKey}
                </span>
                <span>{e.hitCount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
