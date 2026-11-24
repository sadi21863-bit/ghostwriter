# Legacy schema diff (Phase -1A)

Generated from `legacy-schema-inventory.json` (observed production) vs `src/db/schema.ts` vs `drizzle/*.sql`.

- **Captured:** 2026-10-03T19:58:18.947Z
- **Source:** ep-weathered-dawn-a1coz6bh-pooler.ap-southeast-1.aws.neon.tech (read-only introspection)
- **PostgreSQL:** extensions plpgsql, vector

## Verdict

| Metric | Count |
|---|---|
| Tables in production | 41 |
| Tables declared in `schema.ts` | 41 |
| Tables with a `CREATE TABLE` migration | 40 |
| Tables whose columns are **fully** covered by migration history | 29 |
| Tables with column gaps | 12 |
| Columns never captured in any migration | 37 |
| Total columns (production) | 543 |
| Foreign keys | 54 |
| Indexes | 50 |

> ### The migration history is table-complete but column-incomplete.
>
> All but one table have a `CREATE TABLE` migration, which makes the history *look* authoritative. It is not: **12 tables are missing 37 columns** that exist in production, because those columns were added with `drizzle-kit push` (which writes no migration file).
>
> This is more dangerous than missing tables. A fresh `drizzle-kit migrate` produces every table but omits columns like `projects.density_level`, `characters.embedding`, `production_shots.quality_score` and all of `showcases`. Those failures surface as runtime "column does not exist" errors deep inside a route, not as an obvious schema error at deploy time.

> **Correction to earlier audit notes.** An earlier pass reported "30 of 41 tables have no migration". That was wrong — it compared Drizzle *export* names (`plotThreads`) against SQL table names (`plot_threads`) and so counted every multi-word table as missing. Table coverage is 40/41, not 11/41. The column-level gap above is the accurate finding.

## Column coverage of migration history

29 of 41 tables are fully covered by their migration. The remaining 12 would be created **with missing columns** by `drizzle-kit migrate`.

| Table | Missing columns | Count |
|---|---|---|
| `**showcases** (no CREATE TABLE)` | `blurb`, `created_at`, `embedding`, `flag_reason`, `flagged`, `id`, `project_id`, `slug`, `title`, `updated_at`, `user_id`, `visibility` | 12 |
| `production_shots` | `candidate_preview_urls`, `generation_error`, `quality_note`, `quality_score`, `quality_weakest`, `review_status`, `scene_audio_track_url`, `trim_end_sec`, `trim_start_sec` | 9 |
| `comic_panels` | `candidate_image_urls`, `character_name`, `quality_note`, `quality_score`, `quality_weakest`, `review_status` | 6 |
| `characters` | `embedding`, `soul_id_training_job_id` | 2 |
| `audio_exports` | `mode` | 1 |
| `chapters` | `embedding` | 1 |
| `locations` | `embedding` | 1 |
| `story_promises` | `embedding` | 1 |
| `users` | `tts_provider_id` | 1 |
| `work_packets` | `embedding` | 1 |
| `work_patterns` | `embedding` | 1 |
| `world_entities` | `embedding` | 1 |

Every column in the "Missing" column above exists in production and is exercised by application code. `legacy-baseline.sql` is generated from the live catalog and therefore contains all of them.

## Table presence

### In production but with no migration file (1)

These exist in the live database and in `schema.ts`, but a fresh `drizzle-kit migrate` would not create them:

`showcases`

### Declared in `schema.ts` but absent from production

None. The application model and the live schema agree on table membership.

## Column divergence between production and `schema.ts`

None. Every production column is declared in `schema.ts` and vice versa.

## Migration-history defects

### Duplicate migration files

- `0002_lively_thing.sql` / `0005_previous_cable.sql` / `0012_overconfident_red_hulk.sql` — identical byte length.
  - Referenced by the journal: `0002_lively_thing.sql`, `0005_previous_cable.sql`, `0012_overconfident_red_hulk.sql`
- `0007_cool_rocket_raccoon.sql` / `0007_silky_puppet_master.sql` — identical byte length.
  - **Orphaned** (absent from `_journal.json`): `0007_cool_rocket_raccoon.sql`
  - Referenced by the journal: `0007_silky_puppet_master.sql`

Per v4 §6.3 these are documented, not deleted. Removing the orphan requires confirming its checksum and journal status first.

### Index ownership

Production has 50 public indexes. `scripts/add-indexes.js` creates only 10 and swallows failures in a try/catch, so it cannot be treated as the source of truth. `legacy-indexes.sql` now carries the observed set.

One script statement references `pwd_reset_tokens` while the table is `password_reset_tokens`; it fails silently. The live database is correct — `password_reset_tokens` is indexed and no typo'd index exists.

## Constraint findings requiring a decision (v4 §6.3)

### `semantic_cache` has no uniqueness guarantee

Observed indexes: `semantic_cache_pkey`.

`semantic-cache.ts` and `headroom-summarize.ts` both call `.onConflictDoNothing()` with no conflict target. Without a unique constraint on `(cache_type, input_key)` that clause cannot dedupe, so concurrent identical writes insert duplicate rows. **Decision required:** add the unique constraint, or drop the dedupe assumption.

### Soft UUID references (51 columns)

These are `uuid` columns with no foreign key. Per v4 §6.3 each must be declared either an FK with defined delete semantics or a documented soft reference with validation:

| Table | Column |
|---|---|
| `accounts` | `id` |
| `audio_exports` | `id` |
| `audio_exports` | `chapter_id` |
| `chapters` | `id` |
| `chapters` | `parent_chapter_id` |
| `character_evolution_log` | `id` |
| `character_relationships` | `id` |
| `characters` | `id` |
| `comic_pages` | `id` |
| `comic_panels` | `id` |
| `creator_bibles` | `id` |
| `editor_notes` | `id` |
| `email_verification_tokens` | `id` |
| `generations` | `id` |
| `locations` | `id` |
| `password_reset_tokens` | `id` |
| `platform_events` | `id` |
| `plot_threads` | `id` |
| `plot_threads` | `last_mentioned_chapter_id` |
| `production_shots` | `id` |
| `project_character_states` | `id` |
| `projects` | `id` |
| `projects` | `universe_id` |
| `projects` | `series_parent_id` |
| `projects` | `adapted_from_project_id` |
| `reader_reactions` | `id` |
| `reader_sessions` | `id` |
| `reference_works` | `id` |
| `referrals` | `id` |
| `semantic_cache` | `id` |
| `series_bibles` | `id` |
| `sessions` | `id` |
| `showcases` | `id` |
| `story_checkpoints` | `id` |
| `story_memories` | `id` |
| `story_plans` | `id` |
| `story_promises` | `id` |
| `story_promises` | `setup_chapter_id` |
| `story_promises` | `payoff_chapter_id` |
| `story_threads` | `id` |
| `story_threads` | `opened_at_chapter_id` |
| `story_threads` | `resolved_at_chapter_id` |
| `subscriptions` | `id` |
| `universe_characters` | `id` |
| `universe_events` | `id` |
| `universes` | `id` |
| `users` | `id` |
| `video_analysis_jobs` | `id` |
| `work_packets` | `id` |
| `work_patterns` | `id` |
| `world_entities` | `id` |

## Data coverage of the backup

| Table | Rows | In backup |
|---|---|---|
| `projects` | 55 | yes |
| `chapters` | 106 | yes |
| `characters` | 56 | yes |
| `locations` | 32 | yes |
| `plot_threads` | 7 | yes |
| `world_entities` | 0 | **empty in production** |
| `story_memories` | 40 | yes |
| `story_threads` | 0 | **empty in production** |
| `story_promises` | 0 | **empty in production** |
| `story_plans` | 0 | **empty in production** |
| `story_checkpoints` | 0 | **empty in production** |
| `character_relationships` | 1 | yes |
| `editor_notes` | 0 | **empty in production** |
| `reference_works` | 0 | **empty in production** |
| `universes` | 4 | yes |
| `series_bibles` | 5 | yes |

Story-domain tables that are **empty in production** cannot be validated by a real-data migration. `world_entities`, `story_threads`, `story_promises`, `story_plans`, `story_checkpoints` and `editor_notes` have never held a row, so the Story Transactions, Promise Tracker and Story Doctor code paths have no production precedent. Their migration paths must be proven against purpose-built fixtures.

## Known data defect (preserved, not repaired)

Exactly one row in the entire database — `universes.shared_rules` — contains a U+FFFD replacement character where an em-dash was intended. A whole-database scan across every text/jsonb column found no others. It is preserved verbatim in `legacy-data.sql`; per v4 §6.3 it is recorded here rather than silently corrected.
