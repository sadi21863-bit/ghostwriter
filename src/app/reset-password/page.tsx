"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing reset token. Request a new link.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Reset failed. Your link may have expired.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0c0e", fontFamily: "'Figtree', sans-serif", padding: "24px 20px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#f0ede6", fontWeight: 600, marginBottom: 8 }}>
          Set new password
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 32 }}>
          Choose a password that's at least 8 characters.
        </div>

        {done ? (
          <div style={{ background: "#0f1f0f", border: "1px solid #2d4a2d", borderRadius: 10, padding: "20px 24px", color: "#86efac", fontSize: 14 }}>
            Password updated. Redirecting to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
                New password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                style={{ width: "100%", padding: "12px 14px", background: "#161618", border: "1px solid #1e1e28", borderRadius: 10, fontSize: 14, color: "#f0ede6", boxSizing: "border-box", outline: "none" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                style={{ width: "100%", padding: "12px 14px", background: "#161618", border: "1px solid #1e1e28", borderRadius: 10, fontSize: 14, color: "#f0ede6", boxSizing: "border-box", outline: "none" }}
              />
            </div>
            {error && (
              <div style={{ fontSize: 13, color: "#e05c5c", background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: 8, padding: "10px 14px" }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !token}
              style={{ width: "100%", padding: "13px 0", background: "#c9a84c", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#0c0c0e", cursor: (loading || !token) ? "not-allowed" : "pointer", opacity: (loading || !token) ? 0.6 : 1 }}
            >
              {loading ? "Updating…" : "Update password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
