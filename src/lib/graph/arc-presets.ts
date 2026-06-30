// Story Graph Phase 4 — subgraph / arc presets.
//
// A preset packages a proven narrative structure (Three-Act, Hero's Journey,
// Save the Cat, Detective) as a reusable "subgraph": expanding it scaffolds a
// full beat sheet (StoryBeat[]) into the Director's story_plans. The visual
// "drop a subgraph node and it expands into beats" idea, as data.
import type { StoryBeat } from "@/lib/types/story";

type PresetBeat = { label: string; purpose: StoryBeat["purpose"] };

export interface ArcPreset {
  id: string;
  label: string;
  description: string;
  beats: PresetBeat[];
}

export const ARC_PRESETS: ArcPreset[] = [
  {
    id: "three_act",
    label: "Three-Act Structure",
    description: "The classic setup / confrontation / resolution spine.",
    beats: [
      { label: "Setup", purpose: "setup" },
      { label: "Inciting Incident", purpose: "turn" },
      { label: "Plot Point 1", purpose: "turn" },
      { label: "Rising Action", purpose: "rising" },
      { label: "Midpoint", purpose: "turn" },
      { label: "Plot Point 2", purpose: "turn" },
      { label: "Climax", purpose: "climax" },
      { label: "Resolution", purpose: "payoff" },
    ],
  },
  {
    id: "heros_journey",
    label: "Hero's Journey",
    description: "Campbell/Vogler's 12-stage monomyth.",
    beats: [
      { label: "Ordinary World", purpose: "setup" },
      { label: "Call to Adventure", purpose: "turn" },
      { label: "Refusal of the Call", purpose: "rising" },
      { label: "Meeting the Mentor", purpose: "rising" },
      { label: "Crossing the Threshold", purpose: "turn" },
      { label: "Tests, Allies, Enemies", purpose: "rising" },
      { label: "Approach to the Inmost Cave", purpose: "rising" },
      { label: "The Ordeal", purpose: "turn" },
      { label: "Reward", purpose: "payoff" },
      { label: "The Road Back", purpose: "transition" },
      { label: "Resurrection", purpose: "climax" },
      { label: "Return with the Elixir", purpose: "payoff" },
    ],
  },
  {
    id: "save_the_cat",
    label: "Save the Cat (condensed)",
    description: "Snyder's beat sheet, condensed to the load-bearing beats.",
    beats: [
      { label: "Opening Image", purpose: "setup" },
      { label: "Theme Stated", purpose: "setup" },
      { label: "Catalyst", purpose: "turn" },
      { label: "Break into Two", purpose: "turn" },
      { label: "Fun and Games", purpose: "rising" },
      { label: "Midpoint", purpose: "turn" },
      { label: "Bad Guys Close In", purpose: "rising" },
      { label: "All Is Lost", purpose: "turn" },
      { label: "Break into Three", purpose: "turn" },
      { label: "Finale", purpose: "climax" },
      { label: "Final Image", purpose: "payoff" },
    ],
  },
  {
    id: "detective",
    label: "Detective / Mystery",
    description: "Crime → investigation → reveal, with a red herring.",
    beats: [
      { label: "The Crime", purpose: "setup" },
      { label: "Investigation Begins", purpose: "rising" },
      { label: "First Clue", purpose: "rising" },
      { label: "Red Herring", purpose: "turn" },
      { label: "Complication", purpose: "rising" },
      { label: "Breakthrough", purpose: "turn" },
      { label: "Confrontation", purpose: "climax" },
      { label: "The Reveal", purpose: "payoff" },
    ],
  },
];

export function getArcPreset(id: string): ArcPreset | undefined {
  return ARC_PRESETS.find(p => p.id === id);
}

/**
 * Expand a preset into a ready-to-save beat sheet. `idFor` lets the caller inject
 * id generation (crypto.randomUUID in prod, a counter in tests) so the result is
 * deterministic when needed. Returns [] for an unknown preset.
 */
export function expandArcPreset(id: string, idFor: (i: number) => string = () => crypto.randomUUID()): StoryBeat[] {
  const preset = getArcPreset(id);
  if (!preset) return [];
  return preset.beats.map((b, i) => ({
    id: idFor(i),
    order: i,
    label: b.label,
    summary: "",
    purpose: b.purpose,
    characterIds: [],
    threadIds: [],
  }));
}
