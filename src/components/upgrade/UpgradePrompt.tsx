"use client";
// src/components/upgrade/UpgradePrompt.tsx
// Modal shown when a user hits a tier gate.

import { useState } from "react";
import Script from "next/script";
import { useSession } from "next-auth/react";
import type { FeatureGate } from "@/types/subscription";
import { UPGRADE_COPY, UPGRADE_TIER } from "@/types/subscription";

declare global {
  interface Window { Razorpay: any; }
}

interface UpgradePromptProps {
  feature: FeatureGate;
  onClose: () => void;
}

export function UpgradePrompt({ feature, onClose }: UpgradePromptProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = UPGRADE_COPY[feature];
  const tier = UPGRADE_TIER[feature];

  const handleUpgrade = async () => {
    if (typeof window === "undefined" || !window.Razorpay) {
      setError("Checkout is still loading — try again in a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, billingPeriod: "monthly" }),
      });
      const data = await res.json();
      if (!res.ok || !data.subscriptionId) {
        setError(data.error ?? "Failed to create checkout session. Please try again.");
        setLoading(false);
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
        modal: { ondismiss: () => setLoading(false) },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch("/api/subscription/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, tier }),
          });
          setLoading(false);
          if (verifyRes.ok) {
            onClose();
          } else {
            setError("Payment received but verification failed — contact support if your plan doesn't update shortly.");
          }
        },
      });
      checkout.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
        setLoading(false);
      });
      checkout.open();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 32,
        maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1F2937", lineHeight: 1.3 }}>
            {copy.title}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 20, padding: "0 0 0 16px" }}
          >
            ×
          </button>
        </div>

        {/* Description */}
        <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 24 }}>
          {copy.description}
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 13, color: "#EF4444", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width: "100%", padding: "12px 24px", borderRadius: 8,
            background: loading ? "#A5B4FC" : "#4F46E5",
            color: "#fff", fontWeight: 600, fontSize: 15,
            border: "none", cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Redirecting to checkout..." : copy.cta}
        </button>

        {/* Dismiss */}
        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: 12, padding: "10px 24px",
            background: "none", border: "1px solid #E5E7EB",
            borderRadius: 8, color: "#6B7280", fontSize: 14, cursor: "pointer",
          }}
        >
          Not now
        </button>

        {/* Fine print */}
        <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 16 }}>
          Cancel anytime · Secure payment via Razorpay · No hidden fees
        </div>
      </div>
    </div>
    </>
  );
}
