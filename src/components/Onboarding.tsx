"use client";
import { useState, useEffect } from "react";

export default function Onboarding({ onDismiss }: { onDismiss: () => void }) {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to GhostWriter",
            description: "The complete AI writing studio — for novelists, screenwriters, and content creators. Choose your format, build your world, and let AI handle the hard parts.",
            emoji: "✨",
            color: "#5b4ccc",
        },
        {
            title: "Story Formats",
            description: "Novel, Screenplay, and Web Series come with the full toolkit:\n\n• World Bible — characters, locations, plot threads\n• Continuity engine — AI remembers everything across chapters automatically\n• Dialogue Mode — two-character scenes with enforced subtext\n• Comics & Production Studio — turn your story into visuals",
            emoji: "📖",
            color: "#2d9e5e",
        },
        {
            title: "Creator Formats",
            description: "YouTube, TikTok, Instagram, and Podcast formats include:\n\n• Creator Bible — your channel voice, audience, and content pillars\n• Platform-specific AI with correct hook and structure rules\n• Hook Scorer — real-time viral potential rating\n• Agent pipelines — Hook → Body → SEO in one click",
            emoji: "🎬",
            color: "#c9860a",
        },
        {
            title: "Two Experience Levels",
            description: "Beginner — Tell GhostWriter your idea and it generates characters, locations, and a plot outline instantly. Edit and start writing immediately.\n\nExpert — Full creative control. Build your own world and use AI as your assistant for enhancement, not generation.",
            emoji: "🎯",
            color: "#d94545",
        },
        {
            title: "How AI Stays Consistent",
            description: "GhostWriter is built to fix AI's biggest weakness — forgetting what happened earlier.\n\n• Chapter summaries auto-generate as you write\n• Story memories extract hard facts from every chapter\n• Style DNA locks your tone from reference works\n• All of this is invisible — you just write",
            emoji: "🧠",
            color: "#5b4ccc",
        },
    ];

    const currentStep = steps[step];

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            localStorage.setItem("ghostwriter_onboarding_seen", "true");
            onDismiss();
        }
    };

    const handleSkip = () => {
        localStorage.setItem("ghostwriter_onboarding_seen", "true");
        onDismiss();
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
            onClick={handleSkip}
        >
            <div
                className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="text-4xl">{currentStep.emoji}</div>
                    <button
                        onClick={handleSkip}
                        className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
                    >
                        ✕
                    </button>
                </div>

                <h2 className="text-2xl font-bold mb-4 text-gray-900">
                    {currentStep.title}
                </h2>

                <p className="text-gray-600 text-sm leading-relaxed mb-8 whitespace-pre-line">
                    {currentStep.description}
                </p>

                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 w-2 rounded-full transition-all ${i <= step ? "bg-brand w-6" : "bg-gray-200"
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="flex gap-3">
                        {step > 0 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="px-6 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand-light transition-colors"
                        >
                            {step === steps.length - 1 ? "Get Started" : "Next"}
                        </button>
                    </div>
                </div>

                <div className="text-xs text-gray-400 mt-4 text-center">
                    {step + 1} of {steps.length}
                </div>
            </div>
        </div>
    );
}
