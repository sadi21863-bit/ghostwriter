export type AgentKey =
  | "story_architect"
  | "scene_writer"
  | "character_voice"
  | "continuity_editor"
  | "hook_writer"
  | "seo_optimizer";

export const AGENT_LABELS: Record<AgentKey, string> = {
  story_architect:   "📐 Story Architect",
  scene_writer:      "✍️ Scene Writer",
  character_voice:   "🎭 Character Voice",
  continuity_editor: "🔍 Continuity Editor",
  hook_writer:       "⚡ Hook Writer",
  seo_optimizer:     "📈 SEO Optimizer",
};

export type Pipeline = {
  id: string;
  name: string;
  description: string;
  agents: AgentKey[];
  formats: string[];
  modes: string[];
};

export const PIPELINES: Pipeline[] = [
  {
    id: "full_write",
    name: "Full Write",
    description: "Architect → Write → Edit. Best for chapters.",
    agents: ["story_architect", "scene_writer", "continuity_editor"],
    formats: ["Novel", "Screenplay", "Web Series", "YouTube Long-form", "Podcast Episode"],
    modes: ["write"],
  },
  {
    id: "short_form",
    name: "Hook First",
    description: "Hook → Body. Built to stop the scroll.",
    agents: ["hook_writer", "scene_writer"],
    formats: ["YouTube Short", "TikTok Script", "Instagram Reel"],
    modes: ["write"],
  },
  {
    id: "creator_full",
    name: "Full Creator",
    description: "Hook → Body → SEO. Complete publishable piece.",
    agents: ["hook_writer", "scene_writer", "seo_optimizer"],
    formats: ["YouTube Long-form", "YouTube Short", "TikTok Script", "Instagram Reel"],
    modes: ["write"],
  },
  {
    id: "structure_only",
    name: "Structure Pass",
    description: "Tight outline before committing to prose.",
    agents: ["story_architect"],
    formats: ["Novel", "Screenplay", "Web Series", "YouTube Long-form", "Podcast Episode"],
    modes: ["outline"],
  },
  {
    id: "dialogue_pass",
    name: "Dialogue Pass",
    description: "Sharpen every character's voice.",
    agents: ["character_voice"],
    formats: ["Novel", "Screenplay", "Web Series"],
    modes: ["write"],
  },
  {
    id: "seo_pack",
    name: "SEO Pack",
    description: "Titles, description, tags, thumbnail concept.",
    agents: ["seo_optimizer"],
    formats: ["YouTube Long-form", "YouTube Short", "TikTok Script", "Instagram Reel", "Podcast Episode"],
    modes: ["brainstorm", "outline", "write"],
  },
];

export const getPipelines = (format: string, mode: string): Pipeline[] =>
  PIPELINES.filter(p => p.formats.includes(format) && p.modes.includes(mode));
