"use client";
import { useEffect, useState } from "react";

type Settings = {
  higgsfieldKeySet: boolean; higgsfieldKeyLast4: string;
  higgsfieldSecretSet: boolean; higgsfieldSecretLast4: string;
  openaiKeySet: boolean; openaiKeyLast4: string;
  imageProviderId: string;
  trendIntelligenceKeySet: boolean; trendIntelligenceKeyLast4: string;
};

type Subscription = {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [higgsfieldApiKey, setHiggsfieldApiKey] = useState("");
  const [higgsfieldApiSecret, setHiggsfieldApiSecret] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [trendKey, setTrendKey] = useState("");

  useEffect(() => {
    fetch("/api/user/settings").then(r => r.json()).then(setSettings);
    fetch("/api/subscription").then(r => r.json()).then(setSubscription);
    fetch("/api/user/referrals").then(r => r.ok ? r.json() : { referrals: [], user: null }).then(data => {
      if (data.referrals) setReferrals(data.referrals);
      if (data.user) setUser(data.user);
    }).catch(() => {});
  }, []);

  // Handle ?upgraded=1 query param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("upgraded") === "1") {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
        window.history.replaceState({}, "", "/settings");
        // Refresh subscription info
        fetch("/api/subscription").then(r => r.json()).then(setSubscription);
      }
    }
  }, []);

  const save = async () => {
    setSaving(true);
    const body: Record<string, string> = {};
    if (higgsfieldApiKey)    body.higgsfieldApiKey    = higgsfieldApiKey;
    if (higgsfieldApiSecret) body.higgsfieldApiSecret = higgsfieldApiSecret;
    if (openaiApiKey)        body.openaiApiKey        = openaiApiKey;
    if (trendKey)            body.trendIntelligenceKey = trendKey;
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const updated = await fetch("/api/user/settings").then(r => r.json());
    setSettings(updated);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setHiggsfieldApiKey(""); setHiggsfieldApiSecret(""); setOpenaiApiKey(""); setTrendKey("");
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    const res = await fetch("/api/subscription/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: window.location.href }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setPortalLoading(false);
  };

  const openUpgradeCheckout = async (tier: string) => {
    setUpgradeLoading(true);
    const res = await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier,
        billingPeriod,
        successUrl: `${window.location.origin}/settings?upgraded=1`,
        cancelUrl: window.location.href,
      }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setUpgradeLoading(false);
  };

  const Field = ({ label, isSet, last4, value, onChange, placeholder }: {
    label: string; isSet: boolean; last4: string;
    value: string; onChange: (v: string) => void; placeholder: string;
  }) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", color: "var(--color-text-secondary)", marginBottom: 6, fontSize: 13 }}>
        {label}
        {isSet && <span style={{ marginLeft: 8, color: "#22c55e", fontSize: 12 }}>✓ Set (···{last4})</span>}
      </label>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={isSet ? "Enter new value to replace" : placeholder}
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 8,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-default)",
          color: "var(--color-text-primary)", fontSize: 14,
          boxSizing: "border-box",
        }}
      />
    </div>
  );

  const hasChanges = !!(higgsfieldApiKey || higgsfieldApiSecret || openaiApiKey || trendKey);

  return (
    <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px" }}>
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/dashboard" style={{ color: "var(--color-text-muted)", fontSize: 13, textDecoration: "none" }}>
          ← Dashboard
        </a>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "var(--color-text-primary)" }}>Settings</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 32, fontSize: 14 }}>
        API keys are encrypted at rest. Only the last 4 characters are shown after saving.
      </p>

      {/* ── Subscription ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 40, paddingBottom: 40, borderBottom: "1px solid var(--color-border-default)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--color-text-primary)" }}>Plan</h2>

        {saved && subscription?.tier !== "free" && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#16a34a22", border: "1px solid #22c55e44", color: "#22c55e", fontSize: 13, marginBottom: 16 }}>
            ✓ Plan upgraded successfully
          </div>
        )}

        {subscription ? (
          <>
            {subscription.status === 'past_due' && (
              <div style={{ padding: '12px 16px', marginBottom: 16, background: '#451a1a', border: '1px solid #f87171', borderRadius: 8 }}>
                <strong style={{ color: '#f87171' }}>Payment failed.</strong>
                <span style={{ color: '#fca5a5', marginLeft: 8 }}>
                  Update your payment method to keep your subscription active.
                </span>
                <button onClick={openBillingPortal} style={{ marginLeft: 12, fontSize: 12, padding: '4px 10px', background: 'transparent', border: '1px solid #f87171', color: '#f87171', borderRadius: 6, cursor: 'pointer' }}>
                  Update payment →
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: subscription.tier === "free" ? "var(--color-bg-elevated)" : "var(--color-accent)",
                color: subscription.tier === "free" ? "var(--color-text-muted)" : "#fff",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                {subscription.tier.replace("_", " ")}
              </span>
              {subscription.status === "trialing" && (
                <span style={{ fontSize: 12, color: "#facc15" }}>Trial active</span>
              )}
              {subscription.status === "cancelled" && (
                <span style={{ fontSize: 12, color: "#f87171" }}>Cancels at period end</span>
              )}
              {subscription.currentPeriodEnd && subscription.tier !== "free" && (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {subscription.status === "cancelled" ? "Access until" : "Renews"}{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              )}
            </div>

            {subscription.tier === "free" ? (
              <>
                {/* Billing period toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {(['monthly', 'annual'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setBillingPeriod(p)}
                      style={{
                        padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                        background: billingPeriod === p ? 'var(--color-accent)' : 'var(--color-bg-elevated)',
                        color: billingPeriod === p ? '#fff' : 'var(--color-text-secondary)',
                      }}
                    >
                      {p === 'monthly' ? 'Monthly' : 'Annual'}{p === 'annual' && <span style={{ color: '#4ade80', fontSize: 10, marginLeft: 4 }}>save 20%</span>}
                    </button>
                  ))}
                </div>

              <div className="subscription-plans" style={{ display: "flex", gap: 10 }}>
                {[
                  { tier: "story_pro",    label: "Story Pro",    price: billingPeriod === 'annual' ? "$10/mo" : "$12/mo", desc: "Advanced story modes, Style DNA, exports, unlimited AI" },
                  { tier: "creator_pro",  label: "Creator Pro",  price: billingPeriod === 'annual' ? "$10/mo" : "$12/mo", desc: "Trend intelligence, video tools, Creator series pipeline" },
                  { tier: "all_access",   label: "All Access",   price: billingPeriod === 'annual' ? "$15/mo" : "$19/mo", desc: "Everything in both plans + priority generation" },
                ].map(plan => (
                  <div key={plan.tier} style={{
                    flex: 1, padding: "16px", borderRadius: 10,
                    border: "1px solid var(--color-border-default)",
                    background: "var(--color-bg-elevated)",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--color-text-primary)" }}>{plan.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: "var(--color-text-primary)" }}>{plan.price}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 12 }}>{plan.desc}</div>
                    <button
                      onClick={() => openUpgradeCheckout(plan.tier)}
                      disabled={upgradeLoading}
                      style={{
                        width: "100%", padding: "8px", borderRadius: 8,
                        background: "var(--color-accent)", color: "#fff",
                        border: "none", cursor: upgradeLoading ? "not-allowed" : "pointer",
                        fontSize: 13, fontWeight: 600, opacity: upgradeLoading ? 0.7 : 1,
                      }}
                    >
                      {upgradeLoading ? "Redirecting..." : "Upgrade"}
                    </button>
                  </div>
                ))}
              </div>
              </>
            ) : (
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                style={{
                  padding: "10px 20px", borderRadius: 8, fontSize: 13,
                  border: "1px solid var(--color-border-default)",
                  background: "transparent", color: "var(--color-text-primary)",
                  cursor: portalLoading ? "not-allowed" : "pointer",
                  opacity: portalLoading ? 0.7 : 1,
                }}
              >
                {portalLoading ? "Opening..." : "Manage billing →"}
              </button>
            )}
          </>
        ) : (
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Loading...</div>
        )}
      </div>

      {/* ── API Keys ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 20, color: "var(--color-text-secondary)" }}>
          Higgsfield AI
        </h2>
        <Field label="API Key" isSet={settings?.higgsfieldKeySet ?? false} last4={settings?.higgsfieldKeyLast4 ?? ""}
          value={higgsfieldApiKey} onChange={setHiggsfieldApiKey} placeholder="hf_..." />
        <Field label="API Secret" isSet={settings?.higgsfieldSecretSet ?? false} last4={settings?.higgsfieldSecretLast4 ?? ""}
          value={higgsfieldApiSecret} onChange={setHiggsfieldApiSecret} placeholder="hfs_..." />
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 20, color: "var(--color-text-secondary)" }}>
          OpenAI (Audio Novel)
        </h2>
        <Field label="OpenAI API Key" isSet={settings?.openaiKeySet ?? false} last4={settings?.openaiKeyLast4 ?? ""}
          value={openaiApiKey} onChange={setOpenaiApiKey} placeholder="sk-..." />
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 20, color: "var(--color-text-secondary)" }}>
          Trend Intelligence
        </h2>
        <Field label="Trend API Key" isSet={settings?.trendIntelligenceKeySet ?? false} last4={settings?.trendIntelligenceKeyLast4 ?? ""}
          value={trendKey} onChange={setTrendKey} placeholder="Enter API key" />
      </section>

      {/* ── Referrals ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 40, paddingBottom: 40, borderBottom: "1px solid var(--color-border-default)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--color-text-primary)" }}>Refer a writer</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
          Share your link. When someone subscribes using it, you get 1 month free.
        </p>

        {user?.referralCode && typeof window !== "undefined" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              readOnly
              value={`${window.location.origin}/login?ref=${user.referralCode}`}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)", fontSize: 13, boxSizing: "border-box" }}
            />
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/login?ref=${user.referralCode}`)}
              style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--color-accent)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Copy
            </button>
          </div>
        )}

        {referrals.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {referrals.filter((r: any) => r.status === 'rewarded').length} rewards earned ·{' '}
            {referrals.filter((r: any) => r.status === 'subscribed').length} pending
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving || !hasChanges}
        style={{
          padding: "12px 32px", borderRadius: 8, fontWeight: 600, fontSize: 15,
          background: saved ? "#22c55e" : "var(--color-accent)",
          color: "white", cursor: (saving || !hasChanges) ? "not-allowed" : "pointer", border: "none",
          opacity: saving || !hasChanges ? 0.6 : 1,
        }}
      >
        {saved ? "Saved ✓" : saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
