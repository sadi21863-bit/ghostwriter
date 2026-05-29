import type { Project, Character, Location, PlotThread, Chapter, ReferenceWork } from "@/types";

export interface StoryMemory {
  id: string;
  category: string;
  fact: string;
  chapterIndex?: number;
}

export interface CreatorBible {
  channelName?: string;
  niche?: string;
  audienceAge?: string;
  audienceInterests?: string;
  audiencePainPoints?: string;
  channelVoice?: string;
  contentPillars?: string[];
  defaultCta?: string;
}

export interface ContextProject extends Project {
  storyMemories?: StoryMemory[];
  activeChapter?: string;
  creatorBible?: CreatorBible;
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  character_decision:    3,
  relationship:          3,
  world_rule:            2,
  event:                 2,
  general:               1,
  previous_position:     3,
  recurring_segment:     2,
  running_joke:          2,
  established_reference: 2,
};

function scoredMemories(
  memories: StoryMemory[],
  chapters: Chapter[],
  activeChapterId: string
): StoryMemory[] {
  const activeIdx = chapters?.findIndex((c) => c.id === activeChapterId) ?? 0;
  const scored = memories.map((m) => {
    const categoryScore = CATEGORY_WEIGHTS[m.category] ?? 1;
    const recencyScore  = Math.max(0, 5 - (activeIdx - (m.chapterIndex ?? 0)));
    return { ...m, _score: categoryScore + recencyScore };
  });
  return (scored as Array<StoryMemory & { _score: number }>)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);
}

export function buildContext(p: ContextProject): string {
  const r: string[] = [];
  r.push("PROJECT: " + p.name + " | " + p.format + " | " + (p.genres || []).join(", "));

  if (p.referenceWorks?.length) {
    r.push("STYLE REFERENCES:");
    p.referenceWorks.forEach((w: ReferenceWork) => {
      r.push('- "' + w.title + '"');
      Object.entries(w.attributes || {}).filter(([, v]) => v).forEach(([k, v]) => r.push("  " + k + ": " + v));
    });
    const attrs = p.referenceWorks.flatMap((w: ReferenceWork) =>
      Object.entries(w.attributes || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
    );
    if (attrs.length > 0) {
      r.push("\nSTYLE DIRECTIVE — FOLLOW THESE IN EVERY SENTENCE:");
      attrs.forEach((a) => r.push("• " + a));
    }
  }

  if (p.characters?.length) {
    r.push("CHARACTERS:");
    p.characters.forEach((c: Character) => {
      if (c.alwaysInContext === false) {
        r.push("- " + c.name + (c.role ? " (" + c.role + ", minor)" : " (minor)"));
        return;
      }
      const parts = ["- " + c.name + (c.role ? " (" + c.role + ")" : "") + (c.age ? ", age " + c.age : "")];
      if (c.appearance)    parts.push("  Appearance: " + c.appearance);
      if ((c as any).voiceProfile) parts.push("  Voice profile (Labov/Mairesse): " + (c as any).voiceProfile);
      if (c.personality)   parts.push("  Personality: " + c.personality);
      if (c.thinkingStyle) parts.push("  Thinking: " + c.thinkingStyle);
      if (c.behavior)      parts.push("  Behavior: " + c.behavior);
      if (c.habits)        parts.push("  Habits: " + c.habits);
      if (c.speechPattern) parts.push("  Speech: " + c.speechPattern);
      if (c.fears)         parts.push("  Fears: " + c.fears);
      if (c.desires)       parts.push("  Desires: " + c.desires);
      if (c.arc)           parts.push("  Arc: " + c.arc);
      if (c.backstory)     parts.push("  Backstory: " + c.backstory);
      if (c.linkedLocationIds?.length) {
        const linked = p.locations?.filter((l: Location) => c.linkedLocationIds.includes(l.id));
        if (linked?.length) parts.push("  Frequent locations: " + linked.map((l: Location) => l.name).join(", "));
      }
      if (c.linkedPlotThreadIds?.length) {
        const linked = p.plotThreads?.filter((t: PlotThread) => c.linkedPlotThreadIds.includes(t.id));
        if (linked?.length) parts.push("  Involved in: " + linked.map((t: PlotThread) => t.name).join(", "));
      }
      // Structural function injection
      const fnMap: Record<string, string> = {
        Mirror:    "Narrative function: Mirror. Reflects the protagonist's values back — validating or distorting. Reveal the protagonist through this character's reaction to them.",
        Foil:      "Narrative function: Foil. Shares the protagonist's context but makes the opposite choices. Show the path not taken.",
        Mentor:    "Narrative function: Mentor/Threshold Guardian. Grants access to new capability or world. Opens a threshold, then steps back.",
        Herald:    "Narrative function: Herald. Announces change and disrupts the status quo.",
        Trickster: "Narrative function: Trickster. Destabilises assumptions. Introduces instability in every scene they appear in.",
        Shadow:    "Narrative function: Shadow. Embodies what the protagonist fears becoming. They are the warning.",
        Catalyst:  "Narrative function: Catalyst. Transforms everyone around them. Has no arc of their own.",
      };
      if ((c as any).structuralFunction && fnMap[(c as any).structuralFunction]) {
        parts.push("  " + fnMap[(c as any).structuralFunction]);
      }
      // Voice profile injection
      const reg: Record<string, string> = { Formal: "formal register, full sentences", Casual: "casual register, contractions, colloquial", Regional: "regional dialect markers", Institutional: "profession-specific register", Hybrid: "code-switches between registers" };
      const comp: Record<string, string> = { Verbose: "speaks at length, elaborates, qualifies", Balanced: "standard sentence length", Terse: "short responses, minimal elaboration", Fragments: "speaks in fragments and incomplete sentences" };
      const tic: Record<string, string> = { "Deflects-with-humor": "deflects emotional content with humor", "Asks-instead-of-asserts": "asks questions rather than making direct statements", "Profession-metaphors": "draws analogies from their professional domain", "Qualifies-everything": "prefaces assertions with hedges and qualifications" };
      const vParts: string[] = [];
      if ((c as any).voiceRegister    && reg[(c as any).voiceRegister])    vParts.push(reg[(c as any).voiceRegister]);
      if ((c as any).voiceCompression && comp[(c as any).voiceCompression]) vParts.push(comp[(c as any).voiceCompression]);
      if ((c as any).verbalTic && (c as any).verbalTic !== "None" && tic[(c as any).verbalTic]) vParts.push(tic[(c as any).verbalTic]);
      if (vParts.length) parts.push("  Voice: " + vParts.join(", "));
      // Antagonist profile injection
      if ((c as any).antagonistToggle) {
        const typeMap: Record<string, string> = {
          Narcissist:    "ANTAGONIST PROFILE (Narcissist): This character genuinely believes in their own special status — not as performance but as fact. The small slight receives a disproportionate response. They need to be witnessed in their excellence. When challenged: contempt, not defensiveness. They are the protagonist of a story in which everyone else is an obstacle. Write them as internally coherent, not as a cartoon villain.",
          Machiavellian: "ANTAGONIST PROFILE (Machiavellian): This character regards strategic manipulation as competent social navigation, not moral failing. They are charming, patient, and genuinely helpful to people who serve their long-term interests. Every favour has an implicit account being run. They plan 10 moves ahead. Their sincerity is real while useful — and ends precisely when it stops being useful.",
          Psychopath:    "ANTAGONIST PROFILE (Psychopath): This character's primary characteristic is impulsivity combined with absent fear of consequences — not high intelligence. They do things that shock other characters because the ordinary brakes (social reproach, self-reproach, fear of punishment) do not apply. Their calm in genuinely dangerous situations is distinctive. They are not strategic — they are unrestrained.",
          Ideological:   "ANTAGONIST PROFILE (Ideological): This character believes the harm they cause is justified — even necessary — by a larger good. Their self-justification is internally coherent and, in isolation, the goal they pursue is comprehensible. Write them as someone who is right about some things and wrong in ways they cannot see.",
          Systemic:      "ANTAGONIST PROFILE (Systemic): There is no single face to this antagonist. The institution, the norm, the accumulated decisions of ordinary people — this is what the protagonist is fighting. Write the system through its effects on individuals rather than through a representative villain.",
        };
        const type = (c as any).antagonistType;
        if (type && typeMap[type]) parts.push("  " + typeMap[type]);
        parts.push("  VILLAIN PERSPECTIVE RULE: In any scene from this character's POV, the protagonist must appear as an obstacle to a comprehensible goal — not as the hero and this character as villain. The antagonist does not experience themselves as the antagonist.");
      }
      r.push(parts.join("\n"));
    });
  }

  if (p.locations?.length) {
    r.push("LOCATIONS:");
    p.locations.forEach((l: Location) => {
      if (l.alwaysInContext === false) {
        r.push("- " + l.name + " (minor location)");
        return;
      }
      const parts = ["- " + l.name + (l.description ? ": " + l.description : "")];
      if (l.atmosphere)     parts.push("  Atmosphere: " + l.atmosphere);
      if (l.history)        parts.push("  History: " + l.history);
      if (l.sensoryDetails) parts.push("  Sensory: " + l.sensoryDetails);
      r.push(parts.join("\n"));
    });
  }

  if (p.plotThreads?.length) {
    r.push("PLOTS:");
    p.plotThreads.forEach((t: PlotThread) => {
      if (t.alwaysInContext === false) {
        r.push("- [" + (t.status || "Active") + "] " + t.name + " (minor thread)");
        return;
      }
      const parts = ["- [" + t.status + "] " + t.name + (t.description ? ": " + t.description : "")];
      if (t.stakes)      parts.push("  Stakes: " + t.stakes);
      if (t.connections) parts.push("  Connections: " + t.connections);
      r.push(parts.join("\n"));
    });
  }

  if (p.storyMemories?.length) {
    const salient = scoredMemories(p.storyMemories, p.chapters ?? [], p.activeChapter ?? "");
    r.push("ESTABLISHED FACTS (do not contradict these):");
    salient.forEach((m) => r.push(`- [${m.category}] ${m.fact}`));
  }

  return r.join("\n");
}

export function buildCreatorContext(p: ContextProject): string {
  const r: string[] = [];
  r.push(`PROJECT: ${p.name} | ${p.format} | ${(p.genres || []).join(", ")}`);

  const cb = p.creatorBible;
  if (cb) {
    r.push("CHANNEL BIBLE:");
    if (cb.channelName)        r.push(`Channel: ${cb.channelName}`);
    if (cb.niche)              r.push(`Niche: ${cb.niche}`);
    if (cb.audienceAge)        r.push(`Audience age: ${cb.audienceAge}`);
    if (cb.audienceInterests)  r.push(`Audience interests: ${cb.audienceInterests}`);
    if (cb.audiencePainPoints) r.push(`Pain points: ${cb.audiencePainPoints}`);
    if (cb.channelVoice)       r.push(`Voice & tone: ${cb.channelVoice}`);
    if (cb.contentPillars?.length) r.push(`Pillars: ${cb.contentPillars.join(", ")}`);
    if (cb.defaultCta)         r.push(`Default CTA: ${cb.defaultCta}`);
  }

  if (p.referenceWorks?.length) {
    r.push("STYLE REFERENCES:");
    p.referenceWorks.forEach((w: ReferenceWork) => {
      r.push(`- "${w.title}"`);
      Object.entries(w.attributes || {}).filter(([, v]) => v).forEach(([k, v]) => r.push(`  ${k}: ${v}`));
    });
    const attrs = p.referenceWorks.flatMap((w: ReferenceWork) =>
      Object.entries(w.attributes || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
    );
    if (attrs.length > 0) {
      r.push("\nSTYLE DIRECTIVE — FOLLOW THESE IN EVERY SENTENCE:");
      attrs.forEach((a) => r.push("• " + a));
    }
  }

  if (p.storyMemories?.length) {
    const salient = scoredMemories(p.storyMemories, p.chapters ?? [], p.activeChapter ?? "");
    r.push("ESTABLISHED FACTS (do not contradict these):");
    salient.forEach((m) => r.push(`- [${m.category}] ${m.fact}`));
  }

  return r.join("\n");
}

export function buildBeginnerContext(p: ContextProject): string {
  const r: string[] = [];
  r.push("PROJECT: " + p.name + " | " + p.format + " | " + (p.genres || []).join(", "));

  if (p.characters?.length) {
    r.push("\nMAIN CHARACTERS:");
    p.characters.slice(0, 5).forEach((c: Character) => {
      const parts = [c.name + (c.role ? " (" + c.role + ")" : "")];
      if (c.appearance)  parts.push(c.appearance);
      if (c.personality) parts.push(c.personality);
      if (c.arc)         parts.push("Arc: " + c.arc);
      r.push("- " + parts.join(" · "));
    });
  }

  if (p.locations?.length) {
    r.push("\nKEY LOCATIONS:");
    p.locations.slice(0, 3).forEach((l: Location) => {
      r.push("- " + l.name + (l.description ? ": " + l.description : ""));
    });
  }

  if (p.plotThreads?.length) {
    r.push("\nMAIN PLOT:");
    p.plotThreads.slice(0, 2).forEach((t: PlotThread) => {
      r.push("- " + t.name + (t.description ? ": " + t.description : ""));
    });
  }

  if (p.storyMemories?.length) {
    r.push("\nESTABLISHED FACTS (do not contradict):");
    p.storyMemories.slice(0, 8).forEach((m) => r.push("- " + m.fact));
  }

  return r.join("\n");
}
