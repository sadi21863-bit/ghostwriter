"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Tab = "signin" | "register";

export default function Login() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchTab = (t: Tab) => { setTab(t); setError(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (tab === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
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

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-bg px-4">
      <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm">
        <div className="text-center mb-7">
          <h1 className="text-3xl font-extrabold text-brand">GhostWriter</h1>
          <p className="text-gray-400 text-sm mt-1">AI-powered writing studio</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6 gap-1">
          {(["signin", "register"] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t ? "bg-white shadow text-brand" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "register" && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete={tab === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tab === "register" ? "Min 8 characters" : "••••••••"}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white font-bold py-2.5 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 text-sm mt-1"
          >
            {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
