"use client";
import { useState, useRef } from "react";
import { toast } from "@/lib/toast";
import { buildStaticContext, buildStaticContextDetailed, buildDynamicContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { buildContextForGeneration } from "@/lib/ai/context-shadow";
import { libraryHandler } from "@/lib/ai/library-handlers";
import { sceneHandler } from "@/lib/ai/scene-handlers";
import { runGenerationPipeline } from "@/lib/ai/generation-service";
import { isCreatorFormat } from "@/lib/formats";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import type { CompositionLayer } from "@/lib/ai/composer";
import { parseBeatList } from "@/lib/modes/beats";
import { appendToTipTap, buildNeighbourContext, callAI, callAIStream } from "./ai-shared";

// Headroom v3: buildStaticContext() (via buildStaticContextDetailed) runs here,
// client-side, so this is the only place with the raw content of sections
// Headroom v1/v2 decided to drop. The actual compression call has to happen
// server-side (Anthropic key custody), so this hook calls the dedicated rescue
// route with what got dropped and splices the result back in. Fixed, modest
// rescue budget rather than reconstructing the exact original budget math —
// STATIC_CONTEXT_BUDGET is itself a soft target, not an API-enforced limit.
const HEADROOM_RESCUE_BUDGET_TOKENS = 1200;

async function rescueHeadroom(skipped: { label: string; content: string }[]): Promise<string> {
  if (skipped.length === 0) return "";
  try {
    const res = await fetch("/api/ai/headroom-rescue", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipped, remainingBudgetTokens: HEADROOM_RESCUE_BUDGET_TOKENS }),
    });
    const data = await res.json();
    return typeof data.rescued === "string" ? data.rescued : "";
  } catch {
    return ""; // fail-open: generation proceeds with the already-trimmed context
  }
}

export function useGeneration({
  project, mode, prompt, activeChap,
  updateChapter, updateProject, setUpgradeRequired,
  creatorBible, cohostVoice,
  activeInfluence, activePatterns,
  setUndoStack, setStreamText, buildFullContext,
  runQualityCheck, runEntityExtraction,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  updateProject?: (fn: (p: any) => any) => void;
  setUpgradeRequired?: (feature: string) => void;
  creatorBible: any;
  cohostVoice?: string;
  activeInfluence?: any;
  activePatterns?: any[];
  setUndoStack: React.Dispatch<React.SetStateAction<string[]>>;
  setStreamText: React.Dispatch<React.SetStateAction<string>>;
  buildFullContext: (p?: any) => string;
  runQualityCheck: (output: string, projectId: string) => Promise<void>;
  runEntityExtraction: (text: string) => Promise<void>;
}) {
  const lastGenRef = useRef<{ fn: () => Promise<void> } | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  const [generating, setGenerating] = useState(false);
  const [genTarget, setGenTarget] = useState("");
  const [hookScore, setHookScore] = useState<{ score: number; feedback: string } | null>(null);
  const [hookScoring, setHookScoring] = useState(false);
  const [violationBanner, setViolationBanner] = useState<{ violationType: string; flagMessage: string; supportMode: string } | null>(null);

  const generate = async (opts?: { cameraPresetId?: string; referencePassage?: string; additionalContext?: string; skipBlueprint?: boolean; insertViaEditor?: (text: string) => void; editorStream?: { start: () => void; delta: (t: string) => void; end: (full: string) => void } }) => {
    if (!prompt.trim()) return;
    retryCountRef.current = 0;
    lastGenRef.current = { fn: () => generate(opts) };
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const isCohost = mode === "cohost";
      const effectiveMode = isCohost ? "write" : mode;
      const effectiveFormat = isCohost ? "Podcast Episode (Co-host)" : project.format;
      const effectivePrompt = isCohost && cohostVoice
        ? `${prompt}\n\nCo-host voice persona: ${cohostVoice}`
        : prompt;

      const extended = { ...project, activeMode: effectiveMode, currentPrompt: effectivePrompt, activeInfluence, activePatterns };
      let staticCtx: string;
      let dynamicCtx: string;
      if (isCreatorFormat(project.format)) {
        staticCtx = buildCreatorContext({ ...extended, creatorBible });
        dynamicCtx = '';
      } else {
        // Phase 0 / v4 §5: this was `buildStaticContextDetailed(extended)` with
        // NO mode, so resolveContextPolicy returned FULL_CONTEXT_POLICY for every
        // request and the mode-aware policy was inert in production. It now goes
        // through buildContextForGeneration, which passes `effectiveMode`, builds
        // both variants, and — while CONTEXT_POLICY_VERSION is "shadow" — returns
        // the LEGACY text for actual generation while recording the difference.
        // Zero behaviour change until the switch is deliberately moved to
        // "mode-aware"; see src/lib/ai/context-policy-version.ts.
        const built = buildContextForGeneration(extended, effectiveMode);
        staticCtx = built.staticCtx;
        dynamicCtx = built.dynamicCtx;
        if (built.skipped.length > 0) {
          const rescued = await rescueHeadroom(built.skipped);
          if (rescued) staticCtx += '\n\n' + rescued;
        }
      }
      const neighbourCtx = buildNeighbourContext(project);
      if (neighbourCtx) dynamicCtx += '\n\n' + neighbourCtx;

      if (opts?.cameraPresetId) {
        const { CAMERA_PRESETS, VIRAL_PRESETS } = await import('@/lib/higgsfield/presets');
        const preset = CAMERA_PRESETS[opts.cameraPresetId] ?? VIRAL_PRESETS[opts.cameraPresetId];
        if (preset) {
          dynamicCtx += [
            '',
            'CAMERA LANGUAGE MODE:',
            'Write this scene as prose that establishes clear visual grammar.',
            `Apply this camera perspective: ${preset.label}`,
            preset.promptInjection,
            'Describe action and space in terms that translate directly to shot descriptions.',
            'End each paragraph with a clear sense of where the camera is and what it sees.',
          ].join('\n');
        }
      }

      // Reference passage analysis — extract craft techniques before generation
      let additionalContext = opts?.additionalContext ?? '';
      if (opts?.referencePassage?.trim() && opts.referencePassage.length > 50) {
        try {
          const passageRes = await fetch('/api/ai/analyze-passage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passage: opts.referencePassage }),
          });
          const passageData = await passageRes.json();
          if (passageData.directives) additionalContext = additionalContext ? additionalContext + '\n\n' + passageData.directives : passageData.directives;
        } catch { /* passage analysis must never block generation */ }
      }

      const genBody = { mode: effectiveMode, prompt: effectivePrompt, staticContext: staticCtx, dynamicContext: dynamicCtx, format: effectiveFormat, projectId: project.id, chapterId: activeChap.id, narrativeStructure: (project as any).narrativeStructure, additionalContext: additionalContext || undefined, skipBlueprint: opts?.skipBlueprint || undefined };
      // Live-stream prose into the editor when a streaming target is available (write mode only).
      const useStream = mode === "write" && !!opts?.editorStream;
      let streamedText = "";
      let r: any;
      if (useStream && opts?.editorStream) {
        opts.editorStream.start();
        r = await callAIStream("generate", genBody, (delta) => { streamedText += delta; opts.editorStream!.delta(delta); });
      } else {
        r = await callAI("generate", genBody);
      }
      // If streaming was started but the server returned a control response
      // (gate / violation / retry), restore the editor and drop any partial.
      if (useStream && opts?.editorStream && (r.retryable || r.requiresConfirmation || r.error)) {
        opts.editorStream.end(streamedText || "");
      }
      if (r.retryable) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const retryFn = lastGenRef.current?.fn;
          toast.error(`AI is busy — retrying in 5 seconds... (${retryCountRef.current}/${MAX_RETRIES})`, {
            label: 'Retry now', onClick: () => { retryCountRef.current = MAX_RETRIES; retryFn?.(); },
          });
          setTimeout(() => retryFn?.(), 5000);
        } else {
          retryCountRef.current = 0;
          toast.error('AI rate limit reached. Please wait a moment before generating again.');
        }
      } else if (r.requiresConfirmation) { setViolationBanner({ violationType: r.violationType, flagMessage: r.flagMessage, supportMode: r.supportMode }); }
      else if (r.error === "upgrade_required") { setUpgradeRequired?.(r.feature); }
      else {
        if (mode === "write") {
          setUndoStack(s => [...s.slice(-9), activeChap.content]);
          if (useStream && opts?.editorStream) {
            opts.editorStream.end(r.text ?? streamedText ?? "");
          } else if (opts?.insertViaEditor) {
            opts.insertViaEditor(r.text);
          } else {
            const merged = appendToTipTap(activeChap.content, r.text);
            updateChapter("content", merged);
          }
        } else {
          setStreamText(r.text);
          if (mode === "outline" && parseBeatList(r.text)) {
            updateProject?.((p: any) => ({ ...p, notes: r.text }));
            fetch(`/api/projects/${project.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes: r.text }),
            }).catch(() => {});
          }
        }
        if (MODE_REGISTRY[mode as GenerationMode]?.qualityCheck && (project as any).qualityGradingEnabled) {
          runQualityCheck(r.text, project.id);
        }
        if (mode === "write") {
          runEntityExtraction(r.text);
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('rate') || msg.includes('429') || msg.includes('529')) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const retryFn = lastGenRef.current?.fn;
          toast.error(`AI is busy — retrying in 5 seconds... (${retryCountRef.current}/${MAX_RETRIES})`, {
            label: 'Retry now', onClick: () => { retryCountRef.current = MAX_RETRIES; retryFn?.(); },
          });
          setTimeout(() => retryFn?.(), 5000);
        } else {
          retryCountRef.current = 0;
          toast.error('AI rate limit reached. Please wait a moment before generating again.');
        }
      } else if (msg.includes('network') || msg.includes('fetch')) {
        toast.error('Connection lost. Check your internet and try again.');
      } else {
        toast.error('Generation failed. Your work is safe — try again.');
      }
    }
    setGenerating(false); setGenTarget("");
  };

  const expandBeat = async (beatText: string, expandOpts?: { insertViaEditor?: (text: string) => void }) => {
    const effectivePrompt = `Write this scene: ${beatText}`;
    const extended = { ...project, activeMode: 'write', currentPrompt: effectivePrompt, activeInfluence, activePatterns };
    let staticCtx: string;
    let dynamicCtx: string;
    if (isCreatorFormat(project.format)) {
      staticCtx = buildCreatorContext({ ...extended, creatorBible });
      dynamicCtx = '';
    } else {
      staticCtx = buildStaticContext(extended);
      dynamicCtx = buildDynamicContext(extended);
    }
    const neighbourCtx = buildNeighbourContext(project);
    if (neighbourCtx) dynamicCtx += '\n\n' + neighbourCtx;

    const r = await callAI("generate", { mode: 'write', prompt: effectivePrompt, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id, narrativeStructure: (project as any).narrativeStructure });
    if (r.error || !r.text) {
      throw new Error(r.error || 'Expansion failed');
    }
    setUndoStack(s => [...s.slice(-9), activeChap.content]);
    if (expandOpts?.insertViaEditor) {
      expandOpts.insertViaEditor(r.text);
    } else {
      const merged = appendToTipTap(activeChap.content, r.text);
      updateChapter("content", merged);
    }
  };

  const autoSummarize = async () => {
    if (!activeChap.content) return;
    setGenerating(true); setGenTarget("summary");
    try { const r = await callAI("summarize", { content: activeChap.content }); updateChapter("summary", r.summary); }
    catch (e) { toast.error("Failed to summarize chapter. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  /**
   * Phase 1 / v4 item 9: "Dialogue/interrogation/chase duplicates collapse into
   * the same path." These were three near-identical 25-line functions; they now
   * differ only in the data in `@/lib/ai/scene-handlers`.
   *
   * Unlike the library modes, this family pushes an undo entry before replacing
   * the chapter text, because it overwrites a drafted scene.
   */
  const runSceneGeneration = async (
    modeKey: string,
    idA: string,
    idB: string,
    rest: string[],
    prompt: string,
  ) => {
    const handler = sceneHandler(modeKey);
    if (!handler) { toast.error(`Unknown scene mode: ${modeKey}`); return; }
    if (!idA || !idB) { toast.error(handler.missingCharactersMessage); return; }
    const p = project;
    const charA = p.characters?.find((c: any) => c.id === idA);
    const charB = p.characters?.find((c: any) => c.id === idB);
    // A stale id after a character was deleted: bail silently, as before.
    if (!charA || !charB) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const plan = await handler.plan(charA, charB, rest);
      const extended = { ...p, activeMode: modeKey, currentPrompt: prompt, activeInfluence, activePatterns };
      const staticCtx = plan.contextPrefix + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeKey,
          prompt: prompt || plan.defaultPrompt,
          staticContext: staticCtx,
          dynamicContext: dynamicCtx,
          format: p.format,
          projectId: p.id,
          chapterId: activeChap?.id,
        }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) {
        setUndoStack(prev => [...prev.slice(-4), activeChap?.content || ""]);
        setStreamText(data.text);
      }
    } catch (e) { toast.error(handler.errorMessage); }
    setGenerating(false); setGenTarget("");
  };

  const generateDialogue = async (charAId: string, charBId: string, dialoguePrompt: string, archetypeName = "Argument") =>
    runSceneGeneration("dialogue", charAId, charBId, [archetypeName], dialoguePrompt);

  const generateInterrogation = async (interrogatorId: string, subjectId: string, goal: string, interrogationPrompt: string) =>
    runSceneGeneration("interrogation", interrogatorId, subjectId, [goal], interrogationPrompt);

  const generateChase = async (pursuedId: string, pursuerId: string, terrain: string, stakes: string, chasePrompt: string) =>
    runSceneGeneration("chase", pursuedId, pursuerId, [terrain, stakes], chasePrompt);

  // ---------------------------------------------------------------------
  // The 19 library-mode generators below share an identical flow: validate
  // an archetype/style param, build a library-specific context prefix, then
  // POST to /api/ai/generate. runLibraryGeneration() captures that flow;
  // each wrapper supplies only its mode-specific pieces.
  // ---------------------------------------------------------------------
  const runLibraryGeneration = async (opts: {
    modeKey: string;
    contextPrefix: string;
    prompt: string;
    defaultPrompt: string;
    errorMessage: string;
  }) => {
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      // Phase 1 / v4 item 9: the real call site for GenerationService. Stage
      // order (build context -> generate -> parse) is now explicit rather than
      // implied by statement order inside a try block, and a paywall refusal is
      // a first-class pipeline stop instead of an inline `data.error` branch.
      // `reserve`/`finalizeUsage` are deliberately NOT supplied: billing happens
      // server-side in /api/ai/generate, and the service refuses to settle a
      // reservation it never made.
      const outcome = await runGenerationPipeline<{ mode: string; prompt: string }>(
        { mode: opts.modeKey, prompt: opts.prompt || opts.defaultPrompt },
        {
          buildContext: () => {
            const extended = { ...project, activeMode: opts.modeKey, currentPrompt: opts.prompt, activeInfluence, activePatterns };
            // Phase 0 / v4 §5: was `buildStaticContext(extended)` with no mode, so every
            // library mode silently got FULL_CONTEXT_POLICY. These 19 modes are exactly
            // where the policy matters most — combat/horror/action are supposed to GAIN
            // world elements and DROP memories, dialogue is supposed to DROP locations.
            const built = buildContextForGeneration(extended, opts.modeKey);
            return { static: opts.contextPrefix + "\n---\n" + built.staticCtx, dynamic: built.dynamicCtx };
          },
          generate: async (r, ctx) => {
            const res = await fetch("/api/ai/generate", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: r.mode,
                prompt: r.prompt,
                staticContext: ctx.staticContext,
                dynamicContext: ctx.dynamicContext,
                format: project.format,
                projectId: project.id,
                chapterId: activeChap.id,
              }),
            });
            const data = await res.json();
            return data?.error
              ? { text: "", control: data }
              : { text: String(data?.text ?? ""), model: data?.model };
          },
          parse: (out) => {
            const control = out.control as { error?: string; feature?: string } | undefined;
            // A paywall/refusal control is a prompt, not a failure to toast.
            if (control?.error) {
              return { stop: { ok: false, reason: control.error, feature: control.feature } };
            }
            if (out.text) setStreamText(out.text);
            return out;
          },
        },
      );
      const refusal = outcome as { feature?: string };
      if (refusal.feature) setUpgradeRequired?.(refusal.feature);
      else if (!outcome.ok && outcome.reason) throw new Error(outcome.reason);
    } catch { toast.error(opts.errorMessage); }
    setGenerating(false); setGenTarget("");
  };

  /**
   * Phase 1 / v4 item 9: runs any registered library mode. The 19 hand-written
   * wrappers (generateHorror, generateCombat, generateIsekai, …) were identical
   * apart from the context builder, mode key, default prompt and two toasts, so
   * they are now data in `@/lib/ai/library-handlers`. Every user-facing string is
   * reproduced exactly — `scripts/verify-library-handlers.mts` diffs the rendered
   * output against the pre-refactor source, and
   * `lib/ai/__tests__/library-handlers.test.ts` pins each one.
   */
  const runRegisteredMode = async (modeKey: string, args: string[], prompt: string) => {
    const handler = libraryHandler(modeKey);
    if (!handler) { toast.error(`Unknown mode: ${modeKey}`); return; }
    const present = args.slice(0, handler.argCount).filter(Boolean);
    if (present.length < handler.argCount) { toast.error(handler.missingArgsMessage); return; }
    const buildContext = await handler.loadContext();
    await runLibraryGeneration({
      modeKey,
      contextPrefix: buildContext(args[0]!, args[1] ?? ""),
      prompt,
      defaultPrompt: handler.defaultPrompt(args),
      errorMessage: handler.errorMessage,
    });
  };

  const generateCombat = (styleA: string, styleB: string, combatPrompt: string) =>
    runRegisteredMode("combat", [styleA, styleB], combatPrompt);

  const generateEmotionalScene = (emotionName: string, emotionalPrompt: string) =>
    runRegisteredMode("emotional", [emotionName], emotionalPrompt);

  const generateAtmosphere = (environmentName: string, atmospherePrompt: string) =>
    runRegisteredMode("atmosphere", [environmentName], atmospherePrompt);

  const generateTension = (tensionType: string, tensionPrompt: string) =>
    runRegisteredMode("tension", [tensionType], tensionPrompt);

  const generateHorror = (archetypeName: string, horrorPrompt: string) =>
    runRegisteredMode("horror", [archetypeName], horrorPrompt);

  const generateComedy = (archetypeName: string, comedyPrompt: string) =>
    runRegisteredMode("comedy", [archetypeName], comedyPrompt);

  const generateMystery = (archetypeName: string, mysteryPrompt: string) =>
    runRegisteredMode("mystery", [archetypeName], mysteryPrompt);

  const generateRomance = (archetypeName: string, romancePrompt: string) =>
    runRegisteredMode("romance", [archetypeName], romancePrompt);

  const generateMonologue = (archetypeName: string, monologuePrompt: string) =>
    runRegisteredMode("monologue", [archetypeName], monologuePrompt);

  const generateVoice = (profileName: string, voicePrompt: string) =>
    runRegisteredMode("voice", [profileName], voicePrompt);

  const generateThriller = (archetypeName: string, thrillerPrompt: string) =>
    runRegisteredMode("thriller", [archetypeName], thrillerPrompt);

  const generateSports = (archetypeName: string, sportsPrompt: string) =>
    runRegisteredMode("sports", [archetypeName], sportsPrompt);

  const generateAction = (archetypeName: string, actionPrompt: string) =>
    runRegisteredMode("action", [archetypeName], actionPrompt);

  const generateSetting = (archetypeName: string, settingPrompt: string) =>
    runRegisteredMode("setting", [archetypeName], settingPrompt);

  const generateHistorical = (archetypeName: string, historicalPrompt: string) =>
    runRegisteredMode("historical", [archetypeName], historicalPrompt);

  const generateScitech = (archetypeName: string, scitechPrompt: string) =>
    runRegisteredMode("scitech", [archetypeName], scitechPrompt);

  const generateEthics = (archetypeName: string, ethicsPrompt: string) =>
    runRegisteredMode("ethics", [archetypeName], ethicsPrompt);

  const generateEndings = (archetypeName: string, endingsPrompt: string) =>
    runRegisteredMode("endings", [archetypeName], endingsPrompt);

  const generateIsekai = (archetypeName: string, isekaiPrompt: string) =>
    runRegisteredMode("isekai", [archetypeName], isekaiPrompt);

  const generateComposition = async (layers: CompositionLayer[], compositionPrompt: string) => {
    if (!layers.length) { toast.error("Select at least one layer before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const { buildCompositionContext } = await import('@/lib/ai/composer');
      const { compactContext } = await import('@/lib/compact');
      const libraryCtx = buildCompositionContext(layers);
      const storyCtx = buildFullContext();
      const fullCtx = compactContext(libraryCtx + "\n\n---\n\n" + storyCtx);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "composition",
          prompt: compositionPrompt || "Write a scene using the active composition layers.",
          context: fullCtx,
          format: project.format,
          projectId: project.id,
          chapterId: activeChap.id,
        }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { toast.error("Composition generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const confirmViolation = async (violationType: string, purpose: string, insertViaEditor?: (text: string) => void) => {
    setViolationBanner(null);
    if (!project.id) return;
    await fetch(`/api/projects/${project.id}/intentional-violation`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ violationType, purpose }),
    });
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const isCohost = mode === "cohost";
      const effectiveMode = isCohost ? "write" : mode;
      const effectiveFormat = isCohost ? "Podcast Episode (Co-host)" : project.format;
      const r = await callAI("generate", { mode: effectiveMode, prompt, context: buildFullContext(), format: effectiveFormat, projectId: project.id, chapterId: activeChap.id, bypassViolationCheck: true });
      if (r.error === "upgrade_required") { setUpgradeRequired?.(r.feature); }
      else if (mode === "write") {
        setUndoStack(s => [...s.slice(-9), activeChap.content]);
        if (insertViaEditor) {
          insertViaEditor(r.text);
        } else {
          const merged2 = appendToTipTap(activeChap.content, r.text);
          updateChapter("content", merged2);
        }
      } else setStreamText(r.text);
    } catch { toast.error("Generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const scoreHook = async () => {
    if (!prompt.trim() || hookScoring) return;
    setHookScoring(true); setHookScore(null);
    try {
      const res = await fetch("/api/ai/score-hook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hook: prompt, format: project.format }) });
      const data = await res.json();
      if (data.score != null) setHookScore(data);
    } catch (e) { toast.error("Hook scoring failed. Please try again."); }
    setHookScoring(false);
  };

  return {
    generating, setGenerating, genTarget, setGenTarget,
    hookScore, hookScoring,
    violationBanner, setViolationBanner,
    generate, expandBeat, autoSummarize,
    generateDialogue, generateInterrogation, generateChase,
    generateCombat, generateEmotionalScene, generateAtmosphere, generateTension, generateComposition,
    generateHorror, generateComedy, generateMystery, generateRomance, generateAction,
    generateMonologue, generateVoice, generateThriller, generateSports,
    generateSetting, generateHistorical, generateScitech, generateEthics, generateEndings,
    generateIsekai,
    confirmViolation, scoreHook,
  };
}
