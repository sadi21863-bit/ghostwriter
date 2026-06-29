# World Entities (World Bible Expansion) — Design Spec (2026-06-30)

## Problem

The World Bible holds only **characters**, **locations**, and **plot threads**. Stories
are also made of *things that aren't people, places, or threads*: a cursed sword, a
shadow government, a recurring plague, a magic system. Today users cram these into a
character's backstory or a location description, where they don't get their own context
injection, don't appear in the Story Graph, and can't be linked to the cast/threads that
use them. The user asked for "separate sections for objects, weapons, organisations,
phenomena/entities" in the bible.

## Decision: one generalized, kind-tagged table — not three bolt-on tables

The candidate kinds (object, weapon, organization, faction, phenomenon, entity, concept)
share ~90% of their fields (name, summary, description, links, context flags) and **all**
of the graph/context/link plumbing. The only real per-kind variation is a small
`properties` blob. Three separate tables would triple the schema, CRUD, context-builder
branches, graph-node code, and extraction code for no gain. So: **one `world_entities`
table** with a `kind` discriminator + a zod-typed `properties` JSONB. The UI *groups* the
seven kinds into three visible sections; the data layer stays single.

This mirrors the existing pattern exactly: `world_entities` is to the World Bible what
`editor_notes` is to the Editor — a kind/severity-tagged single table, not one table per
category.

## Scope (approved)

- **Full vertical slice**: table + zod guards + CRUD routes + Story Bible grouped UI +
  context-builder gating + Story Graph nodes + AI extraction.
- **All seven kinds** in v1: `object | weapon | organization | faction | phenomenon |
  entity | concept`.

## Architecture

### 1. Schema — `world_entities` (new table)

Mirrors the `characters`/`locations` column conventions (link-array JSONB, `alwaysInContext`,
`sortOrder`, timestamps). New migration (next sequential, 0015).

```ts
export const worldEntities = pgTable("world_entities", {
  id:                  uuid("id").defaultRandom().primaryKey(),
  projectId:           uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind:                varchar("kind", { length: 16 }).notNull().default("object"),
  name:                text("name").notNull(),
  summary:             text("summary").default(""),
  description:         text("description").default(""),
  properties:          jsonb("properties").$type<WorldEntityProperties>().default({}),
  linkedCharacterIds:  jsonb("linked_character_ids").$type<string[]>().default([]),
  linkedLocationIds:   jsonb("linked_location_ids").$type<string[]>().default([]),
  linkedPlotThreadIds: jsonb("linked_plot_thread_ids").$type<string[]>().default([]),
  linkedEntityIds:     jsonb("linked_entity_ids").$type<string[]>().default([]),
  alwaysInContext:     boolean("always_in_context").default(false),
  sortOrder:           integer("sort_order").default(0),
  createdAt:           timestamp("created_at").defaultNow(),
  updatedAt:           timestamp("updated_at").defaultNow(),
});
```

Relations: `worldEntitiesRelations` (project: one) + add `worldEntities: many(worldEntities)`
to `projectsRelations`.

`kind` is a plain `varchar` (like `editorNotes.type`/`severity`), validated by zod at the
write boundary — not a Postgres enum (the codebase never uses pg enums; it validates in
the app layer).

### 2. Zod guards — `src/lib/types/story.ts`

Follows the established lenient-decode / strict-encode convention.

```ts
export const WORLD_ENTITY_KINDS = ["object","weapon","organization","faction","phenomenon","entity","concept"] as const;
export const WorldEntityKindSchema = z.enum(WORLD_ENTITY_KINDS).catch("object");
export type WorldEntityKind = z.infer<typeof WorldEntityKindSchema>;

// One flat, all-optional properties shape covering every kind's useful fields.
// Each field independently `.catch`es so one malformed field drops only itself.
export const WorldEntityPropertiesSchema = z.object({
  origin:        z.string().optional().catch(undefined),  // object/weapon: where it came from
  material:      z.string().optional().catch(undefined),  // object/weapon
  powers:        z.array(z.string()).optional().catch(undefined), // object/weapon/phenomenon abilities
  significance:  z.string().optional().catch(undefined),  // why it matters to the plot
  goal:          z.string().optional().catch(undefined),  // organization/faction
  leader:        z.string().optional().catch(undefined),  // organization/faction
  members:       z.array(z.string()).optional().catch(undefined), // organization/faction
  allegiance:    z.string().optional().catch(undefined),  // organization/faction
  nature:        z.string().optional().catch(undefined),  // phenomenon/entity/concept
  rules:         z.array(z.string()).optional().catch(undefined), // phenomenon/concept (how it works)
  manifestation: z.string().optional().catch(undefined),  // phenomenon/entity
  notes:         z.string().optional().catch(undefined),  // freeform
});
export type WorldEntityProperties = z.infer<typeof WorldEntityPropertiesSchema>;

export function decodeWorldEntityProperties(raw: unknown): WorldEntityProperties { /* stripUndefined(safeParse ?? {}) */ }
export function encodeWorldEntityProperties(value: unknown): WorldEntityProperties { /* stripUndefined(parse) */ }
```

### 3. CRUD routes (mirror characters/locations exactly)

- `POST/GET /api/projects/[projectId]/world-entities` — collection. POST validates `name`
  (required) + `kind` via `WorldEntityKindSchema`, runs `encodeWorldEntityProperties` on
  `properties` (400 on invalid). GET returns all rows for the project ordered by
  `kind, sortOrder`.
- `PATCH/DELETE /api/projects/[projectId]/world-entities/[entityId]` — uses
  `verifyChildOwnership(worldEntities, entityId, projectId)` (the IDOR helper), re-encodes
  `properties` on PATCH, sets `updatedAt`.

### 4. Context builder — `needsWorldEntities` policy knob

- Add **optional** `needsWorldEntities?: boolean` to `ContextPolicy` (optional → zero churn
  on the 26 mode entries; only modes that opt in set it true).
- Set `needsWorldEntities: true` on the modes where worldbuilding objects matter:
  `combat`, `horror`, `action` (and any with `needsRealism`). Via spread override on those
  entries only.
- In `buildStaticContext`: when `policy.needsWorldEntities && p.worldEntities?.length`,
  assemble a `## World Elements` section grouped by kind, respecting `alwaysInContext`
  /`contextVisibility`-equivalent (`alwaysInContext` first; cap length like other sections).
- `/api/ai/generate` loads `worldEntities` into the project payload `p` so the section has
  data. No-mode requests (`FULL_CONTEXT_POLICY`) get `needsWorldEntities: true` too.

### 5. Story Graph — new node types

Extend `src/lib/graph/story-graph.ts`:
- `StoryGraphNodeType` gains the seven kinds (or a single `"entity"` super-type carrying a
  `kind` field — chosen: a single `"world_entity"` node type with a `kind` discriminator on
  the node, to keep the union small and the renderer simple).
- New edges from the link arrays: world-entity → character (`linkedCharacterIds`),
  → location (`linkedLocationIds`), → thread (`linkedPlotThreadIds`), → entity
  (`linkedEntityIds`). Edge kind `"involves"`.
- `StoryGraphInput` gains `worldEntities: {...}[]`; the `/story-graph` route loads them via
  the `with:` clause.

### 6. Story Bible UI — grouped sections

In `StoryBible.tsx`, add a World Elements area that fetches `/world-entities` and renders
rows **grouped into three sections**:
- **Objects & Artifacts** (`object`, `weapon`)
- **Organizations & Factions** (`organization`, `faction`)
- **Phenomena & Entities** (`phenomenon`, `entity`, `concept`)

Each row: name, kind chip, summary, expandable to edit description + properties + links.
"+ Add" within each section seeds the right `kind`. Reuses the existing CRUD-handler
pattern (`res.ok` check + toast on failure + rapid-click guard) per the 2026-06-20 hardening.

### 7. AI extraction

Extend `src/lib/ai/entity-extraction.ts`: add a `worldEntity` entity key so generated prose
can propose new world entities (same `EntitySuggestionsChip` flow as characters). The
extraction prompt asks the model to surface named objects/weapons/orgs/phenomena with a
guessed `kind`. Reuses `ENTITY_API_PATH`/`ENTITY_TYPE`/`DIFF_FIELDS` maps.

## Wiring (per MASTER-PLAN invariants)

- **Typed JSONB everywhere** (invariant #4): `properties` gets decode/encode guards in
  `story.ts` — satisfied.
- **One spine**: extraction is surfaced through the existing suggestion chip; no new
  bespoke surface. Graph nodes ride the existing `/story-graph` route. Context rides the
  existing policy mechanism.
- **Preflight/forward-stages**: world entities are Shape-stage World Bible data feeding
  Write/Produce, same as characters — no new stage.

## Testing

- `story.ts` zod: decode drops malformed kinds→"object" and malformed property fields;
  encode rejects a non-object `properties`. (unit)
- `story-graph.ts`: world-entity nodes + `involves` edges built from link arrays; an
  unlinked entity lands in `isolated`-equivalent or is simply edgeless. (unit, pure)
- context-builder: `needsWorldEntities` gates the `## World Elements` section on/off. (unit)
- CRUD routes: covered by the drift-guard/registry style if applicable; manual smoke via
  the existing route test pattern.

## Out of scope (v1)

- Per-kind bespoke property *forms* (v1 uses one flexible property editor for all kinds).
- Higgsfield/image generation for objects (a later Produce-side concern).
- Promoting world entities into the capability registry as their own caps (they're data,
  not actions).

## Non-goals / risks

- Keep `ContextPolicy.needsWorldEntities` **optional** to avoid touching all 26 modes.
- The single flexible `properties` schema is deliberately loose; tightening per-kind can
  come later without a migration (JSONB).
