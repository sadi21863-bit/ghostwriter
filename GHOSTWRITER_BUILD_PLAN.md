# GhostWriter — Master Build Plan v3
**For Claude Code | Updated May 2026**
**Status: Phase 1 complete. Start at Phase 2.**

---

## Project

| Key | Value |
|-----|-------|
| **Location** | `C:\Users\aditya\Desktop\ghostwriter project\ghostwriter` |
| **Repo** | `github.com/sadi21863-bit/ghostwriter` |
| **Stack** | Next.js 16, Drizzle ORM, Neon PostgreSQL, NextAuth, Anthropic Claude, Razorpay, Tailwind, Vercel |
| **Dev port** | 3001 — always run `npm run dev -- -p 3001` |
| **DB migrate** | Always run `copy .env.local .env` THEN `npm run db:push` |
| **Dev tool** | Claude Code terminal only. Do NOT use VS Code extension. |

---

## Vision

GhostWriter is the **pre-production studio for storytellers and creators**.

- **Fiction writers** build deep novels, screenplays, and web series with a structured World Bible, multi-agent AI pipeline, and surgical prose tools
- **Content creators** script YouTube, TikTok, Instagram, and Podcast content with a Channel Bible tuned to their audience and voice
- **Both** can convert finished work into AI-illustrated comics using **Higgsfield Soul 2.0** with Soul ID character consistency
- **Filmmakers** get a full **Higgsfield Production Studio** inside GhostWriter — generate still previews, animate shots, and produce final video clips without leaving the app

GhostWriter + Higgsfield = one complete pipeline. Write the story in GhostWriter. Generate the visuals in Higgsfield. All from one place.

---

## Environment Variables

Add all of these to `.env.local` now. Update `CLAUDE.md` with this list.

```
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3001
DATABASE_URL=
ANTHROPIC_API_KEY=
HIGGSFIELD_API_KEY=      # Phase 8 + 9 — Soul 2.0 images + video generation
BLOB_READ_WRITE_TOKEN=   # Phase 8 — Vercel Blob image storage
```

**Note on Higgsfield API Key:** Users provide their own Higgsfield API key in GhostWriter settings. GhostWriter makes Higgsfield calls on their behalf. This means the cost of image/video generation comes from the user's own Higgsfield credits, not from GhostWriter. This is the correct architecture — GhostWriter is the orchestration layer, not the billing layer. For development/testing, use your own Higgsfield key in `.env.local`.

---

## Current State

**Phase 1 is COMPLETE. Do not touch Phase 1 files.**

✅ Authorization holes fixed on all sub-resource routes
✅ JSON.parse crashes fixed (safeParseJson helper in engine.ts)
✅ moveChapter now persists sortOrder to database
✅ Project load error state added
✅ Anthropic SDK updated to latest

---

## Phases at a Glance

| # | Phase | Source |
|---|-------|--------|
| 1 | Bug fixes | ✅ DONE |
| 2 | Creator Formats + Creator Bible | Original plan |
| 3 | World Bible Intelligence | NovelCrafter + NovelAI + FinalBit steals |
| 4 | Surgical Prose Tools | Sudowrite steal |
| 5 | Multi-Agent Writing Pipeline | Original plan |
| 6 | Script Export + Hook Scorer | Original plan |
| 7 | Character Relationship Graph | Laper steal |
| 8 | Comic Studio (Higgsfield Soul 2.0) | Higgsfield Soul + Soul ID |
| 9 | Higgsfield Production Studio | Higgsfield full API integration |
| DB | Migrations | After Phases 2, 3, 8 |

---

---

# PHASE 2 — Creator Formats & Creator Bible

## What This Phase Does

Expands GhostWriter beyond novels and screenplays. Adds YouTube, TikTok,
Instagram Reel, and Podcast as first-class formats. Each format gets its own
AI prompting rules. Creator formats get a Channel Bible instead of a World Bible.

---

## 2a — Format Constants

**File: `src/components/GhostWriterApp.tsx`**

```ts
const FORMATS = [
  "Novel", "Screenplay", "Web Series",
  "YouTube Long-form", "YouTube Short",
  "TikTok Script", "Instagram Reel", "Podcast Episode",
];

const CREATOR_FORMATS = [
  "YouTube Long-form", "YouTube Short",
  "TikTok Script", "Instagram Reel", "Podcast Episode",
];

const STORY_FORMATS = ["Novel", "Screenplay", "Web Series"];

const isCreatorFormat = (f: string) => CREATOR_FORMATS.includes(f);
const isStoryFormat   = (f: string) => STORY_FORMATS.includes(f);

const getChapterLabel = (format: string): string => ({
  "Novel": "Chapter", "Screenplay": "Scene", "Web Series": "Episode",
  "YouTube Long-form": "Section", "YouTube Short": "Beat",
  "TikTok Script": "Beat", "Instagram Reel": "Beat",
  "Podcast Episode": "Segment",
}[format] ?? "Chapter");
```

---

## 2b — Format-Specific AI Prompting

**File: `src/lib/ai/engine.ts`**

Add a `FORMAT_RULES` map and inject into every `generate()` system prompt:

```ts
const FORMAT_RULES: Record<string, string> = {
  "YouTube Long-form": `
FORMAT: YouTube Long-form
Structure: Hook (0-30s) → Context → Core Value → CTA
Target: 1200-2200 words (~8-15 min spoken)
Tone: conversational, like talking to one person
Add [B-ROLL: description] markers every 2-3 minutes
End with a specific CTA (subscribe / comment / watch next)`,

  "YouTube Short": `
FORMAT: YouTube Short
Structure: HOOK → Conflict/Payoff → Loop ending (last line connects to hook)
Max 150 words (~60 seconds)
First 3 words must stop the scroll — no "hey guys", no intro
Start mid-action`,

  "TikTok Script": `
FORMAT: TikTok Script
Structure: Hook (0-3s) → Tension → Reveal → Share trigger
Max 200 words (~90 seconds)
Hook must create an open loop or pattern interrupt
Add [TEXT ON SCREEN: ...] markers for every key point
Write for sound-off viewing`,

  "Instagram Reel": `
FORMAT: Instagram Reel
Structure: Visual hook (0-3s) → Value delivery → Save/share trigger
Max 150 words (~60 seconds)
Add [VISUAL: description] markers for each scene change
Every reel needs one insight worth saving`,

  "Podcast Episode": `
FORMAT: Podcast Episode
Structure: Cold open → Intro → Main content (3-5 segments) → Recap → CTA
Short sentences. Write for ears, not eyes.
Mark [AD BREAK] for sponsor placement
Mark [HOST NOTE: improvise here] for riff sections`,
};

// In generate(), build system prompt as:
// basePrompt + (FORMAT_RULES[format] || "") + "\n---\n" + context
```

---

## 2c — Creator Bible Schema

**File: `src/db/schema.ts`** — add after existing tables:

```ts
export const creatorBibles = pgTable("creator_bibles", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })
    .unique(),
  channelName:        text("channel_name").default(""),
  niche:              text("niche").default(""),
  audienceAge:        text("audience_age").default(""),
  audienceInterests:  text("audience_interests").default(""),
  audiencePainPoints: text("audience_pain_points").default(""),
  channelVoice:       text("channel_voice").default(""),
  contentPillars:     jsonb("content_pillars").$type<string[]>().default([]),
  competitorNotes:    text("competitor_notes").default(""),
  defaultCta:         text("default_cta").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creatorBiblesRelations = relations(creatorBibles, ({ one }) => ({
  project: one(projects, {
    fields: [creatorBibles.projectId], references: [projects.id],
  }),
}));
// Also add: creatorBible: one(creatorBibles) to projectsRelations
```

**Then run:** `copy .env.local .env && npm run db:push`

---

## 2d — Creator Bible API Route

**New file: `src/app/api/projects/[projectId]/creator-bible/route.ts`**

```ts
// GET  — fetch creator bible (return empty defaults if none exists)
// PATCH — upsert (update if exists, insert if not)
// Both: verify project ownership (projects.userId === session.user.id)
// PATCH body: any subset of creatorBibles fields
// On insert: set projectId from params
```

---

## 2e — Update Context Builder

**File: `src/lib/ai/context-builder.ts`** — add alongside existing `buildContext()`:

```ts
export function buildCreatorContext(p: any): string {
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
    p.referenceWorks.forEach((w: any) => {
      r.push(`- "${w.title}"`);
      Object.entries(w.attributes || {}).filter(([,v])=>v)
        .forEach(([k,v]) => r.push(`  ${k}: ${v}`));
    });
  }
  return r.join("\n");
}
```

In `GhostWriterApp.tsx`, update `buildFullContext()`:
```ts
const buildFullContext = (p = project) => {
  const base = isCreatorFormat(p.format)
    ? buildCreatorContext(p)
    : buildContext(p);
  const summaries = p.chapters
    .filter((c:any) => c.summary && c.id !== p.activeChapter)
    .map((c:any) => `[${c.title}]: ${c.summary}`)
    .join("\n");
  return summaries ? base + "\n\nPREVIOUS SECTIONS:\n" + summaries : base;
};
```

---

## 2f — Creator Bible UI

**File: `src/components/GhostWriterApp.tsx`**

Load creator bible on project load if creator format:
```ts
const [creatorBible, setCreatorBible] = useState<any>(null);
useEffect(() => {
  if (!project || !isCreatorFormat(project.format)) return;
  fetch(`/api/projects/${project.id}/creator-bible`)
    .then(r => r.json()).then(setCreatorBible);
}, [project?.id, project?.format]);
```

Auto-save creator bible with 1.5s debounce on any field change (same
pattern as chapter autosave — use a ref timer, PATCH on change).

In left panel Bible tab, render conditionally:
- `isCreatorFormat(project.format)` → **Channel Bible UI**
- otherwise → existing **World Bible UI**

Channel Bible fields:
```
Channel Name         text input
Niche / Topic        text input
Target Audience Age  text input  ("18-34", "13-17", etc.)
Audience Interests   textarea
Audience Pain Points textarea
Voice & Tone         textarea  ("Casual, punchy, no-BS")
Content Pillars      tag input — add/remove string chips, stored as string[]
Default CTA          text input  ("Subscribe for weekly videos")
Competitor Notes     textarea
```

Add "AI Generate Bible" button → calls:
```ts
callAI("entity", {
  type: "creatorBible",
  prompt: bibleGenPrompt,
  projectContext: buildCreatorContext({ ...project, creatorBible }),
})
```

---

## 2g — creatorBible Entity Type in Engine

**File: `src/lib/ai/engine.ts`** — add to `schemas` in `generateEntity()`:

```ts
creatorBible: "channelName,niche,audienceAge,audienceInterests,audiencePainPoints,channelVoice,contentPillars,defaultCta,competitorNotes",
```

---

---

# PHASE 3 — World Bible Intelligence
**Competitor steals: NovelCrafter (cross-linking) + NovelAI (portraits) + FinalBit (story memory)**

## What This Phase Does

Makes the World Bible smart. Characters link to locations and plot threads
automatically. Every character gets a visual portrait. The AI remembers
established facts across the entire story — not just summaries.

---

## 3a — Character Portraits
**Stolen from: NovelAI. Improved by: connecting portraits to comic generation.**

**What NovelAI does:** Generates anime-style character art from a description.
Decorative only — no downstream use.

**GhostWriter's version:** Portrait becomes the visual anchor for every
comic panel that character appears in (Phase 8). Not decoration — a production asset.

**Schema change — `src/db/schema.ts`:**
Add `portraitUrl: text("portrait_url").default("")` to the `characters` table.

**New API route: `src/app/api/projects/[projectId]/characters/[characterId]/portrait/route.ts`**

```ts
// POST — generate portrait for a character
// 1. Verify ownership
// 2. Fetch character record (need appearance field)
// 3. Build portrait prompt:
//    prompt = `Character portrait. ${char.name}, ${char.role}.
//              Appearance: ${char.appearance}.
//              Clean character art, detailed face, neutral expression,
//              white background, concept art style.
//              No text, no speech bubbles.`
// 4. Call gpt-image-2: n=1, size="1024x1024", quality="standard", response_format="b64_json"
// 5. Upload to Vercel Blob at: portraits/{projectId}/{characterId}.png
// 6. PATCH character record with portraitUrl
// 7. Return { portraitUrl }
```

**UI change in character modal (`GhostWriterApp.tsx`):**

At the top of the character edit/create modal, show:
- If `character.portraitUrl` exists: render the portrait image (120×120px, rounded)
- Always show: "🎨 Generate Portrait" button (disabled if appearance field is empty)
- Clicking it calls the portrait route, shows a spinner, then displays the image

**Note:** Only show portrait generation for story formats. Creator formats
don't have character modals in the same way.

---

## 3b — Cross-Entity Auto-Linking
**Stolen from: NovelCrafter Codex. Improved by: auto-detection instead of manual setup.**

**What NovelCrafter does:** Users manually link characters to locations and
plot threads. Most users never bother — too much work.

**GhostWriter's version:** Auto-detect links by scanning chapter content
for name co-occurrences. Suggest with one-click confirm. User never has to
set up links manually.

**Schema changes — `src/db/schema.ts`:**

```ts
// Add to characters table:
linkedLocationIds: jsonb("linked_location_ids").$type<string[]>().default([]),
linkedPlotThreadIds: jsonb("linked_plot_thread_ids").$type<string[]>().default([]),

// Add to locations table:
linkedCharacterIds: jsonb("linked_character_ids").$type<string[]>().default([]),
```

**New API route: `src/app/api/projects/[projectId]/suggest-links/route.ts`**

```ts
// POST — scan all chapters and suggest entity links
// 1. Verify ownership
// 2. Fetch project with characters, locations, plotThreads, chapters
// 3. For each chapter content, scan for character and location name mentions
// 4. Build co-occurrence map: { characterId: { locationIds: [], plotThreadIds: [] } }
//    - A character and location are "linked" if they appear in the same chapter (3+ times)
//    - Use simple string matching on character.name and location.name
// 5. Return suggestions array:
//    [{ type: "char-loc", characterId, locationId, coOccurrences: 4 }, ...]
```

**UI in World Bible left panel:**

After a project has 3+ chapters, show a "🔗 Suggest Links" button at the top
of the World Bible section. When clicked:
- Calls suggest-links route
- Renders suggestion chips:
  "Arjun appears with The Warehouse in 4 chapters. Link them? [Yes] [No]"
- "Yes" PATCHes both the character's `linkedLocationIds` and
  the location's `linkedCharacterIds`
- Dismiss all suggestions with one "Not now" button

**Update `context-builder.ts`:** When building character context, include
linked location names and linked plot thread names:
```ts
if (c.linkedLocationIds?.length) {
  const linked = p.locations.filter(l => c.linkedLocationIds.includes(l.id));
  if (linked.length) parts.push(`  Frequent locations: ${linked.map(l=>l.name).join(", ")}`);
}
```

---

## 3c — Story Memory Auto-Extraction
**Stolen from: FinalBit. Improved by: making memory visible and editable.**

**What FinalBit does:** Persistent story memory that remembers established
facts across the manuscript. It's a black box — you trust it's working.

**GhostWriter's version:** After every chapter save, a background Claude Haiku
call extracts established facts. Facts are stored as visible, deletable chips
the user can review and correct. Transparent memory the user controls.

**Schema change — `src/db/schema.ts`:**

```ts
export const storyMemories = pgTable("story_memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(()=>projects.id, {onDelete:"cascade"}),
  chapterId: uuid("chapter_id").references(()=>chapters.id, {onDelete:"set null"}),
  fact: text("fact").notNull(),
  category: varchar("category", {length:30}).default("general"),
  // categories: "character_decision" | "world_rule" | "relationship" | "event" | "general"
  autoExtracted: boolean("auto_extracted").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const storyMemoriesRelations = relations(storyMemories, ({one}) => ({
  project: one(projects, {fields:[storyMemories.projectId], references:[projects.id]}),
}));
// Add storyMemories: many(storyMemories) to projectsRelations
```

**New API route: `src/app/api/projects/[projectId]/story-memories/route.ts`**

```ts
// GET  — fetch all story memories for a project
// POST — manually add a memory
// DELETE /:memoryId — delete a specific memory (verify ownership)
```

**New API route: `src/app/api/projects/[projectId]/chapters/[chapterId]/extract-memory/route.ts`**

```ts
// POST — extract facts from a chapter (called automatically after chapter saves)
// 1. Verify ownership
// 2. Fetch chapter content
// 3. Call claude-haiku-4-5 (cheap model, use for background jobs):
//    System: "Extract established facts from this chapter. Return ONLY JSON array:
//             [{ fact: string, category: 'character_decision|world_rule|relationship|event|general' }]
//             Include: character decisions made, world rules revealed, relationship changes,
//             key events that cannot be undone. Max 8 facts. No summaries. Only hard facts."
//    User: chapter.content
// 4. safeParseJson the response
// 5. Delete existing auto-extracted memories for this chapterId
// 6. Insert new memory records
// 7. Return { memories: [] }
```

**Trigger memory extraction:** In the chapter autosave debounce (in `updateChapter`),
after the PATCH call succeeds, fire-and-forget the extract-memory call:
```ts
// After chapter PATCH succeeds:
fetch(`/api/projects/${projId}/chapters/${chapId}/extract-memory`, {method:"POST"})
  .catch(()=>{}); // silent fail — background job
```

**UI in left panel Notes tab:**

Add a "Memory" sub-tab alongside Notes (or make it a fourth left tab: Bible / Style / Memory / Notes).

Memory tab renders:
- Memories grouped by category (Character Decisions, World Rules, Relationships, Events)
- Each memory as a chip with a ✕ delete button
- "+ Add memory" text input for manual additions
- Small indicator on the tab: "📝 24 facts"

**Inject memories into AI context:** In `buildContext()` and `buildCreatorContext()`,
append established memories at the bottom:
```ts
if (p.storyMemories?.length) {
  r.push("ESTABLISHED FACTS (do not contradict these):");
  p.storyMemories.forEach((m:any) => r.push(`- [${m.category}] ${m.fact}`));
}
```

**Load memories with project:** Update the `GET /api/projects/[projectId]` route
to include `storyMemories: true` in the `with` query.

---

**Run migration after Phase 3:**
```bash
copy .env.local .env
npm run db:push
```

---

---

# PHASE 4 — Surgical Prose Tools
**Stolen from: Sudowrite. Improved by: World Bible context awareness.**

## What This Phase Does

Adds three targeted rewrite tools that operate on *selected text* in Write mode.
These are not bulk generation — they are surgical tools that make specific
passages better without rewriting everything around them.

**What Sudowrite does:** Context-blind rewrites. Their tools don't know who
your characters are or what the location feels like.

**GhostWriter's version:** Every rewrite is injected with the World Bible
profiles of characters present in the selection, plus location atmosphere
if a location name is detected in the text. Same feature. Incomparably
richer output.

---

## 4a — Prose Rewrite API Route

**New file: `src/app/api/ai/prose/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const PROSE_PROMPTS = {
  expand: (ctx: string) =>
    `You are a prose expansion specialist. Take the given text and expand it
into a fuller, richer passage. Add sensory detail, ground the moment physically,
deepen the emotional texture. Do not change what happens — only enrich it.
Return ONLY the expanded text. No explanation, no preamble.
World context for characters and locations present:\n${ctx}`,

  rewrite: (ctx: string) =>
    `You are a prose rewriter. Generate EXACTLY 5 different rewrites of the given
text. Each rewrite should vary in tone, rhythm, or stylistic approach while
preserving the same events and meaning.
Return as JSON array of 5 strings: ["rewrite1", "rewrite2", ...]
No markdown fences, no explanation, only the JSON array.
World context:\n${ctx}`,

  "show-dont-tell": (ctx: string) =>
    `You are a "show don't tell" specialist. Rewrite the given text to eliminate
telling statements and replace them with specific sensory details, physical
actions, and concrete images. If a character feels afraid, show their hands.
If a location is gloomy, show the peeling paint. Never state an emotion directly.
Return ONLY the rewritten text. No explanation.
Character and location context:\n${ctx}`,
};

export async function POST(req: Request) {
  await getRequiredSession();
  const { text, mode, projectContext } = await req.json();

  if (!text?.trim() || !mode) {
    return NextResponse.json({ error: "text and mode required" }, { status: 400 });
  }

  const systemFn = PROSE_PROMPTS[mode as keyof typeof PROSE_PROMPTS];
  if (!systemFn) return NextResponse.json({ error: "invalid mode" }, { status: 400 });

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemFn(projectContext || ""),
    messages: [{ role: "user", content: text }],
  });

  const raw = msg.content.filter(b=>b.type==="text").map(b=>(b as any).text).join("");

  if (mode === "rewrite") {
    const clean = raw.replace(/```json\n?|```/g,"").trim();
    try {
      const variants = JSON.parse(clean);
      return NextResponse.json({ variants });
    } catch {
      return NextResponse.json({ variants: [raw] });
    }
  }

  return NextResponse.json({ result: raw });
}
```

---

## 4b — Prose Toolbar UI

**File: `src/components/GhostWriterApp.tsx`**

Add state:
```ts
const [selectedText, setSelectedText] = useState("");
const [selectedRange, setSelectedRange] = useState<{start:number,end:number}|null>(null);
const [proseResult, setProseResult] = useState<{mode:string, variants?:string[], result?:string}|null>(null);
const [proseLoading, setProseLoading] = useState(false);
```

Detect text selection in the Write mode textarea:
```ts
const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget;
  const selected = el.value.substring(el.selectionStart, el.selectionEnd);
  if (selected.trim().length > 10) {
    setSelectedText(selected);
    setSelectedRange({ start: el.selectionStart, end: el.selectionEnd });
  } else {
    setSelectedText("");
    setSelectedRange(null);
  }
};
```

When `selectedText` is non-empty, show a **floating toolbar** positioned
above the textarea (fixed position, centered):

```
┌──────────────────────────────────────────────┐
│  ✨ Expand   🔄 Rewrite   👁 Show Don't Tell │
└──────────────────────────────────────────────┘
```

Clicking any button:
1. Sets `proseLoading = true`
2. Calls `POST /api/ai/prose` with `{ text: selectedText, mode, projectContext: buildFullContext() }`
3. Opens a **Prose Result modal**

**Prose Result modal:**
- For Expand / Show Don't Tell: shows single result with
  [Replace Selection] and [Discard] buttons
- For Rewrite: shows 5 variant cards — user clicks one to select it,
  then [Use This] button replaces the selection

**Replace selection logic:**
```ts
const replaceSelection = (newText: string) => {
  if (!selectedRange) return;
  const content = activeChap.content;
  const updated = content.substring(0, selectedRange.start)
    + newText
    + content.substring(selectedRange.end);
  updateChapter("content", updated);
  setProseResult(null);
  setSelectedText("");
  setSelectedRange(null);
};
```

---

---

# PHASE 5 — Multi-Agent Writing Pipeline

## What This Phase Does

Users can run a sequential AI pipeline — specialized agents each handle one
job and pass their output to the next. Dramatically better results than a
single generate call.

---

## 5a — Pipeline Definitions

**New file: `src/lib/ai/pipelines.ts`**

```ts
export type AgentKey =
  "story_architect" | "scene_writer" | "character_voice" |
  "continuity_editor" | "hook_writer" | "seo_optimizer";

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
    formats: ["Novel","Screenplay","Web Series","YouTube Long-form","Podcast Episode"],
    modes: ["write"],
  },
  {
    id: "short_form",
    name: "Hook First",
    description: "Hook → Body. Built to stop the scroll.",
    agents: ["hook_writer", "scene_writer"],
    formats: ["YouTube Short","TikTok Script","Instagram Reel"],
    modes: ["write"],
  },
  {
    id: "creator_full",
    name: "Full Creator",
    description: "Hook → Body → SEO. Complete publishable piece.",
    agents: ["hook_writer", "scene_writer", "seo_optimizer"],
    formats: ["YouTube Long-form","YouTube Short","TikTok Script","Instagram Reel"],
    modes: ["write"],
  },
  {
    id: "structure_only",
    name: "Structure Pass",
    description: "Tight outline before committing to prose.",
    agents: ["story_architect"],
    formats: ["Novel","Screenplay","Web Series","YouTube Long-form","Podcast Episode"],
    modes: ["outline"],
  },
  {
    id: "dialogue_pass",
    name: "Dialogue Pass",
    description: "Sharpen every character's voice.",
    agents: ["character_voice"],
    formats: ["Novel","Screenplay","Web Series"],
    modes: ["write"],
  },
  {
    id: "seo_pack",
    name: "SEO Pack",
    description: "Titles, description, tags, thumbnail concept.",
    agents: ["seo_optimizer"],
    formats: ["YouTube Long-form","YouTube Short","TikTok Script","Instagram Reel","Podcast Episode"],
    modes: ["brainstorm","outline","write"],
  },
];

export const getPipelines = (format: string, mode: string) =>
  PIPELINES.filter(p => p.formats.includes(format) && p.modes.includes(mode));
```

---

## 5b — Pipeline API Route

**New file: `src/app/api/ai/pipeline/route.ts`**

```ts
// Each agent receives the previous agent's output as its input.
// Agents run sequentially. Return all intermediate outputs + final output.

const AGENT_SYSTEM: Record<string, (ctx:string, fmt:string) => string> = {
  story_architect: (ctx, fmt) =>
    `You are a Story Architect. Output a numbered structural outline only —
acts, beats, turning points. No prose. Format: ${fmt}.\nContext:\n${ctx}`,

  scene_writer: (ctx, fmt) =>
    `You are a Scene Writer. Turn the outline into vivid, grounded prose.
Show don't tell. Sensory detail in every scene. Match ${fmt} conventions.\nContext:\n${ctx}`,

  character_voice: (ctx, fmt) =>
    `You are a Character Voice Specialist. Rewrite dialogue so each character
sounds distinct. Reference character profiles from context.\nContext:\n${ctx}`,

  continuity_editor: (ctx, fmt) =>
    `You are a Continuity Editor. Find inconsistencies with established facts,
character profiles, and timeline. Flag each issue then output corrected version.\nContext:\n${ctx}`,

  hook_writer: (ctx, fmt) =>
    `You are a Hook Specialist for ${fmt}.
YouTube/Podcast: open loop that demands resolution.
TikTok/Shorts/Reels: first 3 words stop the scroll, no setup.
Novel/Screenplay: first line makes stopping impossible.
Output ONLY the hook.\nContext:\n${ctx}`,

  seo_optimizer: (ctx, _) =>
    `Output a structured SEO package:
1. TITLE OPTIONS (3 variants, ranked by CTR)
2. DESCRIPTION (150 words, keyword-rich but natural)
3. TAGS (15 tags)
4. THUMBNAIL CONCEPT (one sentence)
Context:\n${ctx}`,
};

// POST body: { agents: string[], prompt: string, context: string, format: string }
// Returns: { results: [{agent, output}], finalOutput: string }
```

---

## 5c — Pipeline UI

**File: `src/components/GhostWriterApp.tsx`**

Add state:
```ts
const [showAgents, setShowAgents] = useState(false);
const [pipelineRunning, setPipelineRunning] = useState(false);
const [pipelineResults, setPipelineResults] = useState<{agent:string,output:string}[]>([]);
const [expandedAgent, setExpandedAgent] = useState<string|null>(null);
```

Add **"⚡ Agents"** toggle button in the center panel top bar next to mode selector.

When `showAgents` is true, render an inline panel below the mode bar:
- Show pipeline cards for `getPipelines(project.format, mode)`
- Each card: name, description, [Run ▶] button
- While running: show "Running [agent name]..." step indicator
- After run: collapsible sections per agent, "Use Final Output" button on last

"Use Final Output" inserts into:
- Write mode → appended to chapter content
- Brainstorm/Outline → replaces `streamText`

---

---

# PHASE 6 — Script Export & Hook Scorer

## 6a — Format-Aware Export

**File: `src/components/GhostWriterApp.tsx`** — update `exportAll()`:

```ts
const exportAll = () => {
  const label = getChapterLabel(project.format);
  let txt = "";
  if (isCreatorFormat(project.format)) {
    txt += `${project.name.toUpperCase()}\nFormat: ${project.format}\n`;
    if (creatorBible?.channelName) txt += `Channel: ${creatorBible.channelName}\n`;
    txt += "─".repeat(40) + "\n\n";
    project.chapters.forEach((c:any) => {
      txt += `── ${label.toUpperCase()}: ${c.title} ──\n\n${c.content||"(empty)"}\n\n`;
    });
  } else {
    txt += `# ${project.name}\n${project.format} | ${project.genres.join(", ")}\n\n`;
    project.chapters.forEach((c:any) => {
      txt += `## ${c.title}\n\n${c.content||"(empty)"}\n\n`;
    });
  }
  navigator.clipboard.writeText(txt);
  setSavedMsg("Copied"); setTimeout(()=>setSavedMsg(""),1500);
};
```

---

## 6b — Hook Scorer

**New file: `src/app/api/ai/score-hook/route.ts`**

```ts
// POST body: { hook: string, format: string }
// Returns: { score: number, feedback: string }
// System: "You are a viral content expert. Rate this hook 1-10 on scroll-stopping power.
//          Explain in exactly 2 sentences. Return ONLY JSON: {score:N, feedback:'string'}"
// Use safeParseJson on response
```

In `GhostWriterApp.tsx`: for TikTok Script, YouTube Short, Instagram Reel only,
show a "Score Hook" button in the prompt bar. Score renders as colored badge:
🟢 8-10 | 🟡 5-7 | 🔴 1-4

---

---

# PHASE 7 — Character Relationship Graph
**Stolen from: Laper. Improved by: making it actionable, not just visual.**

## What This Phase Does

Auto-builds a visual graph showing which characters have appeared together
across all chapters. Laper shows you the problem. GhostWriter lets you
fix it in one click.

---

## 7a — Relationship Map API Route

**New file: `src/app/api/projects/[projectId]/relationship-map/route.ts`**

```ts
// GET — scan all chapters and return co-occurrence data
// 1. Verify ownership
// 2. Fetch chapters (content) + characters (name, id)
// 3. For each chapter, detect which character names appear in content
//    (simple string includes check on character.name)
// 4. Build edges: { charAId, charBId, charAName, charBName, sharedChapters: number }
// 5. Also flag: characters with ZERO shared scenes with any other character
// 6. Return { nodes: [{id, name, role, portraitUrl}], edges: [{...}], isolated: [{id,name}] }
```

---

## 7b — Relationship Map UI

**File: `src/components/GhostWriterApp.tsx`**

Add a "🕸 Map" button to the left panel World Bible tab header (story formats only).
When clicked, replaces the Bible list view with the relationship graph view.

**Render the graph as an SVG** inside the left panel:
- Each character = a circle node (show portraitUrl as circular avatar if available,
  otherwise show initials in accent color)
- Edges = lines between nodes, thickness proportional to `sharedChapters`
- Isolated characters (no shared scenes) = shown in red with ⚠️ indicator

**Actionable buttons below the graph:**
- Click any edge (two characters with a connection) → "✍️ Write scene with [A] and [B]"
  button appears — pre-fills the prompt with both character profiles loaded
- Click an isolated node → "⚠️ [Name] hasn't shared a scene with anyone. Write one?"
  button appears — pre-fills the Write mode prompt with that character

**"Write scene with" behavior:**
```ts
// Pre-fills the generate prompt:
setPrompt(`Write a scene where ${charA.name} and ${charB.name} interact.`);
setMode("write");
setShowAgents(false);
// The context will already include both character profiles via buildContext()
```

---

---

---

# PHASE 8 — Comic Studio (Higgsfield Soul 2.0)
**Powered by Higgsfield Soul 2.0 + Soul ID character consistency**

## What This Phase Does

Converts completed story chapters into illustrated comic panels using
**Higgsfield Soul 2.0** — their flagship image model with Soul ID character
training. Available for **story formats only** (Novel, Screenplay, Web Series).

**Why Higgsfield Soul 2.0 instead of gpt-image-2:**
- Soul ID trains a persistent digital identity per character — same face, body,
  and proportions across unlimited generations regardless of style or angle
- 70+ built-in art style presets (Manga, Noir, Watercolor, Anime, etc.)
- Up to 4K resolution per panel
- Same API and key that powers Phase 9 — one integration, one platform

**The workflow:**
1. Write story, build World Bible, generate character portraits (Phase 3)
2. GhostWriter uses each character's portraitUrl as the Soul ID reference
3. Click "Convert to Comic" on any chapter with content
4. Claude breaks the scene into 6 panel specs
5. Soul 2.0 generates all 6 panels — each panel referencing the character's
   portrait for identity consistency
6. User edits dialogue and captions in the panel editor
7. Export as a composite PNG

The story must exist first. A character with no portrait gets no Soul ID
reference — panels will still generate but character consistency is weaker.

---

## 8a — Install Packages & Higgsfield Client

```bash
npm install @vercel/blob
```

No npm package for Higgsfield — use native `fetch` via the client wrapper below.

**New file: `src/lib/higgsfield/client.ts`**

This is the single file that handles all Higgsfield API calls across Phases 8 and 9.
All functions accept an `apiKey` parameter — this is the user's own Higgsfield key
fetched from the DB, never hardcoded.

```ts
// API gateway: Segmind exposes Higgsfield models with a clean REST interface
const BASE = "https://api.segmind.com/v1";

// ── IMAGE GENERATION (Soul 2.0) ──────────────────────────────────────────────

export async function generateSoulImage(params: {
  apiKey: string;
  prompt: string;
  stylePreset?: string;       // e.g. "Manga", "Anime", "Noir", "Watercolor"
  referenceImageUrl?: string; // character portraitUrl for Soul ID consistency
  referenceStrength?: number; // 0.0-1.0, default 0.85
  seed?: number;
  width?: number;
  height?: number;
}): Promise<string> { // returns image URL
  const body: Record<string, any> = {
    prompt: params.prompt,
    seed: params.seed ?? Math.floor(Math.random() * 999999),
    enhance_prompt: true,
  };
  if (params.stylePreset)       body.style_preset = params.stylePreset;
  if (params.referenceImageUrl) {
    body.custom_reference_id  = params.referenceImageUrl;
    body.custom_reference_strength = params.referenceStrength ?? 0.85;
  }
  if (params.width)  body.width  = params.width;
  if (params.height) body.height = params.height;

  const res = await fetch(`${BASE}/higgsfield-text2image-soul`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Soul image failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  const url = data.image_url ?? data.output?.image_url;
  if (!url) throw new Error("No image URL in Soul response");
  return url;
}

// ── IMAGE-TO-VIDEO (DoP — Director of Photography) ───────────────────────────

export async function generateDoPVideo(params: {
  apiKey: string;
  prompt: string;
  imageUrl: string;
  model?: "dop-lite" | "dop-turbo" | "dop-preview";
  motionStrength?: number; // 0.0-1.0, default 0.7
  seed?: number;
}): Promise<{ requestId: string; pollingUrl: string }> {
  const res = await fetch(`${BASE}/higgsfield-image2video`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model ?? "dop-turbo",
      prompt: params.prompt,
      seed: params.seed ?? Math.floor(Math.random() * 999999),
      motion_strength: params.motionStrength ?? 0.7,
      image_urls: [params.imageUrl],
      enhance_prompt: true,
    }),
  });
  if (!res.ok) throw new Error(`DoP video failed (${res.status})`);
  const data = await res.json();
  return {
    requestId: data.request_id,
    pollingUrl: data.polling_url ?? `${BASE}/requests/${data.request_id}`,
  };
}

// ── TEXT-TO-VIDEO (Kling / Veo / Sora / Seedance / WAN) ─────────────────────

const VIDEO_ENDPOINTS: Record<string, string> = {
  kling:    "higgsfield-kling-text2video",
  veo:      "higgsfield-veo-text2video",
  sora:     "higgsfield-sora-text2video",
  seedance: "higgsfield-seedance-text2video",
  wan:      "higgsfield-wan-text2video",
};

export async function generateTextVideo(params: {
  apiKey: string;
  prompt: string;
  model: "kling" | "veo" | "sora" | "seedance" | "wan";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: 5 | 10 | 15;
  seed?: number;
}): Promise<{ requestId: string; pollingUrl: string }> {
  const endpoint = VIDEO_ENDPOINTS[params.model];
  if (!endpoint) throw new Error(`Unknown model: ${params.model}`);
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio ?? "16:9",
      duration: params.duration ?? 5,
      seed: params.seed ?? Math.floor(Math.random() * 999999),
      enhance_prompt: true,
    }),
  });
  if (!res.ok) throw new Error(`Video generation failed (${res.status})`);
  const data = await res.json();
  return { requestId: data.request_id, pollingUrl: data.polling_url };
}

// ── POLLING ───────────────────────────────────────────────────────────────────

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "ERROR";

export async function pollJob(params: {
  apiKey: string;
  pollingUrl: string;
}): Promise<{ status: JobStatus; mediaUrl?: string }> {
  const res = await fetch(params.pollingUrl, {
    headers: { "x-api-key": params.apiKey },
  });
  if (!res.ok) return { status: "ERROR" };
  const data = await res.json();
  return {
    status: data.status as JobStatus,
    mediaUrl: data.output?.media_url?.[0] ?? data.output?.image_url,
  };
}
```

---

## 8b — Schema Additions

**File: `src/db/schema.ts`:**

```ts
export const comicPages = pgTable("comic_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull().default(1),
  artStyle: text("art_style").notNull().default("manga"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comicPanels = pgTable("comic_panels", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id").notNull()
    .references(() => comicPages.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  panelIndex: integer("panel_index").notNull(),
  imageUrl: text("image_url").notNull(),
  panelPrompt: text("panel_prompt").notNull(),
  dialogue: text("dialogue").default(""),
  caption: text("caption").default(""),
  speakerName: text("speaker_name").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add full relations for both tables
// Add comicPages: many(comicPages) to projectsRelations and chaptersRelations
```

**Run migration:** `copy .env.local .env && npm run db:push`

---

## 8c — Panel Prompt Builder

**New file: `src/lib/ai/panel-prompt-builder.ts`**

```ts
export const ART_STYLES = [
  { id: "manga",          label: "Manga",         higgsfieldPreset: "Manga" },
  { id: "western",        label: "Western Comic",  higgsfieldPreset: "Comic Book" },
  { id: "graphic_novel",  label: "Graphic Novel",  higgsfieldPreset: "Graphic Novel" },
  { id: "watercolor",     label: "Watercolor",     higgsfieldPreset: "Watercolor" },
  { id: "noir",           label: "Noir",           higgsfieldPreset: "Dark Fantasy" },
  { id: "anime",          label: "Anime",          higgsfieldPreset: "Anime" },
  { id: "cartoon",        label: "Cartoon",        higgsfieldPreset: "Cartoon" },
];

// buildBreakdownPrompt(sceneContent, characters):
//   Asks Claude to return a JSON array of exactly 6 panel specs:
//   [{ beatIndex, action, characters[], location, shotType, mood }]
//   Rules: action is visual only, no dialogue, vary shot types

// buildPanelPrompt(spec, characters, artStyle, projectName) → string:
//   Returns the Soul 2.0 image prompt for one panel.
//   ALWAYS include character appearance from World Bible in prompt text.
//   ALWAYS end with: "No text, no speech bubbles, no captions in the image."
//   ALWAYS include: "Leave blank space at bottom 15% for dialogue overlay."
//   The higgsfieldPreset from the art style is passed as stylePreset to generateSoulImage()
//
// getCharacterReference(characterName, characters):
//   Returns the portraitUrl for the primary character in a panel.
//   Used as referenceImageUrl in generateSoulImage() for Soul ID consistency.
//   If multiple characters in panel, use the one listed first in spec.characters[].
//   If no portrait, pass undefined — Soul 2.0 still generates, just less consistent.
```

---

## 8d — Comic API Routes

**New file: `src/app/api/projects/[projectId]/comics/route.ts`**

```ts
// GET  — list comic pages with panels (verify ownership)
// POST — generate a new comic page
//
// POST body: { chapterId: string, artStyleId: string }
//
// Flow:
// 1. Verify project ownership
// 2. Fetch user.higgsfieldApiKey — if empty, return 400:
//    "Add your Higgsfield API key in Settings to generate comics."
// 3. Fetch chapter content — if empty, return 400:
//    "Write your story first, then come back to generate comic panels."
// 4. Fetch project characters with appearance + portraitUrl
// 5. Call Claude to break scene into 6 PanelSpecs (safeParseJson, validate length ≥ 1)
// 6. Build 6 Soul 2.0 prompts via buildPanelPrompt()
// 7. Generate panels (Promise.allSettled — partial success is OK):
//    For each panel:
//    a. Get character reference URL via getCharacterReference()
//    b. Call generateSoulImage({ apiKey, prompt, stylePreset, referenceImageUrl })
//    c. Upload to Vercel Blob: comics/{projectId}/{pageId}/panel-{i}.png
//       NEVER store base64 in DB — always Blob first, then URL
// 8. Insert comicPages record
// 9. Insert comicPanels records for successful panels
// 10. Return { page, panels, errors: failed[] }
```

**New file: `src/app/api/projects/[projectId]/comics/[pageId]/route.ts`**
```ts
// DELETE — delete page + all panels (verify ownership)
```

**New file: `src/app/api/projects/[projectId]/comics/[pageId]/panels/[panelId]/route.ts`**
```ts
// PATCH — update dialogue, caption, speakerName (verify ownership)
// Called by 1.5s debounce auto-save in the editor UI
```

**New file: `src/app/api/projects/[projectId]/comics/[pageId]/panels/[panelId]/regenerate/route.ts`**
```ts
// POST — regenerate a single panel
// 1. Fetch panel record (get panelPrompt, artStyle from parent page)
// 2. Fetch character portraitUrl for Soul ID reference
// 3. Fetch user.higgsfieldApiKey
// 4. Call generateSoulImage() with same prompt + referenceImageUrl
// 5. Upload to Vercel Blob (overwrite old path)
// 6. PATCH panel record with new imageUrl
// 7. Return { panel }
```

---

## 8e — ComicStudio Component

**New file: `src/components/ComicStudio.tsx`**
Props: `{ project: any, higgsfieldKey: string }`

**Generator view:**

```
🎨 Comic Studio — Powered by Higgsfield Soul 2.0

Select chapter:   [dropdown — only chapters with content ▼]
Art style:        [Manga] [Western] [Graphic Novel] [Watercolor] [Noir] [Anime] [Cartoon]

Character consistency:
  ✅ Arjun — portrait ready (Soul ID active)
  ⚠️ Priya — no portrait (add one in World Bible for best results)

                  [🎨 Convert to Comic]

If no Higgsfield key:
⚠️ "Add your Higgsfield API key in Settings to enable comics."

If no chapters have content:
⚠️ "Write your story first. Comic generation requires written content."

Loading steps shown during generation:
→ Analyzing scene structure...   (Claude call)
→ Generating panel 1/6...        (updates as each panel completes)
→ Saving artwork...
```

**Editor view — 2×3 panel grid:**
- Soul 2.0 image fills top 85% (object-fit: cover)
- Panel index badge top-left
- 🔄 Regenerate button top-right (spinner during regen)
- Below image: Speaker input, Dialogue textarea (2 rows), Caption input
- All three auto-save with 1.5s debounce (PATCH panel)
- Top bar: "← Generator", page selector "Page 1/3 ◀ ▶", "📤 Export PNG", "🎬 Animate in Studio"

**"🎬 Animate in Studio" button:**
Opens Production Studio (Phase 9) with this chapter's shots pre-filtered.
This is the natural bridge between comics and video.

**Canvas export:** Same as before — 1056×1584px, 2×3 grid, speech bubble overlays,
caption boxes, panel borders, download as PNG.

---

## 8f — Wire ComicStudio into GhostWriterApp

**File: `src/components/GhostWriterApp.tsx`**

1. Import ComicStudio
2. Load `higgsfieldKey` from `GET /api/user/settings` on mount
3. State: `const [showComicStudio, setShowComicStudio] = useState(false)`
4. Add "🎨 Comics" tab in center toolbar — **story formats only**
5. When active: `<ComicStudio project={project} higgsfieldKey={higgsfieldKey} />`

---

---

# PHASE 9 — Higgsfield Production Studio
**Full image + video generation pipeline inside GhostWriter**

## What This Phase Does

The Production Studio turns a finished story into a full visual production.
Users never leave GhostWriter to generate images or videos — everything
runs through the Higgsfield API from inside the app.

**Three-stage pipeline:**

```
STAGE 1 — PLAN          STAGE 2 — PREVIEW         STAGE 3 — PRODUCE
──────────────────       ─────────────────────      ────────────────────────
Claude generates    →    Soul 2.0 still image   →   DoP animates the still
shot list from           per shot. Fast, cheap.      OR Kling/Veo/Sora for
chapter content.         ~0.5 credits/shot.          full quality video.
                         Good for storyboarding.     20-50 credits/clip.
```

Users can stop at any stage. Stage 2 alone is valuable for storyboarding.
Stage 3 is for users who want actual video output.

**Model routing:**
| Use case | Model |
|----------|-------|
| Still previews (any scene) | Soul 2.0 |
| Animate a still | DoP (dop-turbo recommended) |
| Physics-aware motion, 4K | Kling 3.0 |
| Realistic/cinematic video | Veo 3.1 |
| Stylized narrative | Sora 2 |
| Talking head / lip-sync | WAN 2.5 |

---

## 9a — User Settings (Higgsfield API Key)

Users connect their own Higgsfield account. Their credits pay for generation.
GhostWriter orchestrates — users own the billing relationship with Higgsfield.

**Schema addition — `src/db/schema.ts`:**

Add to the `users` table (or wherever user records are stored):
```ts
higgsfieldApiKey: text("higgsfield_api_key").default(""),
```

Run migration after this addition.

**New file: `src/app/api/user/settings/route.ts`**

```ts
// GET  — return { higgsfieldKeySet: boolean, higgsfieldKeyLast4: string }
//        NEVER return the full key in a GET response
// PATCH — body: { higgsfieldApiKey: string }
//         Update user record. Return { success: true }.
// Both: verify session before touching user record
```

**Settings modal in dashboard** (see 9g below).

---

## 9b — Shot Parameters Library

**New file: `src/lib/ai/shot-parameters.ts`**

```ts
export const SHOT_TYPES = [
  "Establishing shot", "Wide shot", "Medium shot", "Close-up",
  "Extreme close-up", "Over-the-shoulder", "POV", "Bird's eye", "Worm's eye",
];

export const CAMERA_MOVEMENTS = [
  "Static", "Pan left", "Pan right", "Tilt up", "Tilt down",
  "Dolly in", "Dolly out", "Tracking shot", "Handheld", "Crane up",
];

export const LIGHTING_MOODS = [
  "Golden hour", "Blue hour", "Harsh midday", "Overcast soft",
  "Dramatic side light", "Backlit silhouette", "Neon night", "Candlelit",
  "Fluorescent cold", "Storm light",
];

export const TIME_OF_DAY = [
  "Dawn", "Morning", "Midday", "Afternoon",
  "Golden hour", "Dusk", "Night", "Deep night",
];

// PROMPT_TRANSLATIONS: maps each value to its Higgsfield prompt fragment
export const PROMPT_TRANSLATIONS: Record<string, string> = {
  "Golden hour":          "warm golden hour lighting, long shadows, lens flare, cinematic glow",
  "Neon night":           "neon-lit night, vibrant colored light reflections, urban atmosphere",
  "Blue hour":            "cool blue twilight, soft diffused light, moody atmosphere",
  "Dramatic side light":  "dramatic side lighting, strong shadows, chiaroscuro effect",
  "Backlit silhouette":   "strong backlight, subject silhouetted, glowing rim light",
  "Dolly in":             "slow cinematic dolly push-in, building tension, focus pull",
  "Handheld":             "handheld camera, slight organic movement, documentary immediacy",
  "Crane up":             "camera cranes upward, revealing scale, grand and epic",
  "Tracking shot":        "smooth tracking shot following subject, fluid motion",
  "Bird's eye":           "overhead bird's eye view, top-down, geometric perspective",
  "Extreme close-up":     "extreme close-up, macro detail, intimate and intense",
  "Over-the-shoulder":    "over-the-shoulder framing, depth of field, conversational",
  // add remaining parameter translations
};

export function buildShotPromptFragment(params: {
  shotType: string;
  cameraMovement: string;
  lightingMood: string;
  timeOfDay: string;
}): string {
  return [
    PROMPT_TRANSLATIONS[params.shotType]       || params.shotType,
    PROMPT_TRANSLATIONS[params.cameraMovement] || params.cameraMovement,
    PROMPT_TRANSLATIONS[params.lightingMood]   || params.lightingMood,
    `time of day: ${params.timeOfDay}`,
  ].filter(Boolean).join(", ");
}
```

---

## 9c — Production Schema

**File: `src/db/schema.ts`** — add:

```ts
export const productionShots = pgTable("production_shots", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id")
    .references(() => chapters.id, { onDelete: "set null" }),
  sceneNumber:        integer("scene_number").notNull().default(1),
  shotNumber:         integer("shot_number").notNull().default(1),
  shotType:           text("shot_type").default("Medium shot"),
  cameraMovement:     text("camera_movement").default("Static"),
  lightingMood:       text("lighting_mood").default("Golden hour"),
  timeOfDay:          text("time_of_day").default("Afternoon"),
  subject:            text("subject").default(""),
  action:             text("action").default(""),
  location:           text("location").default(""),
  mood:               text("mood").default(""),
  primaryCharacterId: uuid("primary_character_id")
    .references(() => characters.id, { onDelete: "set null" }),
  soulPrompt:         text("soul_prompt").default(""),   // Soul 2.0 image prompt
  videoPrompt:        text("video_prompt").default(""),  // video generation prompt
  dialogue:           text("dialogue").default(""),
  speaker:            text("speaker").default(""),
  // Generation outputs
  previewImageUrl:  text("preview_image_url").default(""),
  animatedVideoUrl: text("animated_video_url").default(""),
  finalVideoUrl:    text("final_video_url").default(""),
  generationStatus: varchar("generation_status", { length: 30 }).default("idle"),
  // idle | generating_preview | preview_ready | animating | animated
  // | generating_final | final_ready | error
  higgsfieldJobId:  text("higgsfield_job_id").default(""),
  sortOrder:        integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productionShotsRelations = relations(productionShots, ({ one }) => ({
  project: one(projects, {
    fields: [productionShots.projectId], references: [projects.id]
  }),
  chapter: one(chapters, {
    fields: [productionShots.chapterId], references: [chapters.id]
  }),
  primaryCharacter: one(characters, {
    fields: [productionShots.primaryCharacterId], references: [characters.id]
  }),
}));
// Add productionShots: many(productionShots) to projectsRelations
```

**Run migration:** `copy .env.local .env && npm run db:push`

---

## 9d — Production API Routes

**New file: `src/app/api/projects/[projectId]/production/generate-package/route.ts`**

```ts
// POST — Claude analyzes entire project and produces the shot list
//
// 1. Verify ownership
// 2. Fetch project with all relations (characters+portraitUrl, locations,
//    plotThreads, chapters ordered by sortOrder, referenceWorks, storyMemories)
// 3. Claude call (claude-sonnet-4-20250514, max_tokens: 8000):
//    Returns JSON:
//    {
//      projectBrief: { title, logline, format, genres, tone, styleNotes },
//      characterSheets: [{
//        characterId, name, role,
//        soulIdPrompt,  // Soul 2.0 optimised: face, hair, eyes, build, clothing. 3-4 sentences.
//        voiceNotes,
//      }],
//      locationSheets: [{ name, visualDescription, moodKeywords: string[] }],
//      shots: [{
//        sceneNumber, chapterId, chapterTitle, shotNumber,
//        shotType, cameraMovement, lightingMood, timeOfDay,
//        subject, action, location, mood,
//        primaryCharacterName,  // name only — route resolves to ID
//        soulPrompt,    // ready-to-use Soul 2.0 image prompt
//        videoPrompt,   // motion-oriented video prompt
//        dialogue, speaker,
//      }]
//    }
// 4. safeParseJson — return 500 with message on failure
// 5. Resolve primaryCharacterName → primaryCharacterId from project.characters
// 6. Delete existing productionShots for this project (re-generate = fresh slate)
// 7. Bulk insert all shots
// 8. Return { brief, characterSheets, locationSheets, shotCount: shots.length }
```

**New file: `src/app/api/projects/[projectId]/production/shots/route.ts`**
```ts
// GET — list all shots (with primaryCharacter relation) ordered by sceneNumber, shotNumber
// Verify ownership
```

**New file: `src/app/api/projects/[projectId]/production/shots/[shotId]/route.ts`**
```ts
// PATCH — update shot fields (shotType, cameraMovement, lightingMood, timeOfDay,
//          subject, action, soulPrompt, videoPrompt, dialogue, speaker)
// When shot parameters change, auto-rebuild prompts:
//   const fragment = buildShotPromptFragment({ shotType, cameraMovement, lightingMood, timeOfDay });
//   soulPrompt  = `${subject}. ${action}. ${location}. ${fragment}. Photorealistic portrait quality.`
//   videoPrompt = `${action}. ${location}. ${fragment}. Cinematic motion.`
// Verify ownership
```

**New file: `src/app/api/projects/[projectId]/production/shots/[shotId]/preview/route.ts`**
```ts
// POST — generate Soul 2.0 still preview for this shot
// 1. Verify ownership
// 2. Fetch user.higgsfieldApiKey — if empty, return 400
// 3. Fetch shot + primaryCharacter.portraitUrl
// 4. Update shot: generationStatus = "generating_preview"
// 5. Call generateSoulImage({ apiKey, prompt: shot.soulPrompt, referenceImageUrl: portraitUrl })
// 6. Upload to Vercel Blob: production/{projectId}/{shotId}/preview.jpg
// 7. Update shot: previewImageUrl, generationStatus = "preview_ready"
// 8. Return updated shot
```

**New file: `src/app/api/projects/[projectId]/production/shots/[shotId]/animate/route.ts`**
```ts
// POST — animate preview image into video clip via DoP
// Body: { dopModel?: "dop-lite" | "dop-turbo" | "dop-preview" }
// Requires previewImageUrl to exist — check before proceeding
// Returns { jobId, status: "animating" } immediately (async)
// Client polls /animate/status
```

**New file: `src/app/api/projects/[projectId]/production/shots/[shotId]/animate/status/route.ts`**
```ts
// GET — poll DoP animation job
// If status already "animated", return { status: "animated", videoUrl }
// Otherwise call pollJob() from higgsfield/client.ts
// On COMPLETED: upload to Vercel Blob, update shot animatedVideoUrl + status="animated"
// On FAILED/ERROR: update status="error"
// Return { status, videoUrl? }
```

**New file: `src/app/api/projects/[projectId]/production/shots/[shotId]/generate-video/route.ts`**
```ts
// POST — generate full quality video clip
// Body: { model: "kling" | "veo" | "sora" | "seedance" | "wan" }
// Calls generateTextVideo() from higgsfield/client.ts
// Returns { jobId, status: "generating_final" } — client polls /generate-video/status
```

**New file: `src/app/api/projects/[projectId]/production/shots/[shotId]/generate-video/status/route.ts`**
```ts
// GET — poll full video job (same pattern as animate/status)
// On COMPLETED: upload to Blob, update shot finalVideoUrl + status="final_ready"
```

**New file: `src/app/api/projects/[projectId]/production/preview-all/route.ts`**
```ts
// POST — generate Soul 2.0 previews for ALL shots in the project
// Process in batches of 3 (avoid rate limiting)
// Use Promise.allSettled per batch so one failure doesn't stop others
// Return { completed: N, total: N, errors: [] }
```

---

## 9e — ProductionStudio Component

**New file: `src/components/ProductionStudio.tsx`**
Props: `{ project: any, higgsfieldKey: string }`

**Sub-view 1 — Setup (when no shots exist):**

```
🎬 Production Studio

Your story is ready for production.
GhostWriter will analyze all chapters and generate a complete shot list
with Soul ID character profiles and Higgsfield-ready prompts.

                [⚡ Generate Shot List]   ~20-30 seconds

Loading: "Analyzing story... → Building shot list... → Writing character profiles..."
```

If no higgsfieldKey: show banner "⚠️ Add your Higgsfield API key in Settings
to enable image and video generation. The shot list will still be generated."

---

**Sub-view 2 — Shot List (main view):**

Top bar:
```
[← Back]   [🖼 Preview All Shots]   [♻️ Regenerate Shot List]   [📥 Export]   42 shots / 8 scenes
```

Shots grouped by scene (chapter):

```
━━ Scene 1 — Chapter 1: The Arrival ━━━━━━━━━━━━━━━━━

┌─ Shot 1 ──────────────────────────────────────────────────────────┐
│                           │  Shot Type:     [Wide shot ▼]         │
│   [preview image or       │  Camera:        [Static ▼]            │
│    grey placeholder]      │  Lighting:      [Golden hour ▼]       │
│                           │  Time of Day:   [Dusk ▼]              │
│                           │                                        │
│                           │  Subject: Arjun approaching station    │
│                           │  Action:  Walking through crowds       │
│                           │  Mood:    Tense                        │
│                           │                                        │
│                           │  Soul Prompt:   [editable textarea]    │
│                           │  Video Prompt:  [editable textarea]    │
│                           │                                        │
│  [🖼 Preview]             │  [🎬 Animate]   [Kling ▼  Generate]   │
│                           │                                        │
│  Dialogue: "Is anyone there?" — Arjun                              │
└───────────────────────────────────────────────────────────────────┘
```

**Shot card states:**

| Status | Visual |
|--------|--------|
| idle | Grey placeholder box + [🖼 Preview] |
| generating_preview | Spinner + "Generating preview..." |
| preview_ready | Soul 2.0 image + [🎬 Animate] + [Model▼ Generate Video] |
| animating | Video placeholder + spinner + "Animating (DoP)..." |
| animated | HTML5 video player + [Model▼ Generate Final] |
| generating_final | Spinner + "Generating [Kling 3.0]..." |
| final_ready | HTML5 video player + ✅ badge + [⬇ Download] |
| error | Red border + "Generation failed" + [Retry] |

**Parameter dropdowns:** When any dropdown changes, Soul Prompt and Video Prompt
update client-side immediately using `buildShotPromptFragment()`. PATCH fires
after 1s debounce.

**Video model selector:** Appears as a dropdown on the Generate Video button:
- Kling 3.0 — Physics-aware, 4K
- Veo 3.1 — Realistic/cinematic
- Sora 2 — Stylized narrative
- Seedance 2.0 — Fast social content
- WAN 2.5 — Lip-sync/talking head

**Polling:** After triggering animate or generate-video, UI polls status
every 3 seconds until `status === "animated"` or `"final_ready"`.

---

**Sub-view 3 — Export (from top bar):**

Renders the structured production brief for users who want to work outside GhostWriter:

```
PROJECT BRIEF         CHARACTER SHEETS         SHOT LIST         DIALOGUE
─────────────         ────────────────         ─────────         ────────
Logline: ...          [Character name]         Copy per-shot     Speaker: Line
Format: ...           Soul ID Prompt: [📋]     prompts or        grouped by scene
Tone: ...             Voice Notes: ...         [📋 Copy All]
```

[📥 Download Markdown] button generates and downloads `.md` file.

---

## 9f — Wire Production Studio into GhostWriterApp

**File: `src/components/GhostWriterApp.tsx`**

1. Import ProductionStudio
2. Load `higgsfieldKey` from `GET /api/user/settings` on mount (same call as Phase 8)
3. State: `const [showProductionStudio, setShowProductionStudio] = useState(false)`
4. Add "🎬 Studio" tab in center toolbar — **story formats only**
5. "🎨 Comics" and "🎬 Studio" are two separate tabs — user can switch between them
6. When active: `<ProductionStudio project={project} higgsfieldKey={higgsfieldKey} />`

---

## 9g — Settings Modal in Dashboard

**File: `src/app/dashboard/page.tsx`**

Add a ⚙️ Settings button to the dashboard header (next to Sign Out).

Settings modal:
```
⚙️ Settings

── Higgsfield Integration ──────────────────────────────

Higgsfield API Key
[••••••••••••••••••••  last4: a3f2]   [Update Key]

✅ Connected — Comics and Production Studio are enabled.

Get your key at: higgsfield.ai → Account → API Keys
Your credits pay for image and video generation directly.

[Save]  [Cancel]
```

On save: `PATCH /api/user/settings` with `{ higgsfieldApiKey }`.
On load: `GET /api/user/settings` → show ✅ or ⚠️ based on `higgsfieldKeySet`.

---

---

---

# DATABASE MIGRATIONS

Run these at the right time. Never skip the copy step.

**After Phase 2:**
```bash
copy .env.local .env
npm run db:push
```
*Adds: creatorBibles*

**After Phase 3:**
```bash
copy .env.local .env
npm run db:push
```
*Adds: storyMemories + linkedLocationIds/linkedPlotThreadIds on characters*

**After Phase 8:**
```bash
copy .env.local .env
npm run db:push
```
*Adds: comicPages, comicPanels*

**After Phase 9a + 9c:**
```bash
copy .env.local .env
npm run db:push
```
*Adds: higgsfieldApiKey on users, productionShots*

---

---

# Complete File Inventory

| File | Action |
|------|--------|
| `src/db/schema.ts` | Add creatorBibles, storyMemories, comicPages, comicPanels, productionShots + higgsfieldApiKey on users + all relations |
| `src/lib/higgsfield/client.ts` | **NEW** — Soul 2.0, DoP, text-to-video, polling |
| `src/lib/ai/engine.ts` | Add FORMAT_RULES, inject into generate(), add creatorBible to entity schemas |
| `src/lib/ai/context-builder.ts` | Add buildCreatorContext(), inject storyMemories into buildContext() |
| `src/lib/ai/pipelines.ts` | **NEW** — agent and pipeline definitions |
| `src/lib/ai/panel-prompt-builder.ts` | **NEW** — art styles, panel breakdown, Soul 2.0 prompt builder |
| `src/lib/ai/shot-parameters.ts` | **NEW** — shot params + Higgsfield prompt translations |
| `src/components/GhostWriterApp.tsx` | Formats, Creator Bible, Story Memory, Prose toolbar, Agents panel, Comics tab, Studio tab, Relationship Map, settings load |
| `src/components/ComicStudio.tsx` | **NEW** — comic generator + panel editor (Soul 2.0) |
| `src/components/ProductionStudio.tsx` | **NEW** — shot list, preview, animate, video generation |
| `src/app/api/ai/prose/route.ts` | **NEW** — expand / rewrite / show-dont-tell |
| `src/app/api/ai/pipeline/route.ts` | **NEW** — multi-agent pipeline |
| `src/app/api/ai/score-hook/route.ts` | **NEW** — hook scorer |
| `src/app/api/user/settings/route.ts` | **NEW** — get/update Higgsfield API key |
| `src/app/api/projects/[projectId]/creator-bible/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/suggest-links/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/story-memories/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/chapters/[chapterId]/extract-memory/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/characters/[characterId]/portrait/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/relationship-map/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/comics/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/comics/[pageId]/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/comics/[pageId]/panels/[panelId]/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/comics/[pageId]/panels/[panelId]/regenerate/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/generate-package/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/shots/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/shots/[shotId]/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/shots/[shotId]/preview/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/shots/[shotId]/animate/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/shots/[shotId]/animate/status/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/shots/[shotId]/generate-video/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/shots/[shotId]/generate-video/status/route.ts` | **NEW** |
| `src/app/api/projects/[projectId]/production/preview-all/route.ts` | **NEW** |
| `src/app/dashboard/page.tsx` | Add Settings button + modal |
| `package.json` | Add @vercel/blob (remove openai — no longer needed) |
| `CLAUDE.md` | Update env vars list |

---

---

# Strict Implementation Order

**Do not skip steps. Test each phase before starting the next.**

```
PHASE 2 — Creator Formats
  2a → 2b → 2c → db:push → 2d → 2e → 2f → 2g
  TEST: Create YouTube project. Verify Creator Bible saves/loads.
        AI generation uses format rules. Chapter label shows "Beat".

PHASE 3 — World Bible Intelligence
  3a (portraits) → 3b (cross-linking) → 3c (story memory) → db:push
  TEST: Generate a character portrait. Verify portraitUrl saved.
        Write 3 chapters. Run Suggest Links. Confirm a link.
        Memory chips appear in Memory tab after chapter save.

PHASE 4 — Surgical Prose Tools
  4a → 4b
  TEST: Select text in Write mode. Floating toolbar appears.
        Run Expand. Result modal opens. Replace selection works.
        Run Rewrite. 5 variants appear. Choose one.

PHASE 5 — Multi-Agent Pipeline
  5a → 5b → 5c
  TEST: Run Full Write pipeline on a Novel chapter.
        Each agent output appears in collapsible sections.
        "Use Final Output" inserts into chapter content.

PHASE 6 — Export & Hook Scorer
  6a → 6b
  TEST: Export a YouTube project. Verify creator-format output.
        Score a TikTok hook. Colored badge appears.

PHASE 7 — Relationship Graph
  7a → 7b
  TEST: Write 3+ chapters mentioning same characters.
        Open Map view. Edges appear between characters.
        Click edge. "Write scene with" pre-fills prompt.

PHASE 8 — Comics (Higgsfield Soul 2.0)
  8a (install @vercel/blob, write higgsfield/client.ts)
  → 8b (schema) → db:push
  → 8c (panel-prompt-builder)
  → 8d (API routes)
  → 8e (ComicStudio component)
  → 8f (wire into GhostWriterApp)
  TEST: Add Higgsfield API key in Settings.
        Generate character portrait. Verify portraitUrl saved.
        Write a scene. Convert to Comic. Verify 6 panels generate.
        Edit dialogue. Auto-save fires. Export PNG renders correctly.

PHASE 9 — Production Studio
  9a (user settings schema + API route) → db:push for higgsfieldApiKey
  → 9b (shot-parameters.ts)
  → 9c (productionShots schema) → db:push
  → 9d (all production API routes)
  → 9e (ProductionStudio component)
  → 9f (wire into GhostWriterApp)
  → 9g (Settings modal in dashboard)
  TEST: Generate shot list for a 3-chapter story. Verify shots saved.
        Change a shot type dropdown. Verify Soul Prompt updates.
        Click Preview on one shot. Verify Soul 2.0 image appears.
        Click Animate. Poll status. Verify video player shows clip.
        Click Generate Video (Kling). Poll. Verify final video appears.
        Download Export markdown. Verify all sections present.
```

---

---

# Hard Rules for Claude Code

1. **Phase 1 is done. Do not touch Phase 1 files** unless fixing a regression.
2. **Every API route verifies project ownership** — `projects.userId === session.user.id` before every DB operation, no exceptions.
3. **Never store base64 image data in the database.** Upload to Vercel Blob, store the URL.
4. **Always `copy .env.local .env` before `npm run db:push`** — drizzle-kit does not read `.env.local`.
5. **Comics, Production Studio, and Relationship Graph are story formats only.** Check `isStoryFormat()` before rendering these features.
6. **All Higgsfield calls go through `src/lib/higgsfield/client.ts`.** No direct fetch to Higgsfield from components or other files.
7. **All Anthropic Claude calls stay in `src/lib/ai/engine.ts` and route handlers.** No direct SDK use in components.
8. **OpenAI is permitted only for embeddings (`text-embedding-3-small`, craft library search) and Audio Novel TTS (`tts-1`).** The "no OpenAI for generation" intent applies to story/text generation only — Higgsfield replaces OpenAI for image/video. Do not add new OpenAI usage outside these two features without updating this rule.
9. **Higgsfield API key is the user's own key** — fetched from user.higgsfieldApiKey record and passed to client functions. Never use a hardcoded key.
10. **Never return higgsfieldApiKey in full from any GET route.** Return `higgsfieldKeySet: boolean` and `higgsfieldKeyLast4: string` only.
11. **Story Memory extraction uses `claude-haiku-4-5`** — cheap background job. All other Claude calls use `claude-sonnet-4-20250514`.
12. **Production video polling runs every 3 seconds on the client.** Stop polling when status is `final_ready`, `animated`, or `error`.
13. **Do not redesign the existing UI.** Add new sections and tabs only. Colors, layout, and theme stay identical.
14. **Do not add real-time collaboration.** Not in scope for any phase.
15. **safeParseJson on every AI response that expects JSON.** No raw JSON.parse anywhere.
