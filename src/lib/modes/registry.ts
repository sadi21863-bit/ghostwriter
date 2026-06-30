// src/lib/modes/registry.ts
import type { FeatureGate } from "@/types/subscription";
import type { RealismDomain } from "@/lib/realism";
import type { CapabilityRole, CapabilityStage } from "@/lib/capabilities/types";

export type GenerationMode =
  | "brainstorm" | "outline" | "write"
  | "dialogue" | "combat" | "emotional" | "atmosphere" | "tension"
  | "composition" | "horror" | "comedy" | "mystery" | "romance" | "action"
  | "monologue" | "voice" | "thriller" | "sports" | "setting" | "historical"
  | "scitech" | "ethics" | "endings" | "isekai" | "interrogation" | "chase";

// "cohost" is a pseudo-mode (podcast co-host generation) and intentionally NOT part of
// GenerationMode. MODE_REGISTRY[mode as GenerationMode] is `undefined` for it — always
// access fields via optional chaining (`?.label`, `?.qualityCheck`, etc.).

export type ModeVisibility = "universal" | "story_only" | "story_and_creator";

export interface ContextPolicy {
  /** Include the CHARACTERS section in static context. */
  needsCharacters: boolean;
  /** Include the LOCATIONS section in static context. */
  needsLocations: boolean;
  /** Include STORY MEMORY / open-promises sections in dynamic context. */
  needsMemories: boolean;
  /** Include the PLOTS section in static context. */
  needsPlotThreads: boolean;
  /** Include domain realism directives (src/lib/realism) in dynamic context. */
  needsRealism: boolean;
  /** "full" = complete character profile (psychology, voice, NVC, etc); "brief" = name/role/appearance/personality/arc only. */
  charDepth: "full" | "brief";
  /** Include the WORLD ELEMENTS section (objects/weapons/orgs/phenomena) in static context. Optional → defaults falsy, so only opt-in modes (and no-mode FULL_CONTEXT_POLICY) pull it. */
  needsWorldEntities?: boolean;
}

export interface ModeConfig {
  label: string;
  modelTier: "default" | "quality";
  gate: FeatureGate | null;
  qualityCheck: boolean;
  visibility: ModeVisibility;
  /** Realism directive domains (src/lib/realism) injected into this mode's dynamic context. Omitted = none. */
  realismDomains?: readonly RealismDomain[];
  /** Slash command that opens this mode in the redesign's slash menu (Redesign Phase 2). */
  slash: string;
  /** Keywords used for auto-detection from beat text (Redesign Phase 5). */
  keywords: readonly string[];
  /** Which static/dynamic context sections this mode needs, and at what depth (C-2). */
  contextPolicy: ContextPolicy;
  /** Minimum density level required to show this mode in the toolbar. undefined = always shown. */
  minDensity?: "simple" | "standard" | "full";
  /** AI role this mode plays in the funnel: writer = generate, director = plan, editor = review. */
  role: CapabilityRole;
  /** Funnel stage this mode belongs to (Discover/Shape/Write/Produce). */
  stage: CapabilityStage;
}

const FULL: ContextPolicy  = { needsCharacters: true,  needsLocations: true,  needsMemories: true,  needsPlotThreads: true,  needsRealism: false, charDepth: "full" };
const BRIEF: ContextPolicy = { needsCharacters: true,  needsLocations: true,  needsMemories: false, needsPlotThreads: false, needsRealism: false, charDepth: "brief" };

export const MODE_REGISTRY = {
  brainstorm:    { label: "Brainstorm",    modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal",         slash: "/brainstorm",  keywords: ["brainstorm", "ideas", "what if", "possibilities", "options"], contextPolicy: { ...BRIEF, needsMemories: true, needsPlotThreads: true } , role: "writer", stage: "discover" },
  outline:       { label: "Outline",       modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal",         slash: "/outline",     keywords: ["outline", "structure", "beats", "plan", "plot out"], contextPolicy: { ...BRIEF, needsMemories: true, needsPlotThreads: true } , role: "director", stage: "shape" },
  write:         { label: "Write",         modelTier: "default", gate: null,                   qualityCheck: true,  visibility: "universal",         slash: "/write",       keywords: ["write", "continue", "draft", "next scene"], contextPolicy: FULL , role: "writer", stage: "write" },
  dialogue:      { label: "Dialogue",      modelTier: "default", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",        slash: "/dialogue",    keywords: ["dialogue", "conversation", "argument", "talk", "said", "asked"], contextPolicy: { ...FULL, needsLocations: false } , role: "writer", stage: "write" },
  combat:        { label: "Combat",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",         realismDomains: ["combat", "body", "injury"], slash: "/fight", keywords: ["fight", "battle", "combat", "attack", "punch", "sword", "gun", "strike"], contextPolicy: { ...FULL, needsMemories: false, needsPlotThreads: false, needsRealism: true, needsWorldEntities: true }, minDensity: "full" , role: "writer", stage: "write" },
  emotional:     { label: "Emotional",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator",  realismDomains: ["body"], slash: "/emotion", keywords: ["cry", "grief", "heartbreak", "tears", "devastated", "realizes"], contextPolicy: { ...FULL, needsLocations: false, needsRealism: true }, minDensity: "standard" , role: "writer", stage: "write" },
  atmosphere:    { label: "Atmosphere",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/atmosphere", keywords: ["atmosphere", "mood", "ambiance", "feel of the place"], contextPolicy: BRIEF , role: "writer", stage: "write" },
  tension:       { label: "Tension",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/tension", keywords: ["tension", "suspense", "dread", "anxious", "on edge"], contextPolicy: FULL, minDensity: "standard" , role: "writer", stage: "write" },
  composition:   { label: "Composition",   modelTier: "quality", gate: "composition_layer",     qualityCheck: false, visibility: "story_and_creator", slash: "/composition", keywords: ["composition", "layer", "compose", "combine"], contextPolicy: FULL, minDensity: "full" , role: "writer", stage: "write" },
  horror:        { label: "Horror",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",         realismDomains: ["body", "injury"], slash: "/horror", keywords: ["horror", "terror", "monster", "scream", "creature", "dread"], contextPolicy: { ...FULL, needsMemories: false, needsPlotThreads: false, needsRealism: true, needsWorldEntities: true } , role: "writer", stage: "write" },
  comedy:        { label: "Comedy",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only",        slash: "/comedy", keywords: ["funny", "joke", "comedy", "humor", "laugh", "banter"], contextPolicy: { ...FULL, needsLocations: false, needsPlotThreads: false } , role: "writer", stage: "write" },
  mystery:       { label: "Mystery",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/mystery", keywords: ["mystery", "clue", "investigate", "suspect", "detective"], contextPolicy: FULL, minDensity: "standard" , role: "writer", stage: "write" },
  romance:       { label: "Romance",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/romance", keywords: ["romance", "love", "kiss", "attraction", "feelings for"], contextPolicy: { ...FULL, needsLocations: false }, minDensity: "standard" , role: "writer", stage: "write" },
  action:        { label: "Action",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator",  realismDomains: ["chase", "body"], slash: "/action", keywords: ["chase", "escape", "run", "pursuit", "race against"], contextPolicy: { ...FULL, needsMemories: false, needsPlotThreads: false, needsRealism: true, needsWorldEntities: true } , role: "writer", stage: "write" },
  monologue:     { label: "Monologue",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/monologue", keywords: ["monologue", "speech", "inner thoughts", "thinks to"], contextPolicy: { ...FULL, needsLocations: false, needsPlotThreads: false }, minDensity: "standard" , role: "writer", stage: "write" },
  voice:         { label: "Voice",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/voice", keywords: ["voice", "tone", "narration style"], contextPolicy: { ...FULL, needsLocations: false, needsMemories: false, needsPlotThreads: false }, minDensity: "standard" , role: "writer", stage: "write" },
  thriller:      { label: "Thriller",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/thriller", keywords: ["thriller", "threat", "danger", "stakes", "closing in"], contextPolicy: FULL, minDensity: "standard" , role: "writer", stage: "write" },
  sports:        { label: "Sports",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/sports", keywords: ["game", "match", "race", "competition", "score"], contextPolicy: { ...FULL, needsMemories: false, needsPlotThreads: false }, minDensity: "standard" , role: "writer", stage: "write" },
  setting:       { label: "Setting",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/setting", keywords: ["setting", "location", "place", "landscape", "room"], contextPolicy: BRIEF, minDensity: "standard" , role: "writer", stage: "write" },
  historical:    { label: "Historical",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/historical", keywords: ["historical", "period", "era", "history"], contextPolicy: { ...FULL, needsPlotThreads: false }, minDensity: "standard" , role: "writer", stage: "write" },
  scitech:       { label: "Sci/Tech",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/scitech", keywords: ["technology", "science", "futuristic", "tech", "device"], contextPolicy: BRIEF, minDensity: "standard" , role: "writer", stage: "write" },
  ethics:        { label: "Ethics",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/ethics", keywords: ["ethics", "moral", "dilemma", "right and wrong"], contextPolicy: { ...FULL, needsLocations: false }, minDensity: "standard" , role: "writer", stage: "write" },
  endings:       { label: "Endings",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/ending", keywords: ["ending", "conclude", "resolution", "finale", "final chapter"], contextPolicy: FULL, minDensity: "standard" , role: "writer", stage: "write" },
  isekai:        { label: "Isekai ⚔️",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only",        slash: "/isekai", keywords: ["isekai", "another world", "transported", "reincarnated", "summoned"], contextPolicy: FULL, minDensity: "standard" , role: "writer", stage: "write" },
  interrogation: { label: "Interrogation", modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/interrogate", keywords: ["interrogation", "questioning", "confession", "interview"], contextPolicy: { ...FULL, needsLocations: false }, minDensity: "full" , role: "writer", stage: "write" },
  chase:         { label: "Chase",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/chase", keywords: ["chase", "pursuit", "fleeing", "running from", "tailing"], contextPolicy: { ...FULL, needsMemories: false, needsPlotThreads: false }, minDensity: "full" , role: "writer", stage: "write" },
} as const satisfies Record<GenerationMode, ModeConfig>;

// Every mode produces prose except brainstorm/outline (planning modes — no
// scene to blueprint, no promises to advance, no voice to anchor). Used to
// gate the quality_stack systems, which only make sense for prose generation.
export function isProseMode(mode: string): boolean {
  return mode !== "brainstorm" && mode !== "outline";
}
