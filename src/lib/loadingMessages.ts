export const LOADING_MESSAGES: Record<string, string> = {
  horror:      "Applying Freud's unheimlich...",
  romance:     "Building attraction architecture (Fisher, 2004)...",
  combat:      "Structuring KYO/NTU exchange...",
  thriller:    "Calibrating information asymmetry...",
  mystery:     "Placing the clue you won't notice...",
  comedy:      "Testing Benign Violation threshold...",
  emotional:   "Mapping somatic markers (Damasio)...",
  atmosphere:  "Calibrating sensory density...",
  tension:     "Applying Brewer-Lichtenstein framework...",
  dialogue:    "Running Mamet's want-engine...",
  monologue:   "Accessing pre-reflective stream...",
  voice:       "Differentiating idiolect patterns...",
  action:      "Fragmenting temporal sequence...",
  sports:      "Applying kinetic chain mechanics...",
  setting:     "Activating Prospect-Refuge grammar...",
  historical:  "Layering longue durée...",
  scitech:     "Consulting Kuhn's paradigm map...",
  ethics:      "Weighing Haidt's six foundations...",
  endings:     "Applying Kermode's retroactive organizer...",
  isekai:      "Consulting the System (genre compliance check)...",
  composition: "Blending library registers...",
  brainstorm:  "Generating story seeds...",
  outline:     "Building structural architecture...",
  write:       "Generating prose...",
};

export function getLoadingMessage(mode: string): string {
  return LOADING_MESSAGES[mode] ?? "Generating...";
}
