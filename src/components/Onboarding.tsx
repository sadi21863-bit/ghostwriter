"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { onDismiss: () => void };

const FORMATS = [
  { value: "Novel",      label: "📚  Novel" },
  { value: "Screenplay", label: "🎬  Screenplay" },
  { value: "Web Series", label: "📺  Web Series" },
];

const CHALLENGES = [
  { value: "getting_started", label: "Getting started — I stare at a blank page" },
  { value: "character_depth", label: "My characters feel flat or generic" },
  { value: "pacing",          label: "My story loses momentum in the middle" },
  { value: "consistency",     label: "I lose track of details across chapters" },
];

const BASE_STEPS = [
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
  const [format, setFormat] = useState("Novel");
  const [challenge, setChallenge] = useState("");
  const [startMode, setStartMode] = useState<"example" | "blank" | "">("");
  const [premise, setPremise] = useState("");
  const [showPremise, setShowPremise] = useState(false);
  const [loading, setLoading] = useState(false);
  const [welcomeData, setWelcomeData] = useState<{ projectId: string; sampleGeneration: string } | null>(null);
  const router = useRouter();

  // Total steps: 3 base + optional premise for blank
  const totalSteps = showPremise ? 4 : 3;
  const isPremiseStep = showPremise && step === 3;

  const completeOnboarding = async (chosenPremise?: string) => {
    localStorage.setItem("ghostwriter_onboarding_seen", "true");
    setLoading(true);
    try {
      if (startMode === "example") {
        // Create the project first, then call quick-start
        const projRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "My First Story", format, skillLevel: "standard", biggestChallenge: challenge }),
        });
        const proj = await projRes.json();
        if (!proj.id) throw new Error("project creation failed");

        const qsRes = await fetch("/api/ai/quick-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: proj.id, title: "My First Story", format, genres: [] }),
        });
        if (qsRes.ok) {
          const data = await qsRes.json();
          if (data.sampleGeneration) {
            setWelcomeData({ projectId: data.projectId ?? proj.id, sampleGeneration: data.sampleGeneration });
            setLoading(false);
            return;
          }
          router.push("/project/" + (data.projectId ?? proj.id));
          return;
        }
        router.push("/project/" + proj.id);
        return;
      }

      // Blank path
      const body: any = { name: "My First Story", format, skillLevel: "standard" };
      if (chosenPremise?.trim()) body.controllingIdea = chosenPremise.trim();
      body.biggestChallenge = challenge;
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const p = await res.json();
      router.push("/project/" + p.id);
    } catch {
      onDismiss();
    }
  };

  const handlePick = async (key: string, value: string) => {
    if (key === "format") { setFormat(value); setStep(1); return; }
    if (key === "challenge") { setChallenge(value); setStep(2); return; }
    if (key === "startMode") {
      setStartMode(value as "example" | "blank");
      if (value === "blank") {
        setShowPremise(true);
        setStep(3);
        return;
      }
      // "example" — go straight to completion
      await completeOnboarding();
      return;
    }
  };

  if (welcomeData) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 50, padding: "0 16px",
      }}>
        <div style={{ maxWidth: 680, width: "100%" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#9898a6", marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              GhostWriter generated this from your story world
            </div>
            <div style={{
              padding: "24px 28px",
              background: "#111113", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.09)",
              fontSize: 17, lineHeight: 1.85,
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: "#f2f2f3",
            }}>
              {welcomeData.sampleGeneration}
            </div>
            <div style={{ fontSize: 11, color: "#5c5c6b", marginTop: 10, textAlign: "right" }}>
              Generated using your story's character profiles, world rules, and genre context.
              Every generation improves as you build your World Bible.
            </div>
          </div>
          <button
            onClick={() => router.push("/project/" + welcomeData.projectId)}
            style={{
              width: "100%", padding: "14px",
              background: "#d97706", color: "#fff",
              border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}
          >
            Continue to your project →
          </button>
          <p style={{ textAlign: "center", fontSize: 12, color: "#5c5c6b", marginTop: 16 }}>
            Your World Bible is ready. Characters, locations, and plot threads are waiting.
          </p>
        </div>
      </div>
    );
  }

  const current = BASE_STEPS[Math.min(step, 2)];

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
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= step ? "#c9a84c" : "#e5e7eb",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {isPremiseStep ? (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1a1a1a", fontFamily: "system-ui" }}>
              Give me one sentence about your story
            </h2>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 20, fontFamily: "system-ui" }}>
              We'll use this to set up your story's context. Optional — skip if you're not sure yet.
            </p>
            <textarea
              value={premise}
              onChange={e => setPremise(e.target.value)}
              placeholder="e.g. 'A retired assassin discovers her daughter has followed in her footsteps'"
              style={{
                width: "100%", height: 80, padding: "12px 14px",
                borderRadius: 10, border: "1px solid #e5e7eb",
                fontSize: 14, fontFamily: "system-ui", resize: "none",
                color: "#1a1a1a", outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => completeOnboarding()}
                disabled={loading}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                  color: "#888", fontSize: 14, cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Skip
              </button>
              <button
                onClick={() => completeOnboarding(premise)}
                disabled={loading}
                style={{
                  flex: 2, padding: "12px", borderRadius: 10,
                  background: "#c9a84c", border: "none",
                  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Setting up…" : "Start writing →"}
              </button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
