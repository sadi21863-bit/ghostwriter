# Upgrade Opportunities — Research (2026)

Prioritized, research-grounded upgrades. ✅ = shipped this session.

## Higgsfield / media
- ✅ **Soul resolution tier** — previews now use the cheaper 720p band (~$0.12) vs full-res keepers (~$0.23). (`generateSoulImage({ quality: "preview" })`; storyboard previews wired.)
- ✅ **Image-to-video default → `dop-lite`** (~$0.14 vs `dop-turbo` ~$0.42).
- **Webhooks: NOT available** on Segmind *model* APIs (polling-only; `poll_url`). Webhooks/signed-delivery exist only on Segmind's **AI Gateway** product — worth adopting if/when render volume grows. Keep current (hardened) polling for now.
- **Model identity is already current** in `models.ts` (Kling 3.0, Veo 3.1, Seedance 2.0, WAN, Hailuo; Sora deprecated). Suggested per-tier routing:
  - **Storyboard preview** → Seedance 2.0 / `dop-lite` (benchmark-leading value ~$0.022/s).
  - **Final export** → Veo 3.1 (native 4K + native audio) or Kling 3.0 (human realism/physics).
  - Encode this as a `renderTier` on the generate-video route (preview vs export) instead of a single client-chosen model.
- Bump WAN note 2.5→2.6 (label only; verify Segmind slug before changing endpoint).

## LLM cost / quality (Anthropic — models kept as assigned)
- **Prompt caching 1-hour TTL** (`cache_control: { type: "ephemeral", ttl: "1h" }`) for the static story-bible block — fewer cache misses across a writing session → real token savings. (Currently default 5-min TTL.)
- **Batch API (50% cheaper)** for non-interactive work: chapter summaries, Style DNA, work-packet analysis, embeddings backfill. These don't need real-time latency.
- **Extended thinking** for the planner & critic steps only (Scene Blueprint, Polish) — deeper reasoning where it matters, cheap models elsewhere.
- **Embeddings**: confirm `text-embedding-3-small` (cheap) for exemplar retrieval; consider 3-large only if recall is weak.

## Storytelling architecture (from STORYTELLING_ARCHITECTURE.md)
- ✅ Planner (Scene Blueprint, now visible/editable), ✅ Critic-Editor (Polish), ✅ Promise Ledger, ✅ Style-Exemplar retrieval, ✅ deterministic Prose-Rhythm guard.
- **Remaining P2:** write-time **continuity contradiction check** (cross-check named facts/deaths/objects vs `storyMemories` before accepting a draft) — you already compute `knowledgeShifts`/`isDeceased`; wire them into a guard.

## Platform
- **Auth:** add Google login (creds pending).
- **Streaming everywhere:** extend token streaming to the library modes (currently Write only).
- **Stripe-style usage meter UI**: surface per-generation cost/latency (esp. Higgsfield credits) so users choose speed vs quality consciously.

## Priority order
1. Prompt-cache 1h TTL + Batch API for summaries/analysis (biggest cost win, low risk).
2. `renderTier` on video routes (preview→Seedance/lite, export→Veo/Kling).
3. Continuity contradiction guard.
4. Google login; streaming for library modes.
