"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OnboardingAnswers = {
  format: string;
  challenge: string;
  startMode: "example" | "blank";
};

type Props = { onDismiss: () => void };

const FORMATS = [
  { value: "Novel",             label: "📚  Novel" },
  { value: "Screenplay",        label: "🎬  Screenplay" },
  { value: "Web Series",        label: "📺  Web Series" },
  { value: "YouTube Long-form", label: "▶️  YouTube Channel" },
  { value: "Podcast Episode",   label: "🎙️  Podcast" },
  { value: "TikTok Script",     label: "📱  TikTok" },
];

const CHALLENGES = [
  { value: "getting_started", label: "Getting started — I stare at a blank page" },
  { value: "character_depth", label: "My characters feel flat or generic" },
  { value: "pacing",          label: "My story loses momentum in the middle" },
  { value: "consistency",     label: "I lose track of details across chapters" },
];

const STEPS = [
  { question: "What are you building?", options: FORMATS, key: "format" as const },
  { question: "What's your biggest challenge?", options: CHALLENGES, key: "challenge" as const },
  {
    question: "How do you want to start?",
    options: [
      { value: "example", label: "📖  Show me a sample project so I can explore" },
      { value: "blank",   label: "⚡  Take me straight in — I'll figure it out" },
    ],
    key: "startMode" as const,
  },
];

export default function Onboarding({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePick = async (key: keyof OnboardingAnswers, value: string) => {
    const updated = { ...answers, [key]: value } as OnboardingAnswers;
    setAnswers(updated);

    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }

    // Final step — complete onboarding
    localStorage.setItem("ghostwriter_onboarding_seen", "true");
    setLoading(true);

    try {
      if (value === "example") {
        const res = await fetch("/api/ai/quick-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: updated.format ?? "Novel", title: "My First Story" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.projectId) { router.push("/project/" + data.projectId); return; }
        }
        // Fallback: create blank project if quick-start fails
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My First Story", format: updated.format ?? "Novel", skillLevel: "beginner" }),
      });
      const p = await res.json();
      router.push("/project/" + p.id);
    } catch {
      onDismiss();
    }
  };

  const current = STEPS[step];

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 50, padding: "0 16px",
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: "#fff", borderRadius: 20, padding: "36px 36px 32px",
          width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Step progress bars */}
        <div style={{ display: "flex", gap: 6, marginBottom: 36 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= step ? "#c9a84c" : "#e5e7eb",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#1a1a1a", fontFamily: "system-ui" }}>
          {current.question}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {current.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => !loading && handlePick(current.key, opt.value)}
              disabled={loading}
              style={{
                padding: "14px 18px", borderRadius: 10, textAlign: "left",
                background: "#f9fafb", border: "1px solid #e5e7eb",
                color: "#1a1a1a", fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "system-ui", transition: "border-color 0.15s, background 0.15s",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={onDismiss}
            style={{ background: "none", border: "none", color: "#aaa", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            Skip
          </button>
          {loading && (
            <span style={{ fontSize: 13, color: "#888" }}>Setting up your project…</span>
          )}
        </div>
      </div>
    </div>
  );
}
