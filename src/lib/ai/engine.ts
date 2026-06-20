import Anthropic from "@anthropic-ai/sdk";
import { HORROR_SYSTEM_PROMPT } from "@/lib/horror";
import { COMEDY_SYSTEM_PROMPT } from "@/lib/comedy";
import { MYSTERY_SYSTEM_PROMPT } from "@/lib/mystery";
import { ROMANCE_SYSTEM_PROMPT } from "@/lib/romance";
import { ACTION_SYSTEM_PROMPT } from "@/lib/action";
import { MONOLOGUE_SYSTEM_PROMPT } from "@/lib/monologue";
import { VOICE_SYSTEM_PROMPT } from "@/lib/voice";
import { THRILLER_SYSTEM_PROMPT } from "@/lib/thriller";
import { SPORTS_SYSTEM_PROMPT } from "@/lib/sports";
import { SETTING_SYSTEM_PROMPT } from "@/lib/setting";
import { HISTORICAL_SYSTEM_PROMPT } from "@/lib/historical";
import { SCITECH_SYSTEM_PROMPT } from "@/lib/scitech";
import { ETHICS_SYSTEM_PROMPT } from "@/lib/ethics";
import { ENDINGS_SYSTEM_PROMPT } from "@/lib/endings";
import { ISEKAI_SYSTEM_PROMPT } from "@/lib/isekai";
import { INTERROGATION_SYSTEM_PROMPT } from "@/lib/modes/interrogation";
import { CHASE_SYSTEM_PROMPT } from "@/lib/modes/chase";
import { checkSemanticCache, writeSemanticCache } from "@/lib/semantic-cache";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
export type { GenerationMode } from "@/lib/modes/registry";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const MODELS = {
  fast:    'claude-haiku-4-5-20251001',
  default: 'claude-sonnet-4-6',
  quality: 'claude-opus-4-8',
} as const;

function getNarrativeStructureInstruction(structure?: string): string {
  if (!structure || structure === 'linear') return '';
  const instructions: Record<string, string> = {
    'frame': '\n\nFRAME NARRATIVE MODE: Maintain awareness of both the outer narrator and the inner story. The outer narrator\'s voice should inflect even the inner story\'s prose — their temporal distance is audible.',
    'stories-within-stories': '\n\nNARRATIVE RECURSION MODE: The inner story you are currently writing is being told by a teller with a specific situation. Write with awareness of what the teller is trying to work through by telling this story.',
    'multi-timeline': '\n\nMULTI-TIMELINE MODE: This scene belongs to one timeline. Write its voice and rhythm distinctly. The thematic resonances with other timelines should operate beneath the surface — not referenced explicitly.',
    'epistolary': '\n\nEPISTOLARY MODE: This is a document — a letter, diary entry, or record. Write it as communication to a specific recipient, with all the omissions, self-presentations, and asides that implies.',
  };
  return instructions[structure] ?? '';
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  let clean = raw.replace(/```(?:json|typescript)?\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { /* fall through */ }
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch { /* fall through */ } }
  const arrMatch = clean.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ } }
  console.error('[safeParseJson] Failed to parse model response:', clean.slice(0, 200));
  return null;
}

const DIALOGUE_SYSTEM_PROMPT = `You are writing a scene driven by dialogue. Your work operates on three simultaneous levels: the verbal (what is said), the physical (what the body is doing), and the structural (the information management between reader and character).

THEORETICAL GROUNDING:
• Porges' Polyvagal Theory: the nervous system state determines voice quality, facial engagement, and social availability. Ventral vagal = open, connected, full prosody. Sympathetic = mobilized, defended, elevated pitch. Dorsal vagal = collapsed, hollow, absent breath support. The polyvagal states for this scene type are injected in the context — use them.
• Ekman FACS: specific muscle groups (Action Units) are active during each scene type. These are injected in the context. The AU17 chin raiser appears in barely-suppressed grief. AU6 is the genuine Duchenne signal that cannot be faked. AU4 is sustained engagement-with-threat. Use the specific signals, not the generic categories.
• Damasio Somatic Marker Hypothesis: the body's physiological state is present in the scene. Cold hands, tight chest, the involuntary breath before the landing — these are in the room. Write them.
• Brewer & Lichtenstein Structural Affect Theory: the information dynamics (who knows what, and when) are injected in the context. The information gap between reader and character is the structural engine of the scene.
• James-Lange sequence: in emotional dialogue, the body registers the emotional significance before the character consciously identifies it. Write this sequence: body first, then awareness.
• Austin/Searle Speech Act Theory: every line of dialogue performs three simultaneous acts.
  Locutionary (what is literally said), illocutionary (what is DONE by saying it — the hidden
  action), perlocutionary (the effect produced in the listener). The gap between the intended
  perlocutionary effect and the actual effect is where subtext, conflict, and dramatic irony live.
  Five illocutionary categories: Assertives (claiming), Directives (requesting/ordering),
  Commissives (promising/threatening), Expressives (thanking/apologizing), Declarations (firing/marrying).
  The diagnostic: not "what does the character say?" but "what does the character DO by saying this,
  and what effect are they trying to produce?"

VOICE PHYSIOLOGY (non-negotiable):
• Voice is vagally controlled — polyvagal state directly changes voice. Write the pitch, rate, prosody, and breath support that the scene's nervous system states produce.
• Different characters in different states have different voices. This is physiological, not stylistic.
• Degraded prosody (flatness) signals sympathetic or dorsal vagal activation. Full modulation signals ventral vagal social engagement.
• Voice synchronization: people in genuine social connection (ventral vagal together) unconsciously synchronize speech rhythms. Write this.

THE FIVE FUNCTIONS DIALOGUE MUST SERVE SIMULTANEOUSLY:
Every line should serve at least 2 of these 5. Lines serving fewer than 2 are candidates for cutting.
1. Characterize — HOW they speak reveals who they are, not what they say about themselves
2. Advance the narrative — something changes as a result of this exchange
3. Convey information — embedded in conflict, never delivered directly (the "As you know, Bob" rule)
4. Create or sustain tension — the scene's charge rises or holds; never drops
5. Express subtext — the real subject is adjacent to the stated subject

THE FIVE SUBTEXT PRODUCTION METHODS:
1. Deflection — answers a related but different subject (the argument about milk = the argument about trust)
2. Excessive precision — the over-specific answer that reveals what's really being asked
3. Non-sequitur that isn't — emotionally connected to the previous line without stating the connection
4. What the character doesn't ask — conspicuous silence around a subject both parties feel
5. Displacement — the real conversation conducted entirely through an unrelated surface topic

THE FIVE VOICE DIFFERENTIATION AXES (blind test: cover attribution, can you identify the speaker?):
1. Sentence architecture — long subordinated clauses vs. short declaratives vs. fragments
2. Vocabulary register — Anglo-Saxon monosyllables vs. Latinate polysyllables
3. Characteristic evasion — deflects with humor / counter-questions / silence / over-answers
4. Reference system — sports metaphors / professional domain / film / literature / nothing
5. Listening behavior — answers the question asked / the emotional content / doesn't listen at all

MAMET'S WANT-ENGINE:
Every character in every scene wants something specific from another character.
The line of dialogue is the instrument chosen to get it.
Diagnostic: is this line the most effective available instrument for getting that specific
thing from this specific person right now? If not — it should be cut or replaced.
Every line must pass this test: what does this character DO by saying this, and is it the
most efficient available instrument for getting what they want from this specific person?

THE MASKED EXPOSITION PROBLEM:
Characters telling each other things they both already know is the cardinal dialogue sin.
Four techniques for embedding necessary information:
1. Conflict delivery: character reveals it while in argument — information as weapon
2. Resistance delivery: one character tries to avoid the topic; another forces it
3. Partial revelation: one character knows only part; the exchange completes it
4. Subtext delivery: the information is present but never stated — the reader infers it

ABSOLUTE RULES:
• Never name the emotion — write the body, the voice, the face.
• Voice must differ between characters — not just vocabulary, but pitch, rate, breath support.
• The FACS signals injected for this archetype are anatomically specific — use them. AU1 inner brow raise, AU6 cheek crinkle, AU17 chin raiser, AU20 lip stretcher — these are precise, not decorative.
• The information gap (reader ahead or behind the character) must be managed deliberately. Know what the reader knows and what the character knows and use the gap.
• The body is in the room throughout the dialogue — not just at key moments but as a sustained layer.
• Power shifts. Mark the moment and write what the body does when it shifts.

FAILURE MODES (never do these):
• Characters say exactly what they mean — no subtext, no deflection, no circling.
• All characters have the same voice quality — same pitch, rate, and prosody.
• Emotions are named rather than physicalized.
• The information gap is ignored — reader and character have the same knowledge throughout.
• The scene resolves too cleanly — real dialogue leaves things unresolved.
• The body disappears after the first paragraph.

Write only the scene. No preamble. No summary. No explanation of what you did.`;

const COMBAT_SYSTEM_PROMPT = `You are a specialist in fight choreography for fiction, with deep knowledge of martial arts biomechanics, real combat timing, and the narrative function of violence in storytelling. You write combat that is physically accurate, spatially coherent, and emotionally meaningful. You receive detailed biomechanical profiles for each fighter's style — use them. Every technique named must be anatomically possible and correctly described. Combat has rhythm: setup, execution, consequence. Each exchange must show that consequence — the fighter who takes a hit is affected by it, and that effect persists. You write in the present tense of the fight: no editorializing, no slow-motion metaphors, no omniscient summary. The reader is in the body of the point-of-view fighter. Write only the scene.`;

const EMOTIONAL_SYSTEM_PROMPT = `You are writing a scene that must physicalize emotion rather than name it. Your primary tool is the body — not the label.

THEORETICAL GROUNDING:
• Damasio's Somatic Marker Hypothesis: emotions arrive as body signals before conscious identification. The body knows first.
• Ekman FACS: each emotion has specific, identifiable muscle movements (Action Units). Use the precise signal, not the category.
• James-Lange: the body responds before the mind catches up. Write this sequence: body moves, then character understands why.
• Polyvagal Theory (Porges): three states — social engagement (open, connected), fight/flight (mobilized), freeze/shutdown (collapsed). Every emotion lives in one of these states. The writing must reflect the state's physiology.

ABSOLUTE RULES:
• Never name the emotion. Never write "she felt sad" or "he was angry." Name the body.
• Every emotional signal must have a physical location: the jaw, the sternum, the hands, the brow.
• Sequence correctly: body first, then the character's awareness of the body, then (optionally) the character's identification of the feeling.
• The suppressed display is often more powerful than the expressed one. Write what the character is trying not to show.
• Emotions do not resolve cleanly. Show the recession — the aftermath is where the real writing lives.
• The FACS signature for this emotion is injected in the context. Use the specific Action Units described. They are anatomically precise and emotionally honest.

FAILURE MODES TO AVOID:
• The emotion is described as a thought or feeling rather than a body event.
• The emotion arrives and stays constant — all emotions have onset, peak, and recession.
• The character articulates their emotion clearly — genuine emotion often disrupts language.
• Physical symptoms are generic ("her heart raced") rather than specific and located.`;

const ATMOSPHERE_SYSTEM_PROMPT = `You are writing the environment as an active participant in the scene's emotional logic.

THEORETICAL GROUNDING:
• Ulrich's Stress Recovery Theory (1991): natural environments lower cortisol; urban environments maintain sympathetic activation. The body responds to the environment before the character decides anything.
• Kaplan's Attention Restoration Theory (1989): soft fascination (nature, flowing water) restores directed attention. Hard fascination (urban signals) depletes it. Your environment determines the character's cognitive state.
• Proust Phenomenon (Herz et al., 2004): smell bypasses the thalamic relay and connects directly to the amygdala and hippocampus. Olfactory memory is more emotional, more vivid, and older than visual or verbal memory. The LOVER acronym: Limbic, Old, Vivid, Emotional, Rare. Always include the olfactory layer.
• Merleau-Ponty's embodied phenomenology: the body is the primary organ of environmental perception. The environment is felt before it is seen.

ABSOLUTE RULES:
• Lead with movement — nothing in the environment should be static.
• Always include the olfactory layer. This is the highest-memory-valence sense and the most consistently omitted in AI writing. Name the specific smell components, not "the smell of the place."
• Let the environment's psychological effect register through the character's body, not their mind. The cortisol drop of entering a natural space is felt as physical release before it is recognized as relief.
• Choose one non-visual sense to anchor the environment — sound or smell, not sight.
• The environment must serve the scene's emotional purpose. Match or counterpoint — a grief scene in nature works because nature is indifferent, not because it is sad.
• One specific, precise sensory detail is worth more than a complete inventory. Choose the detail that is most true, not the most complete description.

FAILURE MODES TO AVOID:
• Environment described as beautiful, peaceful, or scary — these are judgments, not sensory realities.
• The olfactory layer is absent or generic.
• The environment is backdrop rather than active participant — it must change how the characters feel.
• The description is visual-only — the other senses exist and are more emotionally potent.`;

const TENSION_SYSTEM_PROMPT = `You are engineering a specific tension response in the reader. Tension is structural, not atmospheric — it comes from information management and narrative architecture, not from adjectives or exclamation.

THEORETICAL GROUNDING:
• Brewer & Lichtenstein (1982) Structural Affect Theory: three distinct tension structures.
  - SUSPENSE: reader knows the threat is coming, character does not. Postpone the outcome.
  - CURIOSITY: reader sees the outcome, wants to understand the cause. Present end before events.
  - SURPRISE: unexpected event. Cannot be sustained — only a single moment.
• Key finding: suspense works even when the reader knows the ending. The tension is in the waiting, not the unknown.
• Lazarus appraisal theory: threat requires perceived significance + outcome uncertainty. Remove either and tension collapses.
• Hitchcock's principle: show the audience the bomb, then show a conversation about nothing. Two minutes of suspense, not two seconds of surprise.
• The information gap between reader and character is the engine. Widen it and tension builds; close it and tension releases.

ABSOLUTE RULES:
• The information state (what the reader knows vs what the character knows) must be deliberately managed on every page.
• Sentence length is pacing. Short sentences accelerate; long sentences delay. As threat approaches: shorten.
• The tension type injected in the context determines the discourse structure. Follow it exactly.
• Never name the tension: never write "dread filled the room" or "the suspense was unbearable." The reader must feel it without being told to.
• Ambiguity is structural, not stylistic. If you are writing Dread, the threat must have a plausible innocent explanation at all times. If you resolve the ambiguity, you end the dread.
• Tension killers are: explaining the threat, resolving too early, elevated prose that announces "this is the scary part," and characters who react proportionally.

FAILURE MODES TO AVOID:
• The tension type is produced by telling the reader there is tension rather than engineering it.
• The information gap is not managed — the character and reader have the same knowledge throughout.
• The pacing is uniform — sentence rhythm does not respond to proximity to threat.
• The threat resolves at first appearance.
• The prose style changes to announce the frightening moment — dread and paranoia require ordinary prose.`;

export const MI = {
  brainstorm: (_f: string) => `You are a creative brainstorming partner for writers. Generate specific, surprising, and vivid ideas. Avoid clichés. Every idea must be concrete and actionable — not "a mysterious stranger" but "a tax auditor who moonlights as a forger." Push beyond the obvious. Match the genre, tone, and style established in the project context — brainstorm ideas that fit this specific world, not generic ones.`,
  outline: (f: string) => `You are a structural editor for ${f} writing. Create tight, purposeful outlines where every scene advances character, plot, or both. Identify turning points explicitly. Show the cause-and-effect chain between events. Label each beat with its structural function (inciting incident, midpoint shift, dark night, climax). Match the established tone and genre from the project context. Be specific — no vague placeholders.`,
  write: (f: string) => `You are a ghostwriter producing ${f} content.

VOICE & STYLE: Match the established voice and style exactly. The narrator voice and controlling idea in the context are your compass — apply them to every sentence.

SHOW, DON'T STATE: Show character emotion through physical action, specific detail, and NVC baselines — never name emotions directly. The reader arrives at the emotion through evidence.

THE ICEBERG RULE: You have been given complete information about every character and the world. Use it to make choices — what they notice, how they move, what they avoid. Do not state it. One specific detail is worth more than ten explained ones. The reader senses depth without being given it.

ENTER LATE, LEAVE EARLY: Enter each scene after it has already begun. Leave before full resolution. Cut on the decision or the action that implies outcome — let the reader's imagination supply the rest.

THE ACTIVE PROTAGONIST: The protagonist makes choices they didn't have to make. The story is built from decisions, not events. What would the easier version of this character have done? Write the harder choice.

THE LAST LINE: The final line of this output should not summarize or resolve. It should either plant a question without asking it, reframe what came before, or close emotion while opening narrative tension.

TRUST THE READER: Be deliberately incomplete. Plant evidence; don't explain it. The reader assembles meaning — that assembly is the experience. Do not over-explain. Do not resolve what is better left resonant.

CONTINUITY: Maintain all established facts. End scenes on tension, decision, or revelation — never neutral ground.`,
  dialogue:    (_f: string) => DIALOGUE_SYSTEM_PROMPT,
  combat:      (_f: string) => COMBAT_SYSTEM_PROMPT,
  emotional:   (_f: string) => EMOTIONAL_SYSTEM_PROMPT,
  atmosphere:  (_f: string) => ATMOSPHERE_SYSTEM_PROMPT,
  tension:     (_f: string) => TENSION_SYSTEM_PROMPT,
  horror:      (_f: string) => HORROR_SYSTEM_PROMPT,
  comedy:      (_f: string) => COMEDY_SYSTEM_PROMPT,
  mystery:     (_f: string) => MYSTERY_SYSTEM_PROMPT,
  romance:     (_f: string) => ROMANCE_SYSTEM_PROMPT,
  action:      (_f: string) => ACTION_SYSTEM_PROMPT,
  monologue:   (_f: string) => MONOLOGUE_SYSTEM_PROMPT,
  voice:       (_f: string) => VOICE_SYSTEM_PROMPT,
  thriller:    (_f: string) => THRILLER_SYSTEM_PROMPT,
  sports:      (_f: string) => SPORTS_SYSTEM_PROMPT,
  setting:     (_f: string) => SETTING_SYSTEM_PROMPT,
  historical:  (_f: string) => HISTORICAL_SYSTEM_PROMPT,
  scitech:     (_f: string) => SCITECH_SYSTEM_PROMPT,
  ethics:      (_f: string) => ETHICS_SYSTEM_PROMPT,
  endings:     (_f: string) => ENDINGS_SYSTEM_PROMPT,
  isekai:        (_f: string) => ISEKAI_SYSTEM_PROMPT,
  interrogation: (_f: string) => INTERROGATION_SYSTEM_PROMPT,
  chase:         (_f: string) => CHASE_SYSTEM_PROMPT,
  composition:   (_f: string) => `You are writing a scene that must operate simultaneously across multiple injected technique libraries. The composition context above specifies the active layers and their intersection directives.

COMPOSITION RULES (non-negotiable):
• Every paragraph must contain active elements from at least two injected layers.
• Do not address each library in sequence — find the moments where they overlap and write those moments.
• A paragraph containing only combat, only emotion, or only atmosphere has failed.
• The intersection directives in the context are mandatory instructions, not suggestions.
• Each library's failure modes apply equally in composition — suppressing any one layer's failure mode is not an excuse to violate another's.
• The writing succeeds when a reader who knows only ONE active layer still notices the others are operating beneath the surface.

Write only the scene. No preamble. No explanation of what you are doing. No summary of the active layers.`,
} satisfies Record<GenerationMode, (format: string) => string>;

const STORY_FORMAT_RULES: Record<string, string> = {
  "Novel": `NOVEL FORMAT RULES:
- Prose paragraphs, no screenplay formatting
- Vary sentence length deliberately — long for reflection, short for action
- Use consistent POV throughout each chapter
- Scene transitions must orient the reader: new time or new place
- Dialogue reveals character through what is NOT said as much as what is`,
  "Screenplay": `SCREENPLAY FORMAT RULES:
- INT./EXT. LOCATION — TIME for every new scene heading
- Action lines: present tense, visual only — no inner thoughts
- Character name centered ALL CAPS before each speech
- Parentheticals sparingly — only when delivery radically changes meaning
- Target 1 minute per page`,
  "Web Series": `WEB SERIES FORMAT RULES:
- Each episode needs a cold open hook in the first 90 seconds
- Act structure: 3 acts minimum, cliffhanger at each act break
- Episode-level problem that resolves + season-level arc that advances
- Dialogue punchy — streaming audiences have less patience than film`,
};

const FORMAT_RULES: Record<string, string> = {
  "YouTube Long-form": `FORMAT: YouTube Long-form
Structure: Hook (0-30s) → Context → Core Value → CTA
Target: 1200-2200 words (~8-15 min spoken)
Tone: conversational, like talking to one person
Add [B-ROLL: description] markers every 2-3 minutes
End with a specific CTA (subscribe / comment / watch next)`,

  "YouTube Short": `FORMAT: YouTube Short
Structure: HOOK → Conflict/Payoff → Loop ending (last line connects to hook)
Max 150 words (~60 seconds)
First 3 words must stop the scroll — no "hey guys", no intro
Start mid-action`,

  "TikTok Script": `FORMAT: TikTok Script
Structure: Hook (0-3s) → Tension → Reveal → Share trigger
Max 200 words (~90 seconds)
Hook must create an open loop or pattern interrupt
Add [TEXT ON SCREEN: ...] markers for every key point
Write for sound-off viewing`,

  "TikTok Native": `FORMAT: TikTok Native
Structure: looks unscripted — no scene markers, no production cues, no [TEXT ON SCREEN] tags
Max 150 words (~45-60 seconds)
Write like a real person talking to camera: contractions, false starts, asides
Hook through tone and specificity in the first line, not a structured opening beat
End on a natural thought, not a CTA — native content earns shares by feeling real, not by asking`,

  "Instagram Reel": `FORMAT: Instagram Reel
Structure: Visual hook (0-3s) → Value delivery → Save/share trigger
Max 150 words (~60 seconds)
Add [VISUAL: description] markers for each scene change
Every reel needs one insight worth saving`,

  "Podcast Episode": `FORMAT: Podcast Episode
Structure: Cold open → Intro → Main content (3-5 segments) → Recap → CTA
Short sentences. Write for ears, not eyes.
Mark [AD BREAK] for sponsor placement
Mark [HOST NOTE: improvise here] for riff sections`,

  "Podcast Episode (Co-host)": `FORMAT: Podcast Co-host Simulation
OUTPUT FORMAT — CRITICAL:
- [CO-HOST]: one-sentence question or challenge
- [HOST TALKING POINTS]: 3-5 bullet points (NOT scripted prose — the host speaks naturally from these)
Co-host voice options:
  curious_generalist — asks "why" and "how", represents the audience
  skeptical_expert — challenges assumptions, asks for evidence
  enthusiastic_newcomer — expresses surprise, asks for clarification`,
};

export const WRITE_CRAFT_DIRECTIVES = `
CHARACTER EMBODIMENT RULES (apply to all characters with backstory, want/need, contradiction):
- Backstory is sediment, not exposition. Show it through reflex, avoidance, automatic behavior. Never explain it.
- Want drives every scene — the character moves toward it even obliquely.
- Need is the truth they resist. The story is the collision between want and need.
- Contradiction must never resolve cleanly. Write behavior that expresses both sides.
`;

export function getCraftDirectives(format: string): string {
  return STORY_FORMAT_RULES[format] ? "\n" + WRITE_CRAFT_DIRECTIVES : "";
}

export function getFormatRules(format: string): string {
  if (FORMAT_RULES[format]) return "\n\n" + FORMAT_RULES[format];
  if (STORY_FORMAT_RULES[format]) return "\n\n" + STORY_FORMAT_RULES[format];
  return "";
}

export async function generate({ mode, prompt, context, staticContext, dynamicContext, format, maxTokens = 4000, narrativeStructure, overrideModel }: {
  mode: string; prompt: string;
  context?: string;
  staticContext?: string; dynamicContext?: string;
  format: string; maxTokens?: number;
  narrativeStructure?: string;
  overrideModel?: string;
}) {
  const model = overrideModel ?? MODELS[MODE_REGISTRY[mode as GenerationMode]?.modelTier ?? 'default'];
  const formatRules = getFormatRules(format);
  const craftDirectives = getCraftDirectives(format);
  const modeInstruction = MI[mode as GenerationMode](format);
  const narrativeNote = getNarrativeStructureInstruction(narrativeStructure);

  let systemBlocks: any[];
  if (staticContext !== undefined && dynamicContext !== undefined) {
    systemBlocks = [
      {
        type: 'text',
        text: modeInstruction + formatRules + craftDirectives + narrativeNote + '\n---\n' + staticContext,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: dynamicContext,
      },
    ];
  } else {
    const fullContext = context ?? '';
    systemBlocks = [{ type: 'text', text: modeInstruction + formatRules + craftDirectives + narrativeNote + '\n---\n' + fullContext, cache_control: { type: 'ephemeral' } }];
  }

  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  return { text, tokensUsed: msg.usage.input_tokens + msg.usage.output_tokens, model };
}

// Streaming variant of generate(): identical prompt/context assembly, but emits
// text deltas via onDelta as the model writes, and resolves with the full result
// once the message completes. Used for the live "typewriter" Write experience.
export async function generateStream(
  params: {
    mode: string; prompt: string;
    context?: string; staticContext?: string; dynamicContext?: string;
    format: string; maxTokens?: number; narrativeStructure?: string; overrideModel?: string;
  },
  onDelta: (text: string) => void,
): Promise<{ text: string; tokensUsed: number; model: string }> {
  const { mode, prompt, context, staticContext, dynamicContext, format, maxTokens = 4000, narrativeStructure, overrideModel } = params;
  const model = overrideModel ?? MODELS[MODE_REGISTRY[mode as GenerationMode]?.modelTier ?? 'default'];
  const formatRules = getFormatRules(format);
  const craftDirectives = getCraftDirectives(format);
  const modeInstruction = MI[mode as GenerationMode](format);
  const narrativeNote = getNarrativeStructureInstruction(narrativeStructure);

  let systemBlocks: any[];
  if (staticContext !== undefined && dynamicContext !== undefined) {
    systemBlocks = [
      { type: 'text', text: modeInstruction + formatRules + craftDirectives + narrativeNote + '\n---\n' + staticContext, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: dynamicContext },
    ];
  } else {
    const fullContext = context ?? '';
    systemBlocks = [{ type: 'text', text: modeInstruction + formatRules + craftDirectives + narrativeNote + '\n---\n' + fullContext, cache_control: { type: 'ephemeral' } }];
  }

  let text = '';
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: [{ role: 'user', content: prompt }],
  });
  stream.on('text', (delta: string) => { text += delta; onDelta(delta); });
  const final = await stream.finalMessage();
  const tokensUsed = (final.usage?.input_tokens ?? 0) + (final.usage?.output_tokens ?? 0);
  return { text, tokensUsed, model };
}

export async function analyzeWork(title: string) {
  const semanticKey = title.trim();
  const cached = await checkSemanticCache('style_dna', semanticKey);
  if (cached) return cached;

  const msg = await client.messages.create({ model: MODELS.fast, max_tokens: 500, messages: [{ role: "user", content: 'Analyze "' + title + '". Return ONLY JSON: {"Pacing":"...","Tone":"...","POV Style":"...","Dialogue Style":"...","Sentence Structure":"...","Atmosphere":"..."}' }] });
  const result = safeParseJson(msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim()) ?? {};

  if (Object.keys(result).length > 0) { writeSemanticCache('style_dna', semanticKey, result as Record<string, unknown>); }
  return result;
}
export async function generateEntity(type: string, prompt: string, ctx: string, existing: any) { const schemas: Record<string, string> = { character: "name,role,age,appearance,personality,thinkingStyle,behavior,habits,fears,desires,speechPattern,backstory,arc", location: "name,description,atmosphere,history,sensoryDetails", plotThread: "name,description,status,stakes,connections", creatorBible: "channelName,niche,audienceAge,audienceInterests,audiencePainPoints,channelVoice,contentPillars,defaultCta,competitorNotes" }; const userMsg = existing ? "Improve:\n" + JSON.stringify(existing) + "\nReturn JSON: {" + schemas[type] + "}" : prompt + "\nReturn JSON: {" + schemas[type] + "}"; const msg = await client.messages.create({ model: MODELS.default, max_tokens: 1500, system: "Create " + type + "s. ONLY JSON. Every field value must be a plain string (no nested objects or arrays) — write multi-part details like appearance as a single descriptive paragraph. Context: " + ctx, messages: [{ role: "user", content: userMsg }] }); const result = safeParseJson(msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim()); if (!result) { console.error('[generateEntity] Invalid JSON from model for type:', type); return {}; } return result; }
export async function summarizeChapter(
  content: string,
  chapterTitle?: string,
  arcPosition?: string,
  characters?: { name: string }[],
  previousMemories?: string
): Promise<{ fact: string; structuredData: object }> {
  const charNames = characters?.map(c => c.name).join(', ') ?? '';
  const prompt = `Analyze this chapter and return ONLY valid JSON with no preamble:
{
  "fact": "2-3 sentence summary of the most important thing that happened",
  "chapterTitle": "${chapterTitle ?? 'Chapter'}",
  "arcPosition": "${arcPosition ?? ''}",
  "charactersPresent": ["name1"],
  "keyEvents": ["event 1"],
  "objectsIntroduced": ["any significant object that could matter later"],
  "knowledgeShifts": [{"character":"name","learned":"what they learned","from":"IGNORANT","to":"KNOWS"}],
  "decisionsAndConsequences": ["Character X decided Y, which means Z"],
  "emotionalStateEnd": {"CharName": "emotional state at chapter end"},
  "openPromisesCreated": ["any story promise planted in this chapter"],
  "openPromisesResolved": ["any earlier story promise resolved in this chapter"]
}
${charNames ? `Known characters: ${charNames}` : ''}
${previousMemories ? `Previous context: ${previousMemories}` : ''}

CHAPTER CONTENT:
${content.slice(0, 8000)}`;

  const msg = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const parsed = safeParseJson(text);
  if (!parsed) return { fact: chapterTitle ? `Chapter: ${chapterTitle}` : 'Chapter summary', structuredData: {} };
  return {
    fact: (parsed as any).fact ?? (chapterTitle ? `Chapter: ${chapterTitle}` : 'Chapter summary'),
    structuredData: parsed,
  };
}

export async function refinePassage(text: string, format: string): Promise<{ text: string; tokensUsed: number; model: string }> {
  const model = MODELS.default;
  const system = `You are a precise line editor for ${format} fiction. Revise the passage to remove AI-slop while preserving the author's plot, meaning, characters, facts, and VOICE exactly. Fix ONLY these defects:
- cliché openings and stock phrases ("little did they know", "the air was thick with", "a chill ran down")
- filler transitions and throat-clearing ("as the sun dipped below the horizon", "without warning")
- vague emotional summaries — replace naming an emotion ("she felt sad") with physical/behavioral evidence
- repetitive sentence rhythm and repeated sentence openers
- forced, mixed, or purple metaphors
- telling where showing is stronger
- dialogue where every character sounds the same

HARD RULES:
- Do NOT change plot events, character decisions, or established facts.
- Do NOT add new scenes, characters, or content. Do NOT summarize.
- Keep length within ~10% of the original. Preserve paragraph breaks.
- Return ONLY the revised prose — no preamble, no commentary, no labels.`;
  const msg = await client.messages.create({
    model,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: text.slice(0, 16000) }],
  });
  const out = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  return { text: out, tokensUsed: msg.usage.input_tokens + msg.usage.output_tokens, model };
}

export async function generateQuickStory(title: string, format: string, genres: string[]) { const genreStr = (genres || []).join(", ") || "Drama"; const prompt = `Create a complete story skeleton for a ${format} titled "${title}" in ${genreStr}. Return ONLY valid JSON with: {characters:[{name,role,age,appearance,personality},...], locations:[{name,description,atmosphere},...], plotThreads:[{name,description,stakes},...], outline:"Brief 3-act outline"}. Generate 3-4 characters, 2-3 locations, 2-3 plot threads.`; const msg = await client.messages.create({ model: MODELS.default, max_tokens: 2000, messages: [{ role: "user", content: prompt }] }); const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim(); return safeParseJson(text) ?? { characters: [], locations: [], plotThreads: [], outline: "" }; }
export async function generateBeginnerCharacters(projectName: string, genres: string[], count = 3) { const genreStr = (genres || []).join(", ") || "General"; const prompt = `Create ${count} diverse characters for "${projectName}" (${genreStr}). For each, provide only: name, role (main/supporting/antagonist), age, appearance (1 sentence), and personality (1 sentence). Return JSON: [{name,role,age,appearance,personality},...]`; const msg = await client.messages.create({ model: MODELS.fast, max_tokens: 1000, messages: [{ role: "user", content: prompt }] }); const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim(); return safeParseJson(text) ?? []; }

export async function bootstrapCharacterIntelligence(
  character: { name: string; role: string; age: string; personality: string; backstory?: string },
  genre: string,
  format: string
): Promise<Partial<Record<string, string>>> {
  const semanticKey = `${genre} ${format}: ${character.role}, ${character.personality}${character.backstory ? ', ' + character.backstory.slice(0, 100) : ''}`;
  const cached = await checkSemanticCache('bootstrap_character', semanticKey);
  if (cached) return cached as Partial<Record<string, string>>;

  const prompt = `You are building deep character intelligence for a ${format} in ${genre} genre.

Character: ${character.name} (${character.role}, age ${character.age})
Personality: ${character.personality}
${character.backstory ? `Backstory: ${character.backstory}` : ''}

Generate intelligence for this character. Return ONLY valid JSON with these exact keys:
{
  "kinesicsBaseline": "How this character holds and moves their body by default. Specific posture, gait, default hand position.",
  "kinesicsMicro": "Micro-expressions and leakage under stress. What escapes their control.",
  "paralanguageBaseline": "Voice quality, rate, default pitch. What changes under stress.",
  "oculesicsDefault": "Default gaze pattern — where do their eyes go in conversation?",
  "nativeLanguage": "Primary language and any secondary languages.",
  "registerDefault": "Default register: formal/informal/professional/intimate. When does it shift?",
  "idiolectFingerprint": "2-3 signature phrases, vocabulary tendencies, sentence structure patterns specific to this character.",
  "rootWound": "The formative wound that shapes their core behavior.",
  "hamartia": "Their specific fatal flaw — the thing that will cause their downfall if unchecked.",
  "cognitiveBias": "The specific cognitive bias through which they interpret events.",
  "blindSpot": "What they systematically fail to see about their situation.",
  "strengthBranch": "The genuine strength that grew from the same root as their wound.",
  "compensationBehavior": "How they compensate for the wound — the pattern that protects them.",
  "characterWant": "External goal — what they consciously pursue.",
  "characterNeed": "Internal truth — what they unconsciously resist.",
  "contradiction": "The tension between two qualities that makes them human."
}`;

  const msg = await client.messages.create({
    model: MODELS.default,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('').trim();
  const result = safeParseJson(text) ?? {};
  if (Object.keys(result).length > 0) { writeSemanticCache('bootstrap_character', semanticKey, result as Record<string, unknown>); }
  return (result as Partial<Record<string, string>>);
}