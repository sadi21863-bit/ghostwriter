// src/lib/modes/registry.ts
import type { FeatureGate } from "@/types/subscription";
import type { RealismDomain } from "@/lib/realism";

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
}

export const MODE_REGISTRY = {
  brainstorm:    { label: "Brainstorm",    modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal",         slash: "/brainstorm",  keywords: ["brainstorm", "ideas", "what if", "possibilities", "options"] },
  outline:       { label: "Outline",       modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal",         slash: "/outline",     keywords: ["outline", "structure", "beats", "plan", "plot out"] },
  write:         { label: "Write",         modelTier: "default", gate: null,                   qualityCheck: true,  visibility: "universal",         slash: "/write",       keywords: ["write", "continue", "draft", "next scene"] },
  dialogue:      { label: "Dialogue",      modelTier: "default", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",        slash: "/dialogue",    keywords: ["dialogue", "conversation", "argument", "talk", "said", "asked"] },
  combat:        { label: "Combat",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",         realismDomains: ["combat", "body", "injury"], slash: "/fight", keywords: ["fight", "battle", "combat", "attack", "punch", "sword", "gun", "strike"] },
  emotional:     { label: "Emotional",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator",  realismDomains: ["body"], slash: "/emotion", keywords: ["cry", "grief", "heartbreak", "tears", "devastated", "realizes"] },
  atmosphere:    { label: "Atmosphere",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/atmosphere", keywords: ["atmosphere", "mood", "ambiance", "feel of the place"] },
  tension:       { label: "Tension",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/tension", keywords: ["tension", "suspense", "dread", "anxious", "on edge"] },
  composition:   { label: "Composition",   modelTier: "quality", gate: "composition_layer",     qualityCheck: false, visibility: "story_and_creator", slash: "/composition", keywords: ["composition", "layer", "compose", "combine"] },
  horror:        { label: "Horror",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",         realismDomains: ["body", "injury"], slash: "/horror", keywords: ["horror", "terror", "monster", "scream", "creature", "dread"] },
  comedy:        { label: "Comedy",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only",        slash: "/comedy", keywords: ["funny", "joke", "comedy", "humor", "laugh", "banter"] },
  mystery:       { label: "Mystery",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/mystery", keywords: ["mystery", "clue", "investigate", "suspect", "detective"] },
  romance:       { label: "Romance",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/romance", keywords: ["romance", "love", "kiss", "attraction", "feelings for"] },
  action:        { label: "Action",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator",  realismDomains: ["chase", "body"], slash: "/action", keywords: ["chase", "escape", "run", "pursuit", "race against"] },
  monologue:     { label: "Monologue",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/monologue", keywords: ["monologue", "speech", "inner thoughts", "thinks to"] },
  voice:         { label: "Voice",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/voice", keywords: ["voice", "tone", "narration style"] },
  thriller:      { label: "Thriller",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/thriller", keywords: ["thriller", "threat", "danger", "stakes", "closing in"] },
  sports:        { label: "Sports",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/sports", keywords: ["game", "match", "race", "competition", "score"] },
  setting:       { label: "Setting",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/setting", keywords: ["setting", "location", "place", "landscape", "room"] },
  historical:    { label: "Historical",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/historical", keywords: ["historical", "period", "era", "history"] },
  scitech:       { label: "Sci/Tech",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/scitech", keywords: ["technology", "science", "futuristic", "tech", "device"] },
  ethics:        { label: "Ethics",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/ethics", keywords: ["ethics", "moral", "dilemma", "right and wrong"] },
  endings:       { label: "Endings",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/ending", keywords: ["ending", "conclude", "resolution", "finale", "final chapter"] },
  isekai:        { label: "Isekai ⚔️",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only",        slash: "/isekai", keywords: ["isekai", "another world", "transported", "reincarnated", "summoned"] },
  interrogation: { label: "Interrogation", modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/interrogate", keywords: ["interrogation", "questioning", "confession", "interview"] },
  chase:         { label: "Chase",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/chase", keywords: ["chase", "pursuit", "fleeing", "running from", "tailing"] },
} as const satisfies Record<GenerationMode, ModeConfig>;
