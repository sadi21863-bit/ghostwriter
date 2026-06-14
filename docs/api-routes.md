# API Routes

All API endpoints with auth requirements, subscription gates, and descriptions.

---

## Conventions

Every route follows this pattern:

```typescript
export async function POST(req: Request, { params }) {
  const session = await getRequiredSession();          // 401 if not logged in
  const rl = await checkAiRateLimit(session.user.id); // 429 if over rate limit
  if (rl) return rl;
  const tier = await getUserTier(session.user.id);    // subscription tier
  if (!canAccessFeature(tier, "feature")) {           // 403 if not subscribed
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }
  // ... route logic
}
```

Response format for errors:
```json
{ "error": "error_code", "feature": "feature_name" }
```

---

## AI Routes: `/api/ai/`

### Core Generation

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/ai/generate` | Required | mode-dependent | Main generation — `mode` param selects which of 26 modes (3 core + 23 library, see `MODE_REGISTRY`) to use |
| POST | `/api/ai/entity` | Required | any | Generate character/location/plot thread |
| POST | `/api/ai/suggest` | Required | any | Inline suggestions while writing |
| POST | `/api/ai/summarize` | Required | any | Summarize a chapter |
| POST | `/api/ai/quick-start` | Required | any | Generate a story skeleton from a premise |

### Analysis Routes

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/ai/analyze-work` | Required | story_pro | Analyse a reference work for Style DNA |
| POST | `/api/ai/score-hook` | Required | creator_pro | Score a hook's virality potential |

### Creator Tool Routes

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/ai/prose` | Required | creator_pro | Enhance non-fiction prose |
| POST | `/api/ai/hook-ab` | Required | creator_pro | A/B test two hook variations |
| POST | `/api/ai/tiktok-native` | Required | creator_pro | Generate TikTok hooks or full script |
| POST | `/api/ai/repurpose` | Required | creator_pro | Repurpose content across platforms |
| POST | `/api/ai/research-scaffold` | Required | creator_pro | Generate research structure and angles |
| POST | `/api/ai/retention-edit` | Required | creator_pro | Pacing and retention analysis + edit |
| POST | `/api/ai/thumbnail-concepts` | Required | creator_pro | YouTube thumbnail concept generation |
| POST | `/api/ai/creator-seo` | Required | creator_pro | SEO keyword and title optimization |
| POST | `/api/ai/channel-autopsy` | Required | creator_pro | Full YouTube channel analysis |
| POST | `/api/ai/guest-intel` | Required | creator_pro | Guest research brief |
| POST | `/api/ai/scene-to-video-prompt` | Required | creator_pro | Convert scene text to video prompt |
| POST | `/api/ai/pipeline` | Required | creator_pro | Content pipeline planning |
| POST | `/api/ai/title-hook` | Required | creator_pro | Generate title + hook combinations |

### Trend Routes

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/ai/trend-youtube` | Required | creator_pro | YouTube trend analysis |
| POST | `/api/ai/trend-instagram` | Required | creator_pro | Instagram trend analysis |
| POST | `/api/ai/trend-angles` | Required | creator_pro | Generate angles from trend data (Haiku) |
| POST | `/api/ai/trend-niche` | Required | creator_pro | Niche-specific trend research |
| POST | `/api/ai/virality-predict` | Required | creator_pro | Virality prediction score |

### Video Dissection

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/ai/dissect-video` | Required | creator_pro | Start video analysis job (async) |
| GET | `/api/ai/dissect-video/status/[jobId]` | Required | creator_pro | Poll job status |

### Series Planning

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/ai/series-plan` | Required | creator_pro | Generate a content series plan |

---

## Project Routes: `/api/projects/`

### Project CRUD

| Method | Route | Auth | Ownership | Description |
|---|---|---|---|---|
| GET | `/api/projects` | Required | userId filter | List user's projects |
| POST | `/api/projects` | Required | auto-assign | Create project |
| GET | `/api/projects/[projectId]` | Required | checked | Get project with full detail |
| PUT | `/api/projects/[projectId]` | Required | checked | Update project fields |
| DELETE | `/api/projects/[projectId]` | Required | checked | Delete project + all children |
| POST | `/api/projects/import/scrivener` | Required | auto-assign | Import from Scrivener ZIP |

### Chapter Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[projectId]/chapters` | Required | List chapters |
| POST | `/api/projects/[projectId]/chapters` | Required | Create chapter |
| GET | `/api/projects/[projectId]/chapters/[chapterId]` | Required | Get chapter content |
| PUT | `/api/projects/[projectId]/chapters/[chapterId]` | Required | Update content (auto-save) |
| DELETE | `/api/projects/[projectId]/chapters/[chapterId]` | Required | Delete chapter |
| POST | `/api/projects/[projectId]/chapters/[chapterId]/alt-draft` | Required (story_pro) | Generate alt draft |
| POST | `/api/projects/[projectId]/chapters/[chapterId]/extract-memory` | Required | Extract story memories (Haiku) |
| POST | `/api/projects/[projectId]/chapters/fork` | Required (story_pro) | Fork a chapter into a branch |

### Character Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[projectId]/characters` | Required | List characters |
| POST | `/api/projects/[projectId]/characters` | Required | Create character |
| GET | `/api/projects/[projectId]/characters/[characterId]` | Required | Get character |
| PUT | `/api/projects/[projectId]/characters/[characterId]` | Required | Update character |
| DELETE | `/api/projects/[projectId]/characters/[characterId]` | Required | Delete character |
| POST | `/api/projects/[projectId]/characters/[characterId]/evolution` | Required (story_pro) | Log evolution event |
| POST | `/api/projects/[projectId]/characters/[characterId]/portrait` | Required (story_pro) | Generate portrait (Soul 2.0) |
| POST | `/api/projects/[projectId]/characters/[characterId]/soul-id` | Required (story_pro) | Train Soul ID |

### Location Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET, POST | `/api/projects/[projectId]/locations` | Required | List / create |
| GET, PUT, DELETE | `/api/projects/[projectId]/locations/[locationId]` | Required | Get / update / delete |

### Plot Thread Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET, POST | `/api/projects/[projectId]/plot-threads` | Required | List / create |
| GET, PUT, DELETE | `/api/projects/[projectId]/plot-threads/[threadId]` | Required | Get / update / delete |

### Story Intelligence Routes

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| GET, POST | `/api/projects/[projectId]/story-memories` | Required | story_pro | Story memory CRUD |
| GET | `/api/projects/[projectId]/story-state` | Required | story_pro | Current story continuity state |
| GET, POST | `/api/projects/[projectId]/checkpoints` | Required | story_pro | Story checkpoints |
| GET, POST | `/api/projects/[projectId]/reference-works` | Required | story_pro | Reference work management |
| GET, PUT | `/api/projects/[projectId]/reference-works/[refId]` | Required | story_pro | Update reference work |
| GET, POST | `/api/projects/[projectId]/relationship-map` | Required | story_pro | Character relationship graph |
| GET | `/api/projects/[projectId]/dead-scenes` | Required | story_pro | Archived/cut scenes |
| POST | `/api/projects/[projectId]/suggest-links` | Required | story_pro | Suggest connections between elements |

### Quality Analysis Routes

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/projects/[projectId]/quality-check` | Required | story_pro | Full quality review (Haiku + Sonnet) |
| POST | `/api/projects/[projectId]/arc-heatmap` | Required | story_pro | Emotional arc per chapter |
| POST | `/api/projects/[projectId]/tension-curve` | Required | story_pro | Tension analysis |
| POST | `/api/projects/[projectId]/theme-tracker` | Required | story_pro | Thematic consistency check |
| POST | `/api/projects/[projectId]/scene-validator` | Required | story_pro | Scene logic validation (Haiku) |
| POST | `/api/projects/[projectId]/transportation-check` | Required | story_pro | Narrative transportation analysis (Haiku) |
| POST | `/api/projects/[projectId]/villain-pov` | Required | story_pro | Generate villain perspective scene |
| POST | `/api/projects/[projectId]/intentional-violation` | Required | story_pro | Track intentional style rule breaks |

### World Bible

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/projects/[projectId]/world-bible/infer` | Required | story_pro | Infer world rules from chapters |
| GET, PUT | `/api/projects/[projectId]/creator-bible` | Required | creator_pro | Creator channel bible |

### Comic Studio

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| GET, POST | `/api/projects/[projectId]/comics` | Required | story_pro | List / create comic pages (Haiku panel descriptions) |
| GET, PUT | `/api/projects/[projectId]/comics/[pageId]` | Required | story_pro | Get / update page |
| GET, PUT | `/api/projects/[projectId]/comics/[pageId]/panels/[panelId]` | Required | story_pro | Get / update panel |
| POST | `/api/projects/[projectId]/comics/[pageId]/panels/[panelId]/regenerate` | Required | story_pro | Regenerate panel image (Soul 2.0) |
| GET | `/api/projects/[projectId]/comics/export` | Required | story_pro | Export comic as ZIP |

### Production Studio

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| GET, POST | `/api/projects/[projectId]/production/shots` | Required | story_pro | List / create shots |
| GET, PUT | `/api/projects/[projectId]/production/shots/[shotId]` | Required | story_pro | Get / update shot |
| POST | `/api/projects/[projectId]/production/shots/[shotId]/preview` | Required | story_pro | Generate still preview (Soul 2.0) |
| POST | `/api/projects/[projectId]/production/shots/[shotId]/animate` | Required | story_pro | Animate with DoP (image-to-video) |
| GET | `/api/projects/[projectId]/production/shots/[shotId]/animate/status` | Required | story_pro | Poll animation status |
| POST | `/api/projects/[projectId]/production/shots/[shotId]/generate-video` | Required | story_pro | Generate text-to-video |
| GET | `/api/projects/[projectId]/production/shots/[shotId]/generate-video/status` | Required | story_pro | Poll video status |
| POST | `/api/projects/[projectId]/production/preview-all` | Required | story_pro | Preview all shots |
| POST | `/api/projects/[projectId]/production/generate-package` | Required | story_pro | Export production package |

### Export

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/projects/[projectId]/export/manuscript` | Required | story_pro | Export DOCX manuscript |
| POST | `/api/projects/[projectId]/export/blurb` | Required | story_pro | Generate book blurb |
| POST | `/api/projects/[projectId]/export/query-letter` | Required | story_pro | Generate query letter |
| POST | `/api/projects/[projectId]/export/episode-pack` | Required | creator_pro | Export episode pack |

### Reader / Sharing

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/projects/[projectId]/reader-session` | Required | Create share token |
| GET | `/api/reader/[token]` | None | Public read-only access |

---

## Audio Routes

| Method | Route | Auth | Tier | Description |
|---|---|---|---|---|
| POST | `/api/audio/generate` | Required | story_pro | Text-to-speech for chapter |
| POST | `/api/audio/lipsync` | Required | story_pro | Lipsync video from audio |

---

## Work Packets (Craft Library)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/work-packets` | Required | List craft principles |
| POST | `/api/work-packets/embed` | Required (admin) | Trigger embedding backfill |
| POST | `/api/work-packets/search` | Required | Semantic search over craft library |
| GET | `/api/work-packets/patterns` | Required | List writing pattern templates |

---

## Authentication Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| ANY | `/api/auth/[...nextauth]` | — | NextAuth handler (login, logout, session) |
| POST | `/api/auth/register` | None | User registration |
| POST | `/api/auth/forgot-password` | None | Send password reset email |
| POST | `/api/auth/reset-password` | None | Complete password reset |

---

## Subscription Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/subscription` | Required | Get current subscription tier and status |
| POST | `/api/subscription` | Required | Create Razorpay subscription (returns subscriptionId for checkout overlay) |
| POST | `/api/webhooks/razorpay` | None (HMAC-SHA256 verified) | Razorpay event handler — activates/cancels subscriptions, applies referral rewards |

---

## User Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET, PUT | `/api/user/settings` | Required | User preferences |
| GET | `/api/user/referrals` | Required | Referral tracking |

---

## Series Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET, POST | `/api/series-bibles` | Required | List / create series bibles |
| GET, PUT | `/api/series-bibles/[id]` | Required | Get / update series bible |

---

## Admin Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/analytics` | Required (admin) | Platform analytics |
| POST | `/api/admin/seed-work-packets` | Required (admin) | Seed 18 platform work packets (idempotent) |

---

## Cron Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/cron/cleanup` | Bearer token | Daily cleanup of expired reader sessions, stale jobs |
