import type { Project, Character, Location, PlotThread, Chapter, ReferenceWork, WorkPattern } from "@/types";
import { ARC_POSITION_DIRECTIVES } from "@/lib/arc";
import { buildInfluenceContext } from "@/lib/ai/influence-context";
import { buildAccuracyContext, detectAccuracyDomains } from "@/lib/accuracy";
import { buildRealismContext, getRealismDomainsForMode } from "@/lib/realism";
import { extractVoiceFingerprint, fingerprintToConstraints } from "@/lib/ai/voice-fingerprint";

export interface CharacterRelationship {
  characterAId: string;
  characterBId: string;
  trustLevel: number;
  relationshipType: string;
  fourHorsemen: { criticism: number; contempt: number; defensiveness: number; stonewalling: number };
  notes: string;
  powerDifferential?: number;
  emotionalRegister?: string;
  knowledgeAsymmetry?: string;
  dependencyStructure?: string;
  attachmentStyleA?: string;
  arcTrajectory?: string;
}

export interface StoryMemory {
  id: string;
  category: string;
  fact: string;
  chapterIndex?: number;
  structuredData?: {
    chapterTitle?: string;
    arcPosition?: string;
    charactersPresent?: string[];
    keyEvents?: string[];
    objectsIntroduced?: string[];
    knowledgeShifts?: { character: string; learned: string; from: string; to: string }[];
    decisionsAndConsequences?: string[];
    emotionalStateEnd?: Record<string, string>;
    openPromisesCreated?: string[];
    openPromisesResolved?: string[];
  } | null;
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
  characterRelationships?: CharacterRelationship[];
  storyPromises?: any[];
  activeInfluence?: any;
  activePatterns?: WorkPattern[];
  activeMode?: string;
  currentPrompt?: string;
  activeRealismDomains?: string[];
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

const NARRATIVE_STRUCTURE_DIRECTIVES: Record<string, string> = {
  'frame': `FRAME NARRATIVE: This story has an outer narrator and an inner story. These are two distinct voices with a specific temporal and emotional relationship. The outer narrator has survived the inner story — they know how it ends. Their intrusions, hesitations, selections, and omissions are meaningful. What they choose to tell and when reveals something about their present situation they cannot say directly.`,
  'stories-within-stories': `NARRATIVE RECURSION (Mahabharata structure): This story contains stories within stories. The outer narrative and inner narratives are not decoration for each other — each inner story is chosen because it illuminates something about the outer narrative's situation that cannot be said directly. The selection of which inner story to tell, and the timing of its telling, is itself a narrative act. Write the frame and the inner stories as voices with different temporal relationships to the events. The meaning of the inner story changes depending on where in the outer frame it appears.`,
  'multi-timeline': `MULTI-TIMELINE STRUCTURE: Parallel narrative threads that are thematically linked but temporally separate. Each timeline illuminates the others. What is mystery in one timeline becomes context in another. Write each timeline with its own voice and rhythm — they should feel like the same story told at different speeds or from different altitudes. The resonances between them are the meaning.`,
  'epistolary': `EPISTOLARY STRUCTURE: This story emerges from accumulated documents — letters, diary entries, transcripts, records. Each document has a specific writer, a specific intended reader, and a specific context that shapes what is said and what is omitted. The gap between what each writer believes and what the reader can see from the accumulated record is where the story lives. Write each document as an act of communication, not as narration.`,
};

const GENRE_CONTRACTS: Partial<Record<string, string>> = {
  'Horror': 'OPENING PROMISE (Horror): This is your first chapter. Establish the world as it should be — then crack it. Something must be wrong before this chapter ends. Not stated: felt. The character\'s body registers the wrongness before their mind does. Plant the specific unease that the rest of the story will make literal.',
  'Romance': 'OPENING PROMISE (Romance): This is your first chapter. The protagonist is incomplete in a specific way that another person could fill — but show the absence, not the longing. Plant the emotional vacancy before introducing what could fill it. The reader must feel what is missing before they see who might provide it.',
  'Mystery': 'OPENING PROMISE (Mystery): This is your first chapter. Create one question the reader cannot stop themselves from needing answered. The mystery does not have to be named — it must be felt. Plant a specific detail that will be significant later. Do not signal it.',
  'Thriller': 'OPENING PROMISE (Thriller): This is your first chapter. Establish what the protagonist has to lose before any threat arrives. The threat only matters relative to what can be destroyed. Show us the thing they love before you endanger it.',
  'Fantasy': 'OPENING PROMISE (Fantasy): This is your first chapter. Establish one rule of this world through action, not exposition. The reader should understand something about how this world works by what happens — not by what is explained.',
  'Sci-Fi': 'OPENING PROMISE (Sci-Fi): This is your first chapter. Anchor the extraordinary in the specific ordinary. The technology or science must be felt through a human problem, not introduced as information.',
  'Literary Fiction': 'OPENING PROMISE (Literary Fiction): This is your first chapter. The theme of this story should be gestured toward obliquely — through image, action, or a specific detail that will resonate differently when the reader reaches the end. Do not state the theme. Embody it.',
  'Drama': 'OPENING PROMISE (Drama): This is your first chapter. Establish the specific tension in the protagonist\'s world — not the external conflict but the internal one they\'ve been living with. Something has been wrong for a long time. This chapter is where it becomes impossible to ignore.',
};

export function buildStaticContext(p: ContextProject): string {
  const r: string[] = [];

  // ── ACTIVE INFLUENCE ───────────────────────────────────────────────────────
  if (p.activeInfluence) {
    const influenceCtx = buildInfluenceContext(p.activeInfluence, p.activeMode ?? 'write', (p as any).format);
    if (influenceCtx) r.push(influenceCtx);
  }

  // ── ACTIVE WORK PATTERNS ───────────────────────────────────────────────────
  const patterns: WorkPattern[] = p.activePatterns ?? [];
  if (patterns.length > 0) {
    r.push('ACTIVE NARRATIVE PATTERNS (apply these structural techniques):');
    for (const pat of patterns) {
      r.push(`• ${pat.name}: ${pat.generationDirective}`);
    }
  }

  // AI Project Rules — injected first, highest priority
  const rules: any[] = (p as any).aiRules ?? [];
  if (rules.length > 0) {
    r.push('PROJECT WRITING RULES — THESE OVERRIDE ALL DEFAULTS. DO NOT VIOLATE THEM.');
    rules.forEach((rule: any, i: number) => r.push(`${i + 1}. ${rule.text}`));
    r.push('');
  }

  if ((p as any).isHiggsfieldProject) {
    r.push(
      'HIGGSFIELD ORIGINAL SERIES MODE: This project will be adapted into a visual series.',
      'Write with visual storytelling in mind: clear action beats, concrete spatial relationships,',
      'dialogue that drives scene transitions, character physicality that translates to shot descriptions.',
      'Each scene should have a clear visual identity — where we are, who is doing what, what changes.',
    );
  }

  // ── CONTROLLING IDEA ──────────────────────────────────────────────────────
  if ((p as any).controllingIdea?.trim()) {
    r.push(`CONTROLLING IDEA: This story argues — "${(p as any).controllingIdea}"`);
    r.push('Every scene either advances this argument or deliberately complicates it before the resolution. Write consistent with this thematic spine. Do not resolve what the story intends to keep open. The antagonist challenges this argument — they should be right about parts of it.');
    r.push('');
  }

  // ── NARRATOR VOICE ────────────────────────────────────────────────────────
  if ((p as any).narratorVoice?.trim()) {
    r.push(`NARRATOR VOICE: ${(p as any).narratorVoice}`);
    r.push('Apply this lens to every sentence: what the narrator notices, what they find significant, what they refuse to sentimentalize, what they cannot help lingering on. This is not style — it is worldview. It should be present even in action scenes.');
    r.push('');
  }

  // ── NARRATIVE STRUCTURE ───────────────────────────────────────────────────
  const structure = (p as any).narrativeStructure;
  if (structure && structure !== 'linear' && NARRATIVE_STRUCTURE_DIRECTIVES[structure]) {
    r.push(NARRATIVE_STRUCTURE_DIRECTIVES[structure]);
    r.push('');
  }

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

  // ── VOICE FINGERPRINT ─────────────────────────────────────────────────────
  // Constraint-based voice preservation (Berkeley 2026): prompt instructions drift,
  // numerical constraints measured from the writer's own prose don't.
  if (p.chapters && p.chapters.length >= 3) {
    const recentChapterContents = p.chapters
      .filter((c: any) => c.content && c.content.trim().length > 200)
      .slice(-5)
      .map((c: any) => c.content as string);
    const fingerprint = extractVoiceFingerprint(recentChapterContents);
    if (fingerprint) {
      r.push('\n' + fingerprintToConstraints(fingerprint));
      r.push('');
    }
  }

  if (p.characters?.length) {
    r.push("CHARACTERS:");
    const activeIdx = p.chapters?.findIndex((ch: any) => ch.id === p.activeChapter) ?? 0;
    const searchText = (
      ((p as any).activeChapterContent ?? '') +
      ((p as any).currentPrompt ?? '')
    ).toLowerCase();

    p.characters.forEach((c: Character) => {
      // Character visibility filter (F2): always / mentioned / never
      const visibility = (c as any).contextVisibility ?? 'always';
      if (visibility === 'never') return;
      if (visibility === 'mentioned') {
        if (!searchText.includes(c.name.toLowerCase())) {
          r.push("- " + c.name + (c.role ? " (" + c.role + ", not in scene)" : " (not in scene)"));
          return;
        }
      }

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
      if (c.arc)           parts.push("  Arc: " + c.arc);

      // ── BACKSTORY AS BEHAVIOR ──────────────────────────────────────────────
      if (c.backstory) {
        parts.push(`  BACKSTORY (do not state — embody): ${c.backstory}`);
        parts.push('  This is not information to be explained — it is the sediment that produces behavior. Show it through reflex, avoidance, the things this character does automatically without knowing why. The reader must sense the history, never be told it.');
      }

      // ── WANT / NEED STRUCTURAL ENGINE ─────────────────────────────────────
      if ((c as any).characterWant && (c as any).characterNeed) {
        parts.push(`  WANT: ${(c as any).characterWant} — this is what they actively pursue. Every scene, they are moving toward this, even obliquely.`);
        parts.push(`  NEED: ${(c as any).characterNeed} — this is the truth they resist. The story is the collision between want and need. They cannot get what they want without confronting what they need.`);
      } else {
        if (c.fears)   parts.push(`  Fears: ${c.fears}`);
        if (c.desires) parts.push(`  Desires: ${c.desires}`);
      }

      // ── CORE CONTRADICTION ────────────────────────────────────────────────
      if ((c as any).contradiction?.trim()) {
        parts.push(`  DEFINING CONTRADICTION: ${(c as any).contradiction}`);
        parts.push('  Write behavior that expresses both sides of this tension — never resolving it cleanly. This contradiction is not a flaw to be overcome. It is what makes this character human.');
      }

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
      // ── NVC CARD INJECTION ──────────────────────────────────────────────────
      if ((c as any).kinesicsBaseline || (c as any).kinesicsIdiosyncrasy) {
        const nvcParts: string[] = ["NVC DIRECTIVES:"];
        if ((c as any).kinesicsBaseline) {
          nvcParts.push(`Kinesics baseline: ${(c as any).kinesicsBaseline}`);
          nvcParts.push("Generate behavior and physical leakage from this baseline, NOT emotion labels.");
          nvcParts.push("When writing scenes with this character: their body communicates simultaneously with their words.");
        }
        if ((c as any).kinesicsMicro) {
          nvcParts.push(`Microexpression map: ${(c as any).kinesicsMicro}`);
          nvcParts.push("Deploy microexpressions sparingly (1-2 per scene max) only when actively concealing.");
        }
        if ((c as any).kinesicsIdiosyncrasy) {
          nvcParts.push(`Signature physical habit: ${(c as any).kinesicsIdiosyncrasy}`);
          nvcParts.push("This habit is their physical fingerprint — readers will recognize it.");
        }
        if ((c as any).proxemicsCulture) {
          const zoneRules: Record<string, string> = {
            "contact": "Contact culture — comfortable at 30-50cm conversational distance, touch during conversation normal.",
            "non-contact": "Non-contact culture — comfortable at 60-90cm, minimal touch, closer proximity feels intrusive.",
            "mixed": "Mixed cultural proxemics — shifts by context.",
          };
          nvcParts.push(`Proxemics: ${zoneRules[(c as any).proxemicsCulture] || (c as any).proxemicsCulture}`);
        }
        if ((c as any).proxemicsViolationResponse) nvcParts.push(`When intimate zone is breached without consent: ${(c as any).proxemicsViolationResponse}`);
        if ((c as any).paralanguageBaseline) {
          nvcParts.push(`Voice baseline: ${(c as any).paralanguageBaseline}`);
          nvcParts.push("Any significant deviation from this baseline signals psychological state change — write the deviation, not the explanation.");
        }
        if ((c as any).paralanguageStressDegradation) nvcParts.push(`Under stress their voice: ${(c as any).paralanguageStressDegradation}`);
        if ((c as any).paralanguageSignatureSound) nvcParts.push(`Signature vocal marker: ${(c as any).paralanguageSignatureSound}`);
        if ((c as any).hapticsTouchLevel) {
          const hapticMap: Record<string, string> = {
            "averse": "Touch-averse — any uninvited contact is a violation; their body registers it before their mind.",
            "reserved": "Touch-reserved — functional touch accepted, warmth-touch requires established trust.",
            "normal": "Normal haptic range — follows cultural and relational norms.",
            "initiating": "Touch-initiating — uses touch to connect, comfort, and manage social dynamics.",
          };
          nvcParts.push(hapticMap[(c as any).hapticsTouchLevel] || (c as any).hapticsTouchLevel);
        }
        if ((c as any).chronemicsTimeType) {
          const timeMap: Record<string, string> = {
            "monochronic": "Monochronic time — one thing at a time, punctuality carries moral weight, waiting is disrespect.",
            "polychronic": "Polychronic time — time is relational and flexible, concurrent conversations natural, appointments are guidelines.",
          };
          nvcParts.push(timeMap[(c as any).chronemicsTimeType] || (c as any).chronemicsTimeType);
        }
        if ((c as any).oculesicsDefault) {
          const eyeMap: Record<string, string> = {
            "avoidant": "Default eye contact: avoidant — signals respect or processing, not deception (in their cultural context).",
            "normal": "Default eye contact: normal conversational range (3-second Western norm).",
            "sustained": "Default eye contact: sustained — reads as confidence, intensity, or challenge depending on context.",
            "intense": "Default eye contact: intense, rarely blinks in high-focus states.",
          };
          nvcParts.push(eyeMap[(c as any).oculesicsDefault] || (c as any).oculesicsDefault);
        }
        if ((c as any).oculesicsDeception) nvcParts.push(`When hiding something, their eyes: ${(c as any).oculesicsDeception}`);
        if ((c as any).objecticsSignature) nvcParts.push(`Signature object: ${(c as any).objecticsSignature} — losing it is an identity event.`);
        if ((c as any).appearanceSignature) nvcParts.push(`Appearance signature: ${(c as any).appearanceSignature} — always present or always noticed.`);
        if ((c as any).appearanceTrajectory) {
          nvcParts.push(`Grooming/appearance trajectory: ${(c as any).appearanceTrajectory}`);
          if ((c as any).appearanceTrajectory === "deteriorating") nvcParts.push("Deteriorating appearance signals psychological breakdown — write the specific changes, not the label.");
        }
        parts.push("  " + nvcParts.join(" "));
      }

      // ── LANGUAGE PROFILE INJECTION ───────────────────────────────────────────
      if ((c as any).nativeLanguage || (c as any).accentProfile || (c as any).registerDefault || (c as any).idiolectFingerprint) {
        const lParts: string[] = ["LANGUAGE DIRECTIVES:"];
        if ((c as any).nativeLanguage) {
          lParts.push(`Native language: ${(c as any).nativeLanguage}.`);
          if ((c as any).acquiredLanguages) lParts.push(`Also speaks: ${(c as any).acquiredLanguages}.`);
          if ((c as any).dominantLanguageContext) lParts.push(`Default by context: ${(c as any).dominantLanguageContext}.`);
        }
        if ((c as any).accentProfile) {
          lParts.push(`Accent/dialect: ${(c as any).accentProfile}.`);
          lParts.push("NEVER use phonetic spelling to convey accent. Use: syntax inversion, specific vocabulary markers, sentence rhythm, or observational filtering through the POV character.");
        }
        if ((c as any).reversionTrigger) lParts.push(`Reversion trigger: ${(c as any).reversionTrigger} — this is when native dialect/accent surfaces despite suppression.`);
        if ((c as any).registerDefault) {
          const regMap: Record<string, string> = {
            "frozen": "Register default: frozen/ceremonial — speaks in fixed forms, ritualized language.",
            "formal": "Register default: formal — full grammar, no contractions, precise vocabulary always.",
            "consultative": "Register default: consultative — professional warmth, polite hedging.",
            "casual": "Register default: casual — contractions, shared references, incomplete sentences with trusted people.",
            "intimate": "Register default: intimate — private codes, unfinished thoughts, non-verbal completion.",
          };
          lParts.push(regMap[(c as any).registerDefault] || `Register default: ${(c as any).registerDefault}`);
          if ((c as any).registerRange === "narrow") lParts.push("Narrow register range — uses nearly the same register regardless of context. This signals emotional distance or social anxiety.");
        }
        if ((c as any).codeSwitchingTriggers) lParts.push(`Code-switching triggers: ${(c as any).codeSwitchingTriggers}`);
        if ((c as any).idiolectFingerprint) {
          lParts.push(`VOICE FINGERPRINT: ${(c as any).idiolectFingerprint}`);
          lParts.push("Apply this voice consistently in ALL dialogue and interior monologue for this character. Blind test: cover the attribution tag — the reader must be able to identify who is speaking.");
        }
        parts.push("  " + lParts.join(" "));
      }

      // ── FLAW-STRENGTH INJECTION ──────────────────────────────────────────────
      if ((c as any).hamartia || (c as any).rootWound || (c as any).blindSpot) {
        const fParts: string[] = ["CHARACTER PSYCHOLOGY:"];
        if ((c as any).rootWound) {
          fParts.push(`Root wound: ${(c as any).rootWound}`);
          fParts.push("This wound is the architecture of their whole personality — their strength and their flaw are the same root, grown in different directions.");
        }
        if ((c as any).hamartia) {
          fParts.push(`Fatal flaw (hamartia): ${(c as any).hamartia}`);
          fParts.push("This must be DEMONSTRATED through behavior and consequence, not described. It should cost them something real in every scene that activates it.");
        }
        if ((c as any).significantFlaws?.length) fParts.push(`Active flaws: ${(c as any).significantFlaws.join(", ")}`);
        if ((c as any).cognitiveBias) {
          const biasMap: Record<string, string> = {
            "confirmation_bias": "Confirmation bias — systematically sees only evidence supporting existing beliefs; filters contradictions as noise. They are NOT lying — their perception is distorted.",
            "fundamental_attribution_error": "Fundamental attribution error — attributes others' bad behavior to character ('they're a bad person') but their own to circumstance ('I had no choice'). Cannot see their own hypocrisy.",
            "sunk_cost_fallacy": "Sunk cost fallacy — cannot abandon wrong paths because of investment already made. Applies to relationships, missions, beliefs.",
            "dunning_kruger": "Dunning-Kruger in their domain gap — overconfident in areas where they know least, unaware of the gap.",
            "in_group_bias": "In-group bias — systematically applies different moral standards to their group vs. outsiders. Not consciously evil — different moral worlds.",
          };
          fParts.push(biasMap[(c as any).cognitiveBias] || `Cognitive bias: ${(c as any).cognitiveBias}`);
        }
        if ((c as any).blindSpot) {
          fParts.push(`Blind spot: ${(c as any).blindSpot}`);
          fParts.push("This is what they cannot see about themselves. The reader should be able to see it; other characters may see it; they cannot.");
        }
        if ((c as any).strengthBranch) {
          fParts.push(`Strength (same root as flaw): ${(c as any).strengthBranch}`);
          fParts.push("Look for moments where strength and flaw are simultaneously visible — these are peak characterization moments.");
        }
        if ((c as any).compensationBehavior) {
          fParts.push(`Compensation behavior: ${(c as any).compensationBehavior}`);
          if ((c as any).compensationTrigger) fParts.push(`Activated by: ${(c as any).compensationTrigger}`);
        }
        if ((c as any).flawArcMode) {
          const arcMap: Record<string, string> = {
            "overcome": "Flaw arc: this character is on a transformation trajectory — the flaw will eventually be transcended, at cost.",
            "fail": "Flaw arc: the flaw will win. This is a tragedy architecture.",
            "compensate": "Flaw arc: the character builds systems around the flaw that allow functional life — without resolving it.",
            "accept": "Flaw arc: the character will make peace with this — not overcome it, not be destroyed by it. This is the most mature and underwritten resolution.",
          };
          if (arcMap[(c as any).flawArcMode]) fParts.push(arcMap[(c as any).flawArcMode]);
        }
        parts.push("  " + fParts.join(" "));
      }

      // ── SKILL CARD INJECTION ─────────────────────────────────────────────────
      if ((c as any).skills && Array.isArray((c as any).skills) && (c as any).skills.length > 0) {
        const skillLines: string[] = ["SKILL CARD:"];
        const levelLabels = ["", "Novice", "Apprentice", "Competent", "Expert", "Master"];
        for (const skill of (c as any).skills) {
          let line = `${skill.name} (${skill.category}): ${levelLabels[skill.level] || skill.level}`;
          if (skill.acquisitionPath) {
            const pathLabel: Record<string, string> = {
              "deliberate_practice": "learned through structured practice",
              "trial_by_fire": "forged under extreme necessity",
              "mentorship": "taught by a master (with their blind spots embedded)",
              "observation": "self-taught through watching",
              "incidental": "accumulated through life experience",
            };
            line += ` (${pathLabel[skill.acquisitionPath] || skill.acquisitionPath})`;
          }
          if (skill.traumaLinked && skill.traumaTrigger) line += ` — TRAUMA-LINKED: cannot demonstrate without risk of triggering ${skill.traumaTrigger}`;
          if (skill.acquisitionCost) line += `. Cost: ${skill.acquisitionCost}`;
          skillLines.push(line);
        }
        skillLines.push("SKILL GATE: Never generate this character succeeding at actions beyond their demonstrated skill level without narrative cost. Physical/cognitive/social skills do NOT transfer between domains.");
        parts.push("  " + skillLines.join(" "));
      }

      // ── WORLD LOGIC KNOWLEDGE MATRIX ────────────────────────────────────────
      const km: Record<string, any> = (c as any).knowledgeMap ?? {};
      const kmEntries = Object.values(km);
      if (kmEntries.length > 0) {
        const wlParts: string[] = [`WORLD LOGIC — ${c.name.toUpperCase()}:`];
        wlParts.push('(Do not have this character act on information they do not have.)');

        const ignorant     = kmEntries.filter((e: any) => e.state === 'IGNORANT');
        const falselyBel   = kmEntries.filter((e: any) => e.state === 'FALSELY_BELIEVES');
        const activelyHide = kmEntries.filter((e: any) => e.state === 'ACTIVELY_HIDING');
        const suspects     = kmEntries.filter((e: any) => e.state === 'SUSPECTS');
        const knows        = kmEntries.filter((e: any) => e.state === 'KNOWS');
        const believes     = kmEntries.filter((e: any) => e.state === 'BELIEVES');

        if (ignorant.length)
          wlParts.push(`DOES NOT KNOW (must not reference or act on): ${ignorant.map((e: any) => e.entityName).join(', ')}.`);
        falselyBel.forEach((e: any) =>
          wlParts.push(`FALSELY BELIEVES about ${e.entityName}: "${e.belief}" — this character acts on this false belief with full conviction.`)
        );
        activelyHide.forEach((e: any) =>
          wlParts.push(`ACTIVELY HIDING knowledge of ${e.entityName}${e.notes ? ': ' + e.notes : ''} — will not reveal this under any circumstances, including direct questioning.`)
        );
        if (suspects.length)
          wlParts.push(`SUSPECTS (intuition without proof): ${suspects.map((e: any) => e.entityName).join(', ')} — acts on these suspicions with caution, not certainty.`);
        if (knows.length || believes.length) {
          const confirmed = [...knows.map((e: any) => e.entityName), ...believes.map((e: any) => e.entityName)];
          wlParts.push(`KNOWS/BELIEVES: ${confirmed.join(', ')}.`);
        }
        parts.push('  ' + wlParts.join(' '));
      }

      // ── NARRATOR BLIND SPOT ──────────────────────────────────────────────────
      if ((c as any).narratorBlindSpot?.trim()) {
        parts.push(`  NARRATOR BLIND SPOT: ${(c as any).narratorBlindSpot}`);
        parts.push(`  When narrating from ${c.name}'s perspective: they believe they understand their own motivations clearly. They are wrong about this specific thing. Write from inside their confidence while making the gap visible to the reader through what they don't mention, what they describe without understanding, what they explain away too quickly.`);
      }

      // ── FIRST IMPRESSION NOTE (Chapter 1 only) ────────────────────────────
      if (activeIdx === 0 && (c as any).firstImpressionNote?.trim()) {
        parts.push(`  FIRST APPEARANCE: ${(c as any).firstImpressionNote}`);
        parts.push('  This is the first time the reader meets this character. Before plot, before conflict — show this specific moment. It must earn the reader\'s investment. Not heroism. Humanity.');
      }

      // Intelligence profile
      const ip: Record<string, any> = (c as any).intelligenceProfile ?? {};
      if (ip.dominant?.length) {
        const intelligenceMap: Record<string, string> = {
          logical:       'reasons through abstraction and pattern — follows chains of implication',
          linguistic:    'reads subtext precisely, chooses words for effect, notices how things are said',
          spatial:       'thinks in maps and systems — navigates and visualizes instinctively',
          kinesthetic:   'trusts body knowledge, leads with action, understands through doing',
          interpersonal: 'reads people accurately, tracks social dynamics and power shifts',
          intrapersonal: 'high self-awareness, monitors internal state, reflects before acting',
          practical:     'street-smart, improvises under constraint, reads situations not abstractions',
        };
        const dominantLines = ip.dominant.map((t: string) => `${t}: ${intelligenceMap[t] ?? t}`).join('; ');
        parts.push(`  INTELLIGENCE: ${dominantLines}.`);
        if (ip.weak?.length)
          parts.push(`  INTELLIGENCE GAPS (errors here are realistic): ${ip.weak.join(', ')}.`);
      }

      // Cultural worldview
      if ((c as any).culturalWorldview) {
        parts.push(`  CULTURAL WORLDVIEW: ${(c as any).culturalWorldview}`);
        parts.push("  Write this character's assumptions and moral reasoning through this cultural lens. Their \"common sense\" is culture-specific — do not universalize it.");
      }

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

        if ((c as any).selfJustificationPattern?.trim()) {
          parts.push(`  SELF-JUSTIFICATION: ${(c as any).selfJustificationPattern}`);
          parts.push('  This is how this character explains their own actions to themselves. They are not lying — they genuinely believe this framing. Write their internal logic as coherent from inside their worldview.');
        }
        if ((c as any).moralFoundationProfile?.trim()) {
          parts.push(`  MORAL FOUNDATION: ${(c as any).moralFoundationProfile}`);
          parts.push('  This is the moral reasoning system they operate within. It has internal consistency. Where it conflicts with the protagonist\'s moral foundation is where the story\'s central argument lives.');
        }
        parts.push(`  COUNTER-ARGUMENT RULE: This character's worldview is a legitimate argument against what the protagonist believes. In every confrontation, they should be winning that argument until the moment they aren't. The protagonist's victory should cost something and require genuinely grappling with the antagonist's position.`);
      }
      r.push(parts.join("\n"));
    });
  }

  if (p.characterRelationships?.length) {
    const charMap = new Map((p.characters ?? []).map((c: Character) => [c.id, c.name]));
    const significantRels = p.characterRelationships.filter((rel: CharacterRelationship) =>
      rel.relationshipType || rel.knowledgeAsymmetry || (rel.trustLevel !== undefined && rel.trustLevel !== 50)
      || rel.powerDifferential || rel.emotionalRegister || rel.arcTrajectory
    );

    if (significantRels.length > 0) {
      r.push('RELATIONSHIPS:');
      for (const rel of significantRels) {
        const nameA = charMap.get(rel.characterAId) ?? rel.characterAId;
        const nameB = charMap.get(rel.characterBId) ?? rel.characterBId;
        const parts: string[] = [`  ${nameA} ↔ ${nameB}`];

        if (rel.relationshipType) parts.push(`type: ${rel.relationshipType}`);

        if (rel.trustLevel !== undefined && rel.trustLevel !== 50) {
          parts.push(rel.trustLevel >= 75 ? 'high trust' : rel.trustLevel <= 25 ? 'deep distrust' : 'strained trust');
        }

        if (rel.powerDifferential && rel.powerDifferential !== 0) {
          const holder = rel.powerDifferential > 0 ? nameA : nameB;
          const subject = rel.powerDifferential > 0 ? nameB : nameA;
          parts.push(`${holder} holds power over ${subject} (${Math.abs(rel.powerDifferential)}/5)`);
        }

        if (rel.emotionalRegister) parts.push(`register: ${rel.emotionalRegister}`);

        if (rel.knowledgeAsymmetry) {
          parts.push(`KNOWLEDGE GAP: ${rel.knowledgeAsymmetry} — write dialogue and behavior that reflects this asymmetry; do not let the ignorant party act on information they do not have`);
        }

        if (rel.attachmentStyleA) {
          const attachmentBehaviors: Record<string, string> = {
            secure: `${nameA} communicates needs directly and tolerates disagreement without panic`,
            anxious: `${nameA} reads abandonment into ambiguous signals, seeks reassurance`,
            avoidant: `${nameA} withdraws under stress, resists intimacy, keeps emotional distance`,
            disorganized: `${nameA} alternates between clinging and pushing away — unpredictable under stress`,
          };
          if (attachmentBehaviors[rel.attachmentStyleA]) parts.push(attachmentBehaviors[rel.attachmentStyleA]);
        }

        if (rel.arcTrajectory) parts.push(`arc: currently ${rel.arcTrajectory} — write consistent with this direction`);

        const hf = rel.fourHorsemen;
        if (hf) {
          const horsemen: string[] = [];
          if (hf.contempt >= 3)      horsemen.push('contempt present (most corrosive)');
          if (hf.criticism >= 3)     horsemen.push('persistent criticism');
          if (hf.defensiveness >= 3) horsemen.push('high defensiveness');
          if (hf.stonewalling >= 3)  horsemen.push('stonewalling');
          if (horsemen.length) parts.push(`relationship damage markers: ${horsemen.join(', ')}`);
        }

        if (rel.notes) parts.push(`notes: ${rel.notes}`);

        r.push(parts.join(' | '));
      }
    }
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

  return r.join("\n");
}

export function buildDynamicContext(p: ContextProject): string {
  const r: string[] = [];

  if (p.storyMemories?.length) {
    const salient = scoredMemories(p.storyMemories, p.chapters ?? [], p.activeChapter ?? "");
    r.push("STORY MEMORY — key facts from previous chapters:");
    salient.forEach((m) => {
      const sd = (m as any).structuredData;
      if (sd && sd.keyEvents?.length) {
        r.push(`[${sd.chapterTitle ?? 'Chapter'}${sd.arcPosition ? ' — ' + sd.arcPosition : ''}]`);
        if (sd.charactersPresent?.length) r.push(`  Present: ${sd.charactersPresent.join(', ')}`);
        if (sd.keyEvents?.length) r.push(`  Events: ${sd.keyEvents.join(' | ')}`);
        if (sd.knowledgeShifts?.length) sd.knowledgeShifts.forEach((ks: any) =>
          r.push(`  Knowledge: ${ks.character} now ${ks.to} about "${ks.learned}"`)
        );
        if (sd.decisionsAndConsequences?.length) r.push(`  Decision: ${sd.decisionsAndConsequences[0]}`);
        if (sd.emotionalStateEnd && Object.keys(sd.emotionalStateEnd).length)
          r.push(`  Emotional end: ${Object.entries(sd.emotionalStateEnd).map(([k, v]) => `${k}→${v}`).join(', ')}`);
        if (sd.openPromisesCreated?.length) r.push(`  Promises planted: ${sd.openPromisesCreated.join(', ')}`);
      } else {
        r.push(`- [${m.category}] ${m.fact}`);
      }
    });
  }

  // ── OPEN STORY PROMISES ───────────────────────────────────────────────────
  const openPromises = ((p as any).storyPromises ?? []).filter((sp: any) => sp.status === 'open');
  if (openPromises.length > 0) {
    r.push('OPEN STORY PROMISES (these must eventually be paid off — do not forget them):');
    const priorityA = openPromises.filter((sp: any) => sp.priority === 'A');
    const others    = openPromises.filter((sp: any) => sp.priority !== 'A');
    priorityA.forEach((sp: any) => r.push(`★ [HIGH PRIORITY] ${sp.setup}${sp.payoffIntent ? ' — intended: ' + sp.payoffIntent : ''}`));
    others.slice(0, 5).forEach((sp: any) => r.push(`- ${sp.setup}`));
  }

  // ── EMOTIONAL ARC CONTEXT ─────────────────────────────────────────────────
  const activeChapForArc = p.chapters?.find((c: any) => c.id === p.activeChapter);
  if (activeChapForArc) {
    const arcParts: string[] = [];
    if ((activeChapForArc as any).arcPosition) {
      arcParts.push(`NARRATIVE POSITION: This chapter sits at "${(activeChapForArc as any).arcPosition}" in the story arc.`);
      const directive = ARC_POSITION_DIRECTIVES[(activeChapForArc as any).arcPosition];
      if (directive) arcParts.push(directive);
    }
    if ((activeChapForArc as any).emotionalTone) {
      arcParts.push(`EMOTIONAL REGISTER: The dominant tone of this chapter is ${(activeChapForArc as any).emotionalTone}.`);
      arcParts.push(`Write the emotional content through physical sensation and behavior — never name the emotion directly.`);
    }
    if (arcParts.length > 0) r.push(arcParts.join(' '));
  }

  // ── GENRE CONTRACT — Chapter 1 only ──────────────────────────────────────
  const activeIdx = p.chapters?.findIndex((ch: any) => ch.id === p.activeChapter) ?? 0;
  if (activeIdx === 0) {
    const primaryGenre = (p.genres as string[] ?? [])[0];
    const contract = GENRE_CONTRACTS[primaryGenre];
    if (contract) {
      r.push('');
      r.push(contract);
    }
    r.push('OPENING QUESTION: The first chapter must plant one question the reader needs answered. Not the plot question — the human question. Something about a person, not about what happens next.');
  }

  // ── PROFESSIONAL ACCURACY INJECTION ───────────────────────────────────────
  const prompt = p.currentPrompt ?? '';
  const genres: string[] = (p as any).genres ?? [];
  const accuracyDomains = detectAccuracyDomains(prompt, genres);
  for (const domain of accuracyDomains) {
    r.push(buildAccuracyContext(domain));
  }

  // ── DOMAIN REALISM INJECTION ───────────────────────────────────────────────
  const realismDomains = [
    ...getRealismDomainsForMode(p.activeMode ?? ''),
    ...((p.activeRealismDomains ?? []) as any),
  ].filter((v, i, arr) => arr.indexOf(v) === i);
  if (realismDomains.length > 0) {
    r.push(buildRealismContext(realismDomains as any));
  }

  return r.join("\n");
}

export function buildContext(p: ContextProject): string {
  return buildStaticContext(p) + "\n" + buildDynamicContext(p);
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
