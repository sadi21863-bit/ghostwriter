"use client";
import { useState, useEffect } from "react";

export default function Onboarding({ onDismiss }: { onDismiss: () => void }) {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to GhostWriter",
            description: "AI-powered creative writing for everyone. Whether you're a beginner or an experienced writer, GhostWriter adapts to your skill level.",
            emoji: "✨",
            color: "#5b4ccc",
        },
        {
            title: "🎯 Beginner Mode",
            description: "Perfect if you're just starting out. Tell GhostWriter your story idea with a title and genre, and it will instantly generate:\n\n• 3-4 main characters\n• 2-3 key locations\n• Plot outline and structure\n\nThen edit, refine, and start writing immediately!",
            emoji: "🎯",
            color: "#2d9e5e",
        },
        {
            title: "⭐ Expert Mode",
            description: "Full creative control. Build your own world:\n\n• Manually add detailed characters (13 different attributes)\n• Create rich locations with sensory details\n• Define complex plot threads and their connections\n• Add style reference works for tonal consistency\n\nUse AI as your assistant for enhancement, not generation.",
            emoji: "⭐",
            color: "#c9860a",
        },
        {
            title: "How They Work Together",
            description: "Both modes feature:\n\n✓ Continuity tracking between chapters\n✓ AI brainstorming, outlining, and writing modes\n✓ Character/location/plot improvement with AI\n✓ Style analysis from reference works\n✓ Full chapter management and export\n\nChoose the mode that matches your creative style!",
            emoji: "🚀",
            color: "#d94545",
        },
        {
            title: "Pro Tips",
            description: "• Beginners can always edit auto-generated content\n• Experts can use AI World Builder for quick ideas\n• Add previous chapter summaries for better continuity\n• Use reference works to maintain consistent tone\n• Switch between Brainstorm, Outline, and Write modes\n\nLet's create something amazing!",
            emoji: "💡",
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
