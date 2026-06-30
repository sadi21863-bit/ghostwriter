// AI Initiative — how aggressively the AI acts on its own. A per-project setting
// (projects.aiInitiative) that until now was read via scattered `?? "Collaborates"`
// string checks. This is the single resolver for that behaviour so the auto-fire
// logic, the GuideBar visibility, and the stage-header chip all agree.

export type AIInitiative = "Leads" | "Collaborates" | "Assists";
export const AI_INITIATIVES: AIInitiative[] = ["Leads", "Collaborates", "Assists"];

export interface InitiativeBehavior {
  mode: AIInitiative;
  /** Short chip label. */
  label: string;
  /** One-line explanation for tooltips/menus. */
  description: string;
  /** Leads auto-fires generate() shortly after a guide suggestion. */
  autoFires: boolean;
  /** Assists hides the proactive GuideBar entirely. */
  hidesGuide: boolean;
}

const BEHAVIORS: Record<AIInitiative, Omit<InitiativeBehavior, "mode">> = {
  Leads: {
    label: "AI Leads",
    description: "The AI drafts the next suggested action automatically.",
    autoFires: true,
    hidesGuide: false,
  },
  Collaborates: {
    label: "AI Collaborates",
    description: "The AI suggests the next step; you trigger it.",
    autoFires: false,
    hidesGuide: false,
  },
  Assists: {
    label: "AI Assists",
    description: "The AI stays out of the way until you ask.",
    autoFires: false,
    hidesGuide: true,
  },
};

/** Normalise any stored value (incl. null/garbage) to a behaviour. Default: Collaborates. */
export function resolveInitiative(value: string | null | undefined): InitiativeBehavior {
  const mode: AIInitiative = value === "Leads" || value === "Assists" ? value : "Collaborates";
  return { mode, ...BEHAVIORS[mode] };
}
