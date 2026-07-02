# AI Engine

How the AI generation system works: models, modes, context assembly, prompt caching, and the design decisions behind it.

---

## Entry Point: `src/lib/ai/engine.ts`

Everything AI-related flows through this file. It exports:

- `MODELS` — the three model tier constants
- `generate()` — the main generation function (mode routing)
- `generateEntity()` — character/location/plot thread generation
- `summarizeChapter()` — chapter summarization for continuity
- `buildQuickStory()` — quick story skeleton

### MODELS Constants

```typescript
export const MODELS = {
  fast:    "claude-haiku-4-5-20251001",
  default: "claude-sonnet-5",
  quality: "claude-opus-4-8",
};
```

These are the **only** place model strings appear in the codebase. All 42 route files import `{ MODELS }` from here. This means you can upgrade the entire platform by changing one line.

---

## The 26 Writing Modes

All 26 `GenerationMode`s are defined in `src/lib/modes/registry.ts` (`MODE_REGISTRY` — single source of truth for label, model tier, gate, quality check, visibility, slash command, and keywords).

### Core Modes (always available, ungated)

| Mode | Model | What it does |
|---|---|---|
| `brainstorm` | default | Generates story ideas, "what if" scenarios, premise variations |
| `outline` | default | Story structure, act breaks, chapter-by-chapter outline |
| `write` | default | Pure prose generation — the main writing mode |

### Library Modes (Story Pro+, 23 modes)

Each library mode has its own system prompt in `engine.ts` backed by academic research. The system prompt is cached (ephemeral block); the project context is dynamic.

| Mode | Model | Academic grounding | What it does |
|---|---|---|---|
| `action` | default | Narrative momentum principles | High-paced physical sequences |
| `atmosphere` | default | Ulrich stress recovery theory, Merleau-Ponty phenomenology | Environment as emotional character |
| `chase` | quality | Terrain logic, resource depletion (energy/time/options) | Chase/escape scenes driven by decisions, not just speed |
| `combat` | default | Biomechanical accuracy, kinesics | Fight choreography with physical realism |
| `comedy` | default | Incongruity theory, Bergson | Comic timing, situational humor |
| `composition` | quality | Multi-layer narrative theory | Mixes up to 5 modes simultaneously |
| `dialogue` | default | Speech Act Theory, Polyvagal states | Conversation with subtext and power dynamics |
| `emotional` | default | FACS (Facial Action Coding), Polyvagal Theory | Body-first emotional expression |
| `endings` | default | Narrative resolution theory | Chapter and act conclusions |
| `ethics` | default | Applied ethics frameworks | Moral dilemmas with no clean answer |
| `historical` | default | Period-accurate detail | Historical fiction with sourced specifics |
| `horror` | default | Dread-building, Lovecraftian theory | Psychological + visceral horror |
| `interrogation` | quality | Psychological pressure architecture (false concession, strategic silence) | Interrogation scenes as psychological operations, not Q&A |
| `isekai` | default | Isekai trope taxonomy | Portal fantasy with genre-aware execution |
| `monologue` | default | Dramatic monologue theory | Character soliloquies, internal conflict |
| `mystery` | default | Clue-chain theory, fair-play rules | Plot-integral mystery with planted clues |
| `romance` | default | Attachment theory, romance archetype taxonomy | Relationship dynamics with emotional stakes |
| `scitech` | default | Hard SF accuracy standards | Technically grounded science/tech |
| `setting` | default | Sense-of-place theory | World description that earns its page count |
| `sports` | default | Sports narrative theory | Competition scenes with stakes and character |
| `tension` | default | Brewer & Lichtenstein Suspense-Affect Theory | Escalating dread and uncertainty |
| `thriller` | default | Thriller pacing theory | Information withholding, reversal structure |
| `voice` | default | Narrative voice analysis | Point-of-view consistency and distinctiveness |

### Creator Tool Modes (Creator Pro+)

These do not use the `generate()` function — they are standalone route handlers with their own Anthropic calls.

| Route | Model | Purpose |
|---|---|---|
| `/api/ai/prose` | default | Prose enhancement for non-fiction/scripts |
| `/api/ai/hook-ab` | default | A/B test two hook variations |
| `/api/ai/tiktok-native` | default | TikTok hooks + full script generation |
| `/api/ai/repurpose` | default | Repurpose content across platforms |
| `/api/ai/research-scaffold` | default | Research structure and angle generation |
| `/api/ai/retention-edit` | default | Pacing and retention editing |
| `/api/ai/thumbnail-concepts` | default | YouTube thumbnail concepts |
| `/api/ai/creator-seo` | default | SEO optimization for creators |
| `/api/ai/trend-youtube` | default | YouTube trend analysis |
| `/api/ai/trend-instagram` | default | Instagram trend analysis |
| `/api/ai/trend-angles` | **fast** | Generate angles from trend data |
| `/api/ai/virality-predict` | default | Virality prediction scoring |
| `/api/ai/channel-autopsy` | default | Full channel analysis |
| `/api/ai/guest-intel` | default | Guest research brief |
| `/api/ai/scene-to-video-prompt` | default | Convert scene text to video prompt |

---

## Centralized System Prompts: `src/lib/ai/prompts.ts`

The inline `system: "..."` template-string prompts used by the creator-tool routes above (plus several analysis routes — `knowledge-audit`, `tension-curve`, `transportation-check`, `villain-pov`, `alt-draft`, `production/generate-package`, `pipeline`, and the prose sub-operations) are extracted into named exports in `src/lib/ai/prompts.ts`:

- `SCREAMING_SNAKE_CASE` consts ending `_SYSTEM_PROMPT` for prompts with no interpolation (e.g. `RETENTION_EDIT_SYSTEM_PROMPT`, `HOOK_STRATEGIST_SYSTEM_PROMPT`)
- camelCase functions ending `SystemPrompt` for prompts that interpolate per-request values (e.g. `scoreHookSystemPrompt(format)`, `villainPovSystemPrompt(name, role, profileNote, personality, desires)`, `pipelineSceneWriterSystemPrompt(ctx, fmt)`)

This is a pure refactor — prompt wording is unchanged from the original inline literals, just moved to one file and given names. It does **not** change the `MI` dispatch map (the 26-mode system prompts described above, which remain in `engine.ts`/genre library files) — `prompts.ts` covers the standalone routes that bypass `generate()`.

---

## Context Assembly: `src/lib/ai/context-builder.ts`

Every generation call passes through `buildContextString(projectId, userId)` which queries the database and assembles a structured context string. This is what makes GhostWriter "continuity-aware."

### Context Components (in order of injection)

**1. Project Header**
```
PROJECT: The Hollow Path
FORMAT: Novel | GENRES: Literary Fiction, Thriller
TONE: Melancholic, tense
LOGLINE: A grieving journalist uncovers her own past.
```

**2. Style DNA** (only when reference works exist)
The style analysis for each reference work produces 6 attributes:
- Voice cadence
- Sentence structure
- Dialogue style
- Descriptive density
- Pacing pattern
- Thematic approach

These are injected as `STYLE DIRECTIVE: [attribute]: [value]` lines.

**3. Voice Fingerprint** (only when 3+ chapters with 200+ chars exist)

Extracts 10 stylometric markers from the writer's last 5 chapters and injects them as binding numerical constraints (Van Nuenen / Berkeley 2026 research). Implemented in `src/lib/ai/voice-fingerprint.ts`.

```
VOICE FINGERPRINT — write to match these measured constraints:
- Avg sentence length: 14.2 words (range: 10–18)
- Contraction rate: 0.08 per sentence
- First-person rate: 0.12 per sentence
...
These are measured from your actual writing. Treat as hard constraints.
```

**4. Characters**

Injection is controlled by `contextVisibility` per character:

- `always` — full profile injected regardless of scene
- `mentioned` — full profile injected only if character name appears in prompt/context; otherwise one-liner
- `never` — never injected

Characters with full injection:
```
━━ Maya Patel (Protagonist) ━━
Role: Lead investigator
Personality: Methodical, emotionally guarded
Desires: Truth about her mother's disappearance
Fears: Complicity in the cover-up
Arc: Learns to grieve without answers
NVC: Crosses arms when lying, speaks faster under stress
Language: Formal register, avoids contractions
```

Characters with `alwaysInContext = false` (legacy) or `contextVisibility = mentioned` (not in scene) get compressed to one line:
```
The Informant: Unnamed contact, appears Ch.3, provides documents. (not in scene)
```

**5. Locations** — same compression logic as characters

**6. Plot Threads**
```
• The missing journalist [status: open]
• Maya's estranged father [status: dormant]
```

**7. Story Memories** — priority-scored, hard cap of 8

Scoring formula:
```
score = categoryWeight + recencyBonus

categoryWeight:
  character_decision → 3
  event             → 2
  general           → 1

recencyBonus:
  same chapter      → +2
  one chapter back  → +1
  older             → +0
```

Top 8 by score are injected. This keeps the context window lean on long projects.

**8. Chapter Summaries** — last 3 chapters' summaries

### Mode-Aware Context Policy

`buildStaticContext(p, mode?, tier?)` / `buildDynamicContext(p, mode?)` / `buildContext(p, mode?, tier?)` resolve a `ContextPolicy` for the given mode via `resolveContextPolicy(mode)` in `context-builder.ts`, and gate the CHARACTERS / RELATIONSHIPS / LOCATIONS / PLOT THREADS / STORY MEMORY / OPEN PROMISES / REALISM sections accordingly:

```typescript
interface ContextPolicy {
  needsCharacters: boolean;
  needsLocations: boolean;
  needsMemories: boolean;
  needsPlotThreads: boolean;
  needsRealism: boolean;
  charDepth: "full" | "brief";
}
```

Each of the 26 `MODE_REGISTRY` entries carries a `contextPolicy`, built from two base templates (`FULL`, `BRIEF`) and overridden per mode — e.g. `horror`/`combat`/`action` set `needsRealism: true` and drop memories/plot threads (the realism injection covers that ground); `brainstorm`/`outline`/`atmosphere`/`setting`/`scitech` use `BRIEF` (no full character profiles, `charDepth: "brief"` via `buildBriefCharacterLine()` — name/role/age/appearance/personality/arc only). If `mode` is undefined or unrecognized (e.g. `quick-start`/`alt-draft`, which don't pass a mode), `resolveContextPolicy` falls back to `FULL_CONTEXT_POLICY` — identical to pre-policy behavior.

**Tier-aware budget:** `buildStaticContext` also accepts an optional `tier`. When provided, the context budget is `Math.min(STATIC_CONTEXT_BUDGET, Math.floor(CONTEXT_CHAR_CAPS[tier] / 4))` instead of the flat `STATIC_CONTEXT_BUDGET = 8_000` — so lower tiers get a smaller static context budget on top of the per-route `capContextForTier` re-cap.

---

## RAG / Craft-Library Context Helpers

Three retrieval-style helpers augment generation with context beyond the standard project data (`context-builder.ts`) — none of them are LLM calls in themselves except `buildVoiceExemplars`' one cheap embedding lookup:

| Helper | File | What it does | Cost |
|---|---|---|---|
| `buildPromiseLedger(projectId, mode?)` | `src/lib/ai/promise-ledger.ts` | DB-only aggregation of unresolved plot promises (open threads, planted questions). `mode: "generate" \| "preserve"` (default `"generate"`) selects the instruction header — `"generate"` tells the model to advance/deepen threads; `"preserve"` (added 2026-07-01 for Editor tools) tells it not to delete/contradict/resolve them while editing. | DB query only, no LLM |
| `buildVoiceExemplars(userId, query)` | `src/lib/ai/exemplars.ts` | Top-2 embedding-similarity craft-library retrieval (`work_packets`, pgvector) — pulls in external craft anchors for the requested query | One `text-embedding-3-small` call |
| `buildSceneBlueprint(...)` | `src/lib/ai/scene-blueprint.ts` | Haiku scene-planning pre-pass, gated behind the `sceneBlueprint` GrowthBook flag (default OFF) | One Haiku call when the flag is on |

All three are **fail-open** — a DB error, embedding-API error, or insufficient-text case returns `""`/`null` and never throws, so a failure silently degrades to pre-helper behavior rather than breaking generation.

### Writer path (original, 2026-06-21)

`buildPromiseLedger("generate")` and `buildVoiceExemplars` run unconditionally (no flag) for any qualifying request in `/api/ai/generate/route.ts` — `isProseMode(mode) && tier !== 'free' && projectId`, checked before anything else so non-qualifying requests pay zero added latency. `buildSceneBlueprint` is the only one still behind the `sceneBlueprint` flag.

### Director & Editor tools extension (2026-07-01, commit `74c048a`)

Before this, `buildVoiceExemplars`/`buildPromiseLedger`/`buildSceneBlueprint` were called from exactly one place — the Writer-role generate route. Every Editor tool (`refine`, `prose-fix`, `surgical-edit`) and every Director tool called Anthropic directly with zero retrieval context. Reading the Editor tools' system prompts revealed a real constraint: all three carry an explicit **preserve-only mandate** ("preserve the author's voice... do NOT add new scenes/plot/subplots") — so copy-pasting the generate-path helpers verbatim would actively contradict that mandate (e.g. `buildVoiceExemplars` is designed to *pull* generation toward an external craft anchor; the existing `"generate"`-mode promise-ledger copy says "advance or deepen these threads"). The fix uses tool-appropriate context instead:

**Editor tools** (`POST /api/ai/refine`, `/api/ai/prose-fix`, `/api/ai/surgical-edit`) — two additions, both new call sites of *existing* code, no new I/O:
- **Voice constraint from the passage itself**: `extractVoiceFingerprint([text])` (already used on the Writer path via `context-builder.ts`) computed on the text/chapterContent already in the request body — no DB call, pure sync function, `null` if under 500 chars / 10 sentences. `fingerprintToConstraints(fp)` turns it into numeric constraints appended to the system prompt.
- **Preserve-mode promise ledger**: `buildPromiseLedger(projectId, "preserve")` — `prose-fix` and `surgical-edit` gained an optional `projectId` field in their request body for this (`refine` already had it); when absent, skipped silently.

**Director tools** — generation-mode context, since these tools are genuinely generative (not edit-only):
- **`villain-pov`** (`POST /api/projects/[projectId]/villain-pov`): `buildPromiseLedger(projectId, "generate")` + `buildVoiceExemplars(userId, sceneDescription)` in parallel, appended to the system prompt.
- **`generate-package`** (`POST /api/projects/[projectId]/production/generate-package`): `buildPromiseLedger(projectId, "generate")` only — no `buildVoiceExemplars` (no single representative query string for a whole-package batch generation) and no scene blueprint (not a "draft the next prose scene" request).

**Explicitly out of scope** (confirmed via route audit, not oversight): `tension-curve`/`arc-heatmap` are read-only analysis of text the route already has in full — nothing to anchor. `series-plan`/`research-scaffold` are YouTube-creator content-planning tools, not fiction-narrative tools — neither touches `work_packets`, promises, or project prose in a way this context would apply to.

Design doc: `docs/superpowers/specs/2026-06-30-rag-director-editor-wiring-design.md`. Plan: `docs/superpowers/plans/2026-07-01-rag-director-editor-wiring.md`.

---

## Prompt Caching

Anthropic's ephemeral prompt caching (5-minute TTL per conversation prefix) is applied to the static portions of every generation:

```typescript
// Static block — identical for all users in this mode → cached
{ 
  type: "text",
  text: MODE_SYSTEM_PROMPT,
  cache_control: { type: "ephemeral" }
}

// Dynamic block — project-specific → not cached
{
  type: "text", 
  text: contextString  // characters, memories, summaries
}
```

The cache hit saves both latency (no re-tokenization) and cost (cached tokens billed at ~10% of normal rate). For modes like `write` that are called many times per session, this adds up.

### Verified: cache reads confirmed live (2026-06-15)

Console's caching view is ambiguous about reads vs. writes, so this was confirmed directly against the API response `usage` object — the ground truth. Two `generate({ mode: 'write', format: 'Novel', ... })` calls were made back-to-back (~2s apart) with an identical ~14.4k-char static block (hash-verified equal across both calls):

| Call | `input_tokens` | `cache_creation_input_tokens` | `cache_read_input_tokens` | `output_tokens` |
|---|---|---|---|---|
| 1 (cold) | 31 | 2634 | 0 | 20 |
| 2 (~2s later, same static block) | 3 | 28 | 2634 | 22 |

Call 1 writes the static block to cache (2634 tokens). Call 2 reads those same 2634 tokens from cache (`cache_read_input_tokens: 2634`) instead of re-billing/re-tokenizing them — confirming prompt caching produces real cache **reads**, not just writes, on repeat calls within the 5-minute TTL.

---

## Genre Libraries: `src/lib/[genre]/`

20 of the 23 library modes have their own folder directly under `src/lib/` (sibling of `ai/`, not nested inside it):

```
src/lib/
├─ action/
│   ├─ index.ts         — main logic, system prompt construction
│   ├─ context.ts       — rules injected into context
│   ├─ types.ts         — TypeScript types for this genre
│   └─ archetypes/
│       └─ all-action.ts — archetype definitions (e.g. "Chase Sequence")
├─ atmosphere/
│   └─ ... (same structure)
└─ [18 more genres]
```

The genre library is selected in `engine.ts` based on the `mode` parameter passed to `generate()`. The selected library's `getContext()` and archetype list supplement the base system prompt.

The remaining 3 library modes (`composition`, `interrogation`, `chase`) don't follow the archetype-folder pattern — `composition` is handled by `src/lib/ai/composer.ts`, and `interrogation`/`chase` are single-file system prompts in `src/lib/modes/`.

---

## Composition Mode

`composition` mode is the most complex mode. It accepts up to 5 mode weights:

```json
{
  "mode": "composition",
  "layers": [
    { "mode": "tension", "weight": 0.4 },
    { "mode": "dialogue", "weight": 0.35 },
    { "mode": "emotional", "weight": 0.25 }
  ]
}
```

`src/lib/ai/composer.ts` takes these weights and constructs a blended system prompt. This uses `MODELS.quality` because blending multiple mode requirements requires nuanced judgment.

---

## Entity Generation

`generateEntity()` in `engine.ts` creates world-bible entries on demand:

- **Character:** Generates name, role, personality, desires, fears, arc, NVC profile, language patterns
- **Location:** Generates name, description, atmosphere, sensory details
- **Plot thread:** Generates name, description, status, connected characters

Entity generation always uses `MODELS.default`.

---

## Quality Check Pipeline

Story quality checks run two passes in parallel:

```
POST /api/projects/[projectId]/quality-check
  │
  ├─ Pass 1: MODELS.fast — quick structural check (pacing, chapter length)
  └─ Pass 2: MODELS.default — nuanced quality review (voice consistency, tension)
  
Both run via Promise.all() — non-blocking, combined in response
```

The Haiku pass handles objective metrics; Sonnet handles subjective quality. Together they give a richer report without doubling latency.

---

## AIisms Check

An opt-in post-generation guard available to Story Pro+ users. Enabled per project in World Bible settings (`aiismsCheck` boolean column).

When enabled, `src/lib/ai/aiisms.ts` appends a directive to the dynamic context:

```
AIISMS CHECK — after writing, verify none of these phrases appear:
Fiction clichés: heart raced | heart pounded | breath caught | eyes widened | jaw dropped | ...
If any appear, replace with specific physical action or concrete detail.
```

The 20 most common AI fiction tells are blocked. This is injected as `additionalContext` in the generate route, not as a system prompt change, so it doesn't break prompt caching.

---

## Brainstorm 3-Option Mode

When `mode === 'brainstorm'`, the generate route appends a structural directive to the user prompt:

```
Return exactly 3 distinct structural approaches as options:
OPTION A — [SHORT NAME]:
...
OPTION B — [SHORT NAME]:
...
OPTION C — [SHORT NAME]:
...
```

The WritePanel parses this with `parseBrainstormOptions()` and renders selectable cards. Clicking "Develop this direction →" pre-fills the prompt with the chosen option name and clears the output.

---

## Series + Universe Context Injection

`buildSeriesUniverseContext(project, userId)` in `src/app/api/ai/generate/route.ts` — runs for every generation when `project.storyType` is `series` or `universe-story`. Result is merged into `effectiveDynamic` before the Anthropic call.

### Series context

Walks the `seriesParentId` chain backwards (up to 10 prior books). For each prior story, injects:
```
SERIES CONTEXT — events from previous books that inform this story:

Book 1: The Final Empire
  Key: Kelsier dies | Vin discovers her true power | The Lord Ruler falls
Book 2: The Well of Ascension
  - Vin takes the power at the Well and releases it
```

### Universe context

For `universe-story` projects with a `timelineSort` position:

1. **Canonical events** — all `universeEvents` where `isCanon=true` and `timelineSort < this story's position`:
   ```
   UNIVERSE CANON — events established before this story:
   - The Shattering: Adonalsium was broken into 16 Shards
   - The Final Ascension: Vin became a god briefly then died
   ```

2. **Universe characters** — state at the start of this story (from `projectCharacterStates` of prior stories):
   ```
   UNIVERSE CHARACTERS — state at the start of this story:
   Hoid: Role: Wanderer
     State: Amused, collecting stories
   Kelsier: DECEASED (do not include in this story)
   ```

The "DECEASED" flag prevents the model from resurrecting characters that died in earlier stories.

---

## YouTube Reference Video Analysis

`POST /api/ai/analyze-reference-video` — available to `creator_tools_advanced` tier (All Access).

Uses Gemini 3.5 Flash's native YouTube URL support (`fileData.fileUri`) to analyze a reference video's structure, pacing, and style. Returns directives injected into the next generation call as `additionalContext`.

```typescript
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
await ai.models.generateContent({
  model: 'gemini-3.5-flash',
  contents: [{ fileData: { fileUri: youtubeUrl } }, { text: '...' }],
});
```

The UI shows in WritePanel when `isCreatorFormat(project.format) && mode === 'brainstorm'`.

---

## Alt Draft Generation

`/api/projects/[projectId]/chapters/[chapterId]/alt-draft` generates an alternative version of a chapter using one of several "goals" defined in `src/lib/ai/alt-draft/goals.ts`:

- `darker` — raise stakes, add consequence
- `lighter` — reduce tension, add levity
- `faster` — cut description, accelerate pacing
- `more_dialogue` — convert narration to conversation
- `deeper_interiority` — more internal monologue
- `subtext` — move dialogue subtext to surface

Each goal has its own instruction that supplements the base system prompt.
