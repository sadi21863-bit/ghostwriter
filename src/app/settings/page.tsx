"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Script from "next/script";
import { toast } from "@/lib/toast";
import { ToastContainer } from "@/components/ToastContainer";

declare global {
  interface Window { Razorpay: any; }
}

type Settings = {
  higgsfieldKeySet: boolean; higgsfieldKeyLast4: string;
  higgsfieldSecretSet: boolean; higgsfieldSecretLast4: string;
  segmindKeySet: boolean; segmindKeyLast4: string;
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
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [higgsfieldApiKey, setHiggsfieldApiKey] = useState("");
  const [higgsfieldApiSecret, setHiggsfieldApiSecret] = useState("");
  const [segmindApiKey, setSegmindApiKey] = useState("");
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

  const save = async () => {
    setSaving(true);
    const body: Record<string, string> = {};
    if (higgsfieldApiKey)    body.higgsfieldApiKey    = higgsfieldApiKey;
    if (higgsfieldApiSecret) body.higgsfieldApiSecret = higgsfieldApiSecret;
    if (segmindApiKey)       body.segmindApiKey       = segmindApiKey;
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
    setHiggsfieldApiKey(""); setHiggsfieldApiSecret(""); setSegmindApiKey(""); setOpenaiApiKey(""); setTrendKey("");
  };

  const refreshSubscription = () => fetch("/api/subscription").then(r => r.json()).then(setSubscription);

  const openUpgradeCheckout = async (tier: string) => {
    if (typeof window === "undefined" || !window.Razorpay) {
      toast.error("Checkout is still loading — try again in a moment.");
      return;
    }
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, billingPeriod }),
      });
      const data = await res.json();
      if (!res.ok || !data.subscriptionId) {
        toast.error(data.error ?? "Could not start checkout. Please try again.");
        setUpgradeLoading(false);
        return;
      }

      const checkout = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "GhostWriter",
        description: `${tier.replace("_", " ")} subscription`,
        prefill: {
          name: session?.user?.name ?? undefined,
          email: session?.user?.email ?? undefined,
        },
        theme: { color: "#4F46E5" },
        modal: { ondismiss: () => setUpgradeLoading(false) },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch("/api/subscription/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, tier }),
          });
          if (verifyRes.ok) {
            toast.success("Plan upgraded successfully");
            await refreshSubscription();
          } else {
            toast.error("Payment received but verification failed — contact support if your plan doesn't update shortly.");
          }
          setUpgradeLoading(false);
        },
      });
      checkout.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
        setUpgradeLoading(false);
      });
      checkout.open();
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setUpgradeLoading(false);
    }
  };

  const cancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Your plan will end at the close of the current billing period.");
        await refreshSubscription();
      } else {
        toast.error(data.error ?? "Could not cancel subscription. Please try again.");
      }
    } catch {
      toast.error("Could not cancel subscription. Please try again.");
    }
    setCancelLoading(false);
    setShowCancelConfirm(false);
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

  const hasChanges = !!(higgsfieldApiKey || higgsfieldApiSecret || segmindApiKey || openaiApiKey || trendKey);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <ToastContainer />
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

        {subscription ? (
          <>
            {subscription.status === 'past_due' && (
              <div style={{ padding: '12px 16px', marginBottom: 16, background: '#451a1a', border: '1px solid #f87171', borderRadius: 8 }}>
                <strong style={{ color: '#f87171' }}>Payment failed.</strong>
                <span style={{ color: '#fca5a5', marginLeft: 8 }}>
                  Razorpay will automatically retry the charge. If it keeps failing, your plan will move to Free.
                </span>
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
                  { tier: "story_pro",    label: "Story Pro",    price: billingPeriod === 'annual' ? "₹14,400/yr" : "₹1,500/mo", desc: "500 generations/month · All 26 craft modes · Full character intelligence · Export" },
                  { tier: "creator_pro",  label: "Creator Pro",  price: billingPeriod === 'annual' ? "₹9,600/yr" : "₹1,000/mo", desc: "Creator formats · YouTube/TikTok/Podcast · Trend intelligence · Video tools" },
                  { tier: "all_access",   label: "All Access",   price: billingPeriod === 'annual' ? "₹24,000/yr" : "₹2,500/mo", desc: "Unlimited generations · Everything in all plans · Higgsfield pipeline · Priority generation" },
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
            ) : subscription.status === "cancelled" ? (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                Your plan won't renew. You'll keep access until the date above.
              </p>
            ) : showCancelConfirm ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                  Cancel at the end of the current billing period?
                </span>
                <button
                  onClick={cancelSubscription}
                  disabled={cancelLoading}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: "#dc2626", color: "#fff", border: "none",
                    cursor: cancelLoading ? "not-allowed" : "pointer", opacity: cancelLoading ? 0.7 : 1,
                  }}
                >
                  {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelLoading}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13,
                    border: "1px solid var(--color-border-default)",
                    background: "transparent", color: "var(--color-text-primary)", cursor: "pointer",
                  }}
                >
                  Keep plan
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCancelConfirm(true)}
                style={{
                  padding: "10px 20px", borderRadius: 8, fontSize: 13,
                  border: "1px solid var(--color-border-default)",
                  background: "transparent", color: "var(--color-text-primary)", cursor: "pointer",
                }}
              >
                Cancel subscription
              </button>
            )}
          </>
        ) : (
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Loading...</div>
        )}
      </div>

      {/* ── API Keys ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 4, color: "var(--color-text-secondary)" }}>
          Segmind — image &amp; video generation
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
          Powers image and video generation (including comic panels and character portraits). Pay only for what you generate — nothing expires. Get a key at <a href="https://segmind.com" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>segmind.com</a>.
        </p>
        <Field label="Segmind API Key" isSet={settings?.segmindKeySet ?? false} last4={settings?.segmindKeyLast4 ?? ""}
          value={segmindApiKey} onChange={setSegmindApiKey} placeholder="SG_..." />
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 4, color: "var(--color-text-secondary)" }}>
          Higgsfield — character training (Soul ID, optional)
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
          Only needed to train consistent characters (Soul ID). Requires a Higgsfield subscription. Skip this if you only want image/video generation.
        </p>
        <Field label="Higgsfield API Key" isSet={settings?.higgsfieldKeySet ?? false} last4={settings?.higgsfieldKeyLast4 ?? ""}
          value={higgsfieldApiKey} onChange={setHiggsfieldApiKey} placeholder="hf_..." />
        <Field label="Higgsfield API Secret" isSet={settings?.higgsfieldSecretSet ?? false} last4={settings?.higgsfieldSecretLast4 ?? ""}
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
    </>
  );
}
