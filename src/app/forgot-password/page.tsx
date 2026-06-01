"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0c0e", fontFamily: "'Figtree', sans-serif", padding: "24px 20px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#f0ede6", fontWeight: 600, marginBottom: 8 }}>
          Reset your password
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 32 }}>
          Enter your email and we'll send a reset link if an account exists.
        </div>

        {sent ? (
          <div style={{ background: "#0f1f0f", border: "1px solid #2d4a2d", borderRadius: 10, padding: "20px 24px", color: "#86efac", fontSize: 14, lineHeight: 1.6 }}>
            If an account exists for that email, you'll receive a reset link shortly.
            Check your spam folder if it doesn't arrive within a few minutes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: "100%", padding: "12px 14px", background: "#161618", border: "1px solid #1e1e28", borderRadius: 10, fontSize: 14, color: "#f0ede6", boxSizing: "border-box", outline: "none" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "13px 0", background: "#c9a84c", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#0c0c0e", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#555" }}>
          <Link href="/login" style={{ color: "#c9a84c", textDecoration: "none", fontWeight: 600 }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
