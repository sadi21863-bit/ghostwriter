"use client";
import { useEffect, useState } from "react";

type Settings = {
  higgsfieldKeySet: boolean; higgsfieldKeyLast4: string;
  higgsfieldSecretSet: boolean; higgsfieldSecretLast4: string;
  openaiKeySet: boolean; openaiKeyLast4: string;
  imageProviderId: string;
  trendIntelligenceKeySet: boolean; trendIntelligenceKeyLast4: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [higgsfieldApiKey, setHiggsfieldApiKey] = useState("");
  const [higgsfieldApiSecret, setHiggsfieldApiSecret] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [trendKey, setTrendKey] = useState("");

  useEffect(() => {
    fetch("/api/user/settings")
      .then(r => r.json())
      .then(setSettings);
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
