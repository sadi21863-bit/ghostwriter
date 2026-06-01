"use client";
import type { FormEvent } from "react";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Tab = "signin" | "register";

export default function Login() {
  const router = useRouter();
  const [tab, setTab]       = useState<Tab>("signin");
  const [email, setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]     = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const switchTab = (t: Tab) => { setTab(t); setError(""); };

  // Persist referral code from ?ref= query param into sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) sessionStorage.setItem("referralCode", ref);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (tab === "register") {
      const ref = typeof window !== "undefined" ? sessionStorage.getItem("referralCode") ?? undefined : undefined;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, ref }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(tab === "register" ? "Account created but sign-in failed — try signing in" : "Invalid email or password");
      if (tab === "register") switchTab("signin");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Figtree:wght@400;500;600;700&display=swap');
        @keyframes gw-fade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gw-mesh { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.06) rotate(3deg)} }
        .gw-form { animation: gw-fade 0.5s ease both; }
        .gw-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .gw-input:focus { border-color: #c9a84c !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.12) !important; outline: none; }
        .gw-submit { transition: background 0.2s, transform 0.15s; }
        .gw-submit:hover:not(:disabled) { background: #b8963e !important; transform: translateY(-1px); }
        .gw-tab { transition: all 0.2s; }
        .gw-mesh { animation: gw-mesh 14s ease-in-out infinite; }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Figtree', sans-serif", background: "#0c0c0e" }}>

        {/* Left panel — decorative */}
        <div style={{ display: "none", width: "42%", background: "linear-gradient(160deg,#13131a 0%,#0c0c0e 100%)", padding: "56px 48px", flexDirection: "column", justifyContent: "space-between", borderRight: "1px solid #1e1e28", position: "relative", overflow: "hidden" }} className="gw-left">
          <style>{`.gw-left { display: none; } @media(min-width:768px){.gw-left{display:flex;}}`}</style>

          {/* Mesh orb */}
          <div className="gw-mesh" style={{ position: "absolute", top: "15%", left: "-20%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "-10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,76,204,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "#c9a84c", textTransform: "uppercase", fontWeight: 600, marginBottom: 48 }}>GhostWriter</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, lineHeight: 1.1, color: "#f0ede6", fontWeight: 600, marginBottom: 24, maxWidth: 320 }}>
              Every great story begins with a single word.
            </div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.7, maxWidth: 300 }}>
              AI-powered writing studio for novelists, screenwriters, and content creators.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {["Adaptive AI writing modes", "Character & world building", "Professional story health tools"].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c9a84c", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#777" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
          <div className="gw-form" style={{ width: "100%", maxWidth: 400 }}>

            {/* Mobile logo */}
            <div style={{ textAlign: "center", marginBottom: 40 }} className="gw-mobile-logo">
              <style>{`.gw-mobile-logo { display:block; } @media(min-width:768px){.gw-mobile-logo{display:none;}}`}</style>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: "#f0ede6", fontWeight: 600, letterSpacing: 1 }}>GhostWriter</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4, letterSpacing: 3, textTransform: "uppercase" }}>Writing Studio</div>
            </div>

            <div style={{ marginBottom: 32 }} className="gw-desktop-heading">
              <style>{`.gw-desktop-heading { display:none; } @media(min-width:768px){.gw-desktop-heading{display:block;}}`}</style>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: "#f0ede6", fontWeight: 600, marginBottom: 6 }}>
                {tab === "signin" ? "Welcome back." : "Begin your story."}
              </div>
              <div style={{ fontSize: 13, color: "#555" }}>
                {tab === "signin" ? "Sign in to your writing studio." : "Create your account to get started."}
              </div>
            </div>

            {/* Tab switcher */}
            <div style={{ display: "flex", background: "#161618", borderRadius: 10, padding: 4, marginBottom: 28, border: "1px solid #1e1e28" }}>
              {(["signin", "register"] as Tab[]).map(t => (
                <button
                  key={t}
                  className="gw-tab"
                  type="button"
                  onClick={() => switchTab(t)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "'Figtree', sans-serif", cursor: "pointer", border: "none", background: tab === t ? "#1e1e2a" : "transparent", color: tab === t ? "#f0ede6" : "#555", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.4)" : "none" }}
                >
                  {t === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {tab === "register" && (
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Name</label>
                  <input
                    type="text"
                    className="gw-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    style={{ width: "100%", padding: "12px 14px", background: "#161618", border: "1px solid #1e1e28", borderRadius: 10, fontSize: 14, color: "#f0ede6", boxSizing: "border-box", fontFamily: "'Figtree', sans-serif" }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="gw-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ width: "100%", padding: "12px 14px", background: "#161618", border: "1px solid #1e1e28", borderRadius: 10, fontSize: 14, color: "#f0ede6", boxSizing: "border-box", fontFamily: "'Figtree', sans-serif" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Password</label>
                <input
                  type="password"
                  required
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  className="gw-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={tab === "register" ? "Min 8 characters" : "••••••••"}
                  style={{ width: "100%", padding: "12px 14px", background: "#161618", border: "1px solid #1e1e28", borderRadius: 10, fontSize: 14, color: "#f0ede6", boxSizing: "border-box", fontFamily: "'Figtree', sans-serif" }}
                />
              </div>

              {error && (
                <div style={{ fontSize: 13, color: "#e05c5c", background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: 8, padding: "10px 14px" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="gw-submit"
                style={{ width: "100%", padding: "13px 0", background: "#c9a84c", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#0c0c0e", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "'Figtree', sans-serif", letterSpacing: 0.3, marginTop: 4 }}
              >
                {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
              </button>

              {tab === "signin" && (
                <div style={{ textAlign: "center" }}>
                  <a href="/forgot-password" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>
                    Forgot password?
                  </a>
                </div>
              )}
            </form>

            <div style={{ textAlign: "center", marginTop: 28, fontSize: 12, color: "#333" }}>
              {tab === "signin" ? "No account? " : "Already have one? "}
              <button
                type="button"
                onClick={() => switchTab(tab === "signin" ? "register" : "signin")}
                style={{ background: "none", border: "none", color: "#c9a84c", cursor: "pointer", fontSize: 12, fontFamily: "'Figtree', sans-serif", fontWeight: 600, padding: 0 }}
              >
                {tab === "signin" ? "Create one →" : "Sign in →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
