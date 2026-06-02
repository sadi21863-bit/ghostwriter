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
  default: "claude-sonnet-4-6",
  quality: "claude-opus-4-6",
};
```

These are the **only** place model strings appear in the codebase. All 28 route files import `{ MODELS }` from here. This means you can upgrade the entire platform by changing one line.

---

## The 25 Writing Modes

### Core Modes (always available)

| Mode | Model | What it does |
|---|---|---|
| `brainstorm` | default | Generates story ideas, "what if" scenarios, premise variations |
| `outline` | default | Story structure, act breaks, chapter-by-chapter outline |
| `write` | default | Pure prose generation — the main writing mode |
| `dialogue` | default | Conversation-driven scenes with speech act theory grounding |

### Library Modes (Story Pro+)

Each library mode has its own system prompt in `engine.ts` backed by academic research. The system prompt is cached (ephemeral block); the project context is dynamic.

| Mode | Model | Academic grounding | What it does |
|---|---|---|---|
| `action` | default | Narrative momentum principles | High-paced physical sequences |
| `atmosphere` | default | Ulrich stress recovery theory, Merleau-Ponty phenomenology | Environment as emotional character |
| `combat` | default | Biomechanical accuracy, kinesics | Fight choreography with physical realism |
| `comedy` | default | Incongruity theory, Bergson | Comic timing, situational humor |
| `composition` | quality | Multi-layer narrative theory | Mixes up to 5 modes simultaneously |
| `dialogue` | default | Speech Act Theory, Polyvagal states | Conversation with subtext and power dynamics |
| `emotional` | default | FACS (Facial Action Coding), Polyvagal Theory | Body-first emotional expression |
| `endings` | default | Narrative resolution theory | Chapter and act conclusions |
| `ethics` | default | Applied ethics frameworks | Moral dilemmas with no clean answer |
| `historical` | default | Period-accurate detail | Historical fiction with sourced specifics |
| `horror` | default | Dread-building, Lovecraftian theory | Psychological + visceral horror |
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

**3. Characters**

Characters with `alwaysInContext = true` get full injection:
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

Characters with `alwaysInContext = false` get compressed to one line:
```
The Informant: Unnamed contact, appears Ch.3, provides documents.
```

**4. Locations** — same compression logic as characters

**5. Plot Threads**
```
• The missing journalist [status: open]
• Maya's estranged father [status: dormant]
```

**6. Story Memories** — priority-scored, hard cap of 8

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

**7. Chapter Summaries** — last 3 chapters' summaries

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

---

## Genre Libraries: `src/lib/ai/[genre]/`

Each of the 20 library modes has its own folder in `src/lib/ai/`:

```
src/lib/ai/
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

## Alt Draft Generation

`/api/projects/[projectId]/chapters/[chapterId]/alt-draft` generates an alternative version of a chapter using one of several "goals" defined in `src/lib/ai/alt-draft/goals.ts`:

- `darker` — raise stakes, add consequence
- `lighter` — reduce tension, add levity
- `faster` — cut description, accelerate pacing
- `more_dialogue` — convert narration to conversation
- `deeper_interiority` — more internal monologue
- `subtext` — move dialogue subtext to surface

Each goal has its own instruction that supplements the base system prompt.
