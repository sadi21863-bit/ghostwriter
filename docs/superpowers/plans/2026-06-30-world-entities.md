# World Entities (World Bible Expansion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generalized, kind-tagged `world_entities` table to the World Bible (objects/weapons/organizations/factions/phenomena/entities/concepts), wired into zod-typed JSONB, CRUD routes, AI context, the Story Graph, the Story Bible UI, and AI extraction.

**Architecture:** One `world_entities` table with a `kind` discriminator + zod-typed `properties` JSONB. The seven kinds group into three UI sections but share one data layer, one set of CRUD routes, one graph node type (`world_entity` carrying `kind`), and one extraction key. Mirrors the existing `characters`/`locations`/`editor_notes` patterns exactly.

**Tech Stack:** Next.js 16 API routes, Drizzle ORM, Neon Postgres, zod, vitest.

## Global Constraints

- Typed JSONB invariant: every structured blob gets `decode`/`encode` guards in `src/lib/types/story.ts` (lenient decode, strict encode).
- IDOR: child-resource routes use `verifyChildOwnership(table, childId, projectId)`; collection routes verify `projects.userId === session.user.id`.
- Never use pg enums — validate `kind` in the app layer via zod (`varchar` column).
- `ContextPolicy.needsWorldEntities` MUST be optional to avoid editing all 26 mode entries.
- Migrations via PowerShell: `Copy-Item .env.local .env -Force; npx drizzle-kit generate; npx drizzle-kit push`.
- tsc --noEmit exit 0 is ground truth over LSP false positives. Commit per task.

---

### Task 1: Schema + migration

**Files:**
- Modify: `src/db/schema.ts` (add `worldEntities` table; `worldEntitiesRelations`; extend `projectsRelations`)
- Migration: generated `drizzle/0015_*.sql`

**Interfaces:**
- Produces: `worldEntities` table export; `db.query.worldEntities`; `project.worldEntities` relation.
- Consumes: `WorldEntityProperties` type from Task 2 — but to avoid a circular import, the column is typed `jsonb().$type<Record<string, unknown>>()` here and narrowed at the zod boundary. (Decision: schema uses `Record<string, unknown>`; routes/types use the precise type.)

- [ ] **Step 1:** Add the table after `editorNotes` (near line 122), importing nothing new (uuid/text/jsonb/boolean/integer/timestamp/varchar already imported):

```ts
// World Bible expansion: non-character/location/thread worldbuilding — objects,
// weapons, organizations, factions, phenomena, entities, concepts. One kind-tagged
// table (like editor_notes), grouped into sections in the UI. `properties` is a
// zod-typed JSONB blob (see src/lib/types/story.ts decodeWorldEntityProperties).
export const worldEntities = pgTable("world_entities", {
  id:                  uuid("id").defaultRandom().primaryKey(),
  projectId:           uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind:                varchar("kind", { length: 16 }).notNull().default("object"),
  name:                text("name").notNull(),
  summary:             text("summary").default(""),
  description:         text("description").default(""),
  properties:          jsonb("properties").$type<Record<string, unknown>>().default({}),
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

- [ ] **Step 2:** Add the relation (next to `locationsRelations`, ~line 548):

```ts
export const worldEntitiesRelations = relations(worldEntities, ({ one }) => ({ project: one(projects, { fields: [worldEntities.projectId], references: [projects.id] }) }));
```

- [ ] **Step 3:** Extend `projectsRelations` (line 542) — append `, worldEntities: many(worldEntities)` before the closing `}))`.

- [ ] **Step 4:** Generate + push migration:

Run: `Copy-Item .env.local .env -Force; npx drizzle-kit generate; npx drizzle-kit push`
Expected: a new `0015_*.sql` creating `world_entities`; push reports the table created. Verify exit 0.

- [ ] **Step 5:** `npx tsc --noEmit` → exit 0.

- [ ] **Step 6:** Commit `feat: add world_entities table + relations (migration 0015)`.

---

### Task 2: Zod guards in story.ts

**Files:**
- Modify: `src/lib/types/story.ts`
- Test: `src/lib/types/__tests__/world-entities.test.ts` (create)

**Interfaces:**
- Produces: `WORLD_ENTITY_KINDS`, `WorldEntityKindSchema`, `WorldEntityKind`, `WorldEntityPropertiesSchema`, `WorldEntityProperties`, `decodeWorldEntityProperties(raw)`, `encodeWorldEntityProperties(value)`.
- Consumes: existing `stripUndefined`, `isPlainObject` helpers.

- [ ] **Step 1: Write the failing test** `src/lib/types/__tests__/world-entities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  WorldEntityKindSchema, decodeWorldEntityProperties, encodeWorldEntityProperties,
} from "../story";

describe("WorldEntityKindSchema", () => {
  it("accepts the seven kinds", () => {
    for (const k of ["object","weapon","organization","faction","phenomenon","entity","concept"])
      expect(WorldEntityKindSchema.parse(k)).toBe(k);
  });
  it("coerces an unknown kind to 'object' rather than throwing", () => {
    expect(WorldEntityKindSchema.parse("spaceship")).toBe("object");
  });
});

describe("world-entity properties guards", () => {
  it("decode keeps valid fields and drops malformed ones", () => {
    const out = decodeWorldEntityProperties({ origin: "forged in the north", powers: ["fire"], leader: 42 });
    expect(out.origin).toBe("forged in the north");
    expect(out.powers).toEqual(["fire"]);
    expect(out.leader).toBeUndefined();
  });
  it("decode returns {} for non-object input (never throws)", () => {
    expect(decodeWorldEntityProperties("nope")).toEqual({});
    expect(decodeWorldEntityProperties(null)).toEqual({});
  });
  it("encode strips unknown keys and returns a clean object", () => {
    const out = encodeWorldEntityProperties({ goal: "rule the city", bogus: 1 });
    expect(out).toEqual({ goal: "rule the city" });
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — Run: `npx vitest run src/lib/types/__tests__/world-entities.test.ts` → FAIL (exports not defined).

- [ ] **Step 3: Implement** — append to `src/lib/types/story.ts` (before the Helpers section is fine; uses `stripUndefined`/`isPlainObject` defined later, so put it AFTER those helpers — i.e. near the end of the file with the other decode/encode functions):

```ts
// ---------------------------------------------------------------------------
// world_entities.properties  (jsonb) — World Bible expansion
// ---------------------------------------------------------------------------
export const WORLD_ENTITY_KINDS = ["object","weapon","organization","faction","phenomenon","entity","concept"] as const;
export const WorldEntityKindSchema = z.enum(WORLD_ENTITY_KINDS).catch("object");
export type WorldEntityKind = z.infer<typeof WorldEntityKindSchema>;

export const WorldEntityPropertiesSchema = z.object({
  origin:        z.string().optional().catch(undefined),
  material:      z.string().optional().catch(undefined),
  powers:        z.array(z.string()).optional().catch(undefined),
  significance:  z.string().optional().catch(undefined),
  goal:          z.string().optional().catch(undefined),
  leader:        z.string().optional().catch(undefined),
  members:       z.array(z.string()).optional().catch(undefined),
  allegiance:    z.string().optional().catch(undefined),
  nature:        z.string().optional().catch(undefined),
  rules:         z.array(z.string()).optional().catch(undefined),
  manifestation: z.string().optional().catch(undefined),
  notes:         z.string().optional().catch(undefined),
});
export type WorldEntityProperties = z.infer<typeof WorldEntityPropertiesSchema>;

export function decodeWorldEntityProperties(raw: unknown): WorldEntityProperties {
  if (!isPlainObject(raw)) {
    if (raw != null) console.warn(`[story] worldEntityProperties: expected an object — falling back to {}`);
    return {};
  }
  const parsed = WorldEntityPropertiesSchema.safeParse(raw);
  if (!parsed.success) return {};
  return stripUndefined(parsed.data);
}
export function encodeWorldEntityProperties(value: unknown): WorldEntityProperties {
  return stripUndefined(WorldEntityPropertiesSchema.parse(value));
}
```

- [ ] **Step 4: Run tests, verify pass** — Run: `npx vitest run src/lib/types/__tests__/world-entities.test.ts` → PASS.

- [ ] **Step 5:** `npx tsc --noEmit` → exit 0.

- [ ] **Step 6:** Commit `feat: zod guards for world_entities kind + properties`.

---

### Task 3: CRUD routes

**Files:**
- Create: `src/app/api/projects/[projectId]/world-entities/route.ts` (GET list, POST create)
- Create: `src/app/api/projects/[projectId]/world-entities/[entityId]/route.ts` (PATCH, DELETE)

**Interfaces:**
- Consumes: `worldEntities` (Task 1), `WorldEntityKindSchema`/`encodeWorldEntityProperties` (Task 2), `getRequiredSession`, `verifyChildOwnership`.
- Produces: REST endpoints used by the UI (Task 6) and extraction (Task 7).

- [ ] **Step 1:** Collection route `world-entities/route.ts`:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { worldEntities, projects } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { WorldEntityKindSchema, encodeWorldEntityProperties } from "@/lib/types/story";

async function ownProject(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await ownProject(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await db.query.worldEntities.findMany({
    where: eq(worldEntities.projectId, projectId),
    orderBy: [asc(worldEntities.kind), asc(worldEntities.sortOrder)],
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await ownProject(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  if (!body?.name || typeof body.name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  const kind = WorldEntityKindSchema.parse(body.kind ?? "object");
  let properties;
  try { properties = encodeWorldEntityProperties(body.properties ?? {}); }
  catch { return NextResponse.json({ error: "invalid properties" }, { status: 400 }); }
  const [r] = await db.insert(worldEntities).values({
    projectId, kind, name: body.name,
    summary: body.summary ?? "", description: body.description ?? "", properties,
    linkedCharacterIds: body.linkedCharacterIds ?? [], linkedLocationIds: body.linkedLocationIds ?? [],
    linkedPlotThreadIds: body.linkedPlotThreadIds ?? [], linkedEntityIds: body.linkedEntityIds ?? [],
    alwaysInContext: body.alwaysInContext ?? false, sortOrder: body.sortOrder ?? 0,
  }).returning();
  return NextResponse.json(r, { status: 201 });
}
```

- [ ] **Step 2:** Child route `world-entities/[entityId]/route.ts`:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { verifyChildOwnership } from "@/lib/auth-helpers";
import { db } from "@/db";
import { worldEntities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { WorldEntityKindSchema, encodeWorldEntityProperties } from "@/lib/types/story";

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; entityId: string }> }) {
  await getRequiredSession();
  const { projectId, entityId } = await params;
  if (!await verifyChildOwnership(worldEntities, entityId, projectId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of ["name","summary","description","linkedCharacterIds","linkedLocationIds","linkedPlotThreadIds","linkedEntityIds","alwaysInContext","sortOrder"]) {
    if (f in body) patch[f] = body[f];
  }
  if ("kind" in body) patch.kind = WorldEntityKindSchema.parse(body.kind);
  if ("properties" in body) {
    try { patch.properties = encodeWorldEntityProperties(body.properties); }
    catch { return NextResponse.json({ error: "invalid properties" }, { status: 400 }); }
  }
  const [r] = await db.update(worldEntities).set(patch).where(eq(worldEntities.id, entityId)).returning();
  return NextResponse.json(r);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; entityId: string }> }) {
  await getRequiredSession();
  const { projectId, entityId } = await params;
  if (!await verifyChildOwnership(worldEntities, entityId, projectId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(worldEntities).where(eq(worldEntities.id, entityId));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3:** Confirm `verifyChildOwnership`'s signature accepts a Drizzle table + childId + projectId (read `src/lib/auth-helpers.ts`). If its parameter order differs, match it.

- [ ] **Step 4:** `npx tsc --noEmit` → exit 0.

- [ ] **Step 5:** Commit `feat: world-entities CRUD routes`.

---

### Task 4: Context-builder integration

**Files:**
- Modify: `src/lib/modes/registry.ts` (`ContextPolicy` interface + opt-in modes)
- Modify: `src/lib/ai/context-builder.ts` (`FULL_CONTEXT_POLICY` + `## World Elements` section)
- Modify: `src/app/api/ai/generate/route.ts` (load `worldEntities` into `p`)
- Test: `src/lib/ai/__tests__/world-entities-context.test.ts` (create)

**Interfaces:**
- Consumes: `worldEntities` rows on the project payload (`p.worldEntities`).
- Produces: a `## World Elements` block in static context when `needsWorldEntities` is set.

- [ ] **Step 1:** In `registry.ts`, add to the `ContextPolicy` interface: `needsWorldEntities?: boolean;` (optional). Set `needsWorldEntities: true` via spread on `combat`, `horror`, and any `action` mode entry (e.g. `{ ...FULL, needsRealism: true, needsWorldEntities: true }`).

- [ ] **Step 2:** In `context-builder.ts`, add `needsWorldEntities: true` to `FULL_CONTEXT_POLICY` (so no-mode requests include them).

- [ ] **Step 3: Write failing test** `world-entities-context.test.ts` — calls `buildStaticContext` (or the section helper) with a project carrying one `worldEntities` row and a policy with `needsWorldEntities: true` → output contains the entity name under a `World Elements` heading; with the policy false → output does not. (Match the existing context-builder test calling convention — read one neighboring test first.)

- [ ] **Step 4:** Implement the section in `buildStaticContext` (next to the locations/plotThreads sections, ~line 659-690):

```ts
if (policy.needsWorldEntities && p.worldEntities?.length) {
  const byKind = new Map<string, string[]>();
  for (const e of p.worldEntities) {
    const line = `- ${e.name}${e.summary ? `: ${e.summary}` : ""}`;
    const arr = byKind.get(e.kind) ?? [];
    arr.push(line);
    byKind.set(e.kind, arr);
  }
  const lines: string[] = [];
  for (const [kind, items] of byKind) lines.push(`${kind}:`, ...items);
  sections.push(`## World Elements\n${lines.join("\n")}`);
}
```

(Adapt `sections.push`/assembly to the file's actual section-accumulation mechanism.)

- [ ] **Step 5:** In `/api/ai/generate/route.ts`, add `worldEntities: true` to the project `with:` query so `p.worldEntities` is populated.

- [ ] **Step 6:** Run the new test → PASS. `npx tsc --noEmit` → exit 0.

- [ ] **Step 7:** Commit `feat: inject world entities into AI context (opt-in per mode)`.

---

### Task 5: Story Graph node type

**Files:**
- Modify: `src/lib/graph/story-graph.ts`
- Modify: `src/app/api/projects/[projectId]/story-graph/route.ts`
- Test: extend `src/lib/graph/__tests__/story-graph.test.ts` (or create if absent)

**Interfaces:**
- Consumes: `worldEntities` with their link arrays.
- Produces: `world_entity` nodes + `involves` edges in the graph result.

- [ ] **Step 1:** Add `"world_entity"` to `StoryGraphNodeType`; add `"involves"` to `StoryGraphEdgeKind`. Add optional `kind?: string` to `StoryGraphNode` (carries the entity kind for rendering). Add `worldEntities` to `StoryGraphInput`:

```ts
worldEntities?: { id: string; name: string; kind: string; linkedCharacterIds?: string[] | null; linkedLocationIds?: string[] | null; linkedPlotThreadIds?: string[] | null; linkedEntityIds?: string[] | null }[];
```

- [ ] **Step 2:** In `buildStoryGraph`, push a node per world entity (`type: "world_entity", kind: e.kind`) and an `involves` edge from each entity to every id in its four link arrays that resolves to a known node. Guard against unknown ids (same `charIds.has(...)` style guards).

- [ ] **Step 3:** Write/extend a failing test asserting a world-entity node appears and an `involves` edge connects it to a linked character. Run → fail → implement → pass.

- [ ] **Step 4:** In the `/story-graph` route, add `worldEntities: true` to the `with:` clause and pass `worldEntities: (project as any).worldEntities ?? []` into `buildStoryGraph`.

- [ ] **Step 5:** `npx tsc --noEmit` → exit 0.

- [ ] **Step 6:** Commit `feat: world entities as Story Graph nodes`.

---

### Task 6: Story Bible UI — grouped sections

**Files:**
- Modify: `src/components/StoryBible.tsx`

**Interfaces:**
- Consumes: `/api/projects/[id]/world-entities` (Task 3).
- Produces: a World Elements UI area, three grouped sections.

- [ ] **Step 1:** Read `StoryBible.tsx` to match its existing fetch/CRUD-handler conventions (the 2026-06-20 hardened pattern: `res.ok` checks, toast on failure, rapid-click guard).

- [ ] **Step 2:** Add state + a fetch of world-entities on open. Render three sections — Objects & Artifacts (`object`,`weapon`), Organizations & Factions (`organization`,`faction`), Phenomena & Entities (`phenomenon`,`entity`,`concept`). Each row: name + kind chip + summary, expandable to edit description/properties/links. "+ Add" seeds the section's primary `kind`. POST/PATCH/DELETE against the routes.

- [ ] **Step 3:** `npx tsc --noEmit` → exit 0 (LSP "Props must be serializable" false positives ignored per CLAUDE.md).

- [ ] **Step 4:** Commit `feat: World Elements sections in Story Bible`.

---

### Task 7: AI extraction

**Files:**
- Modify: `src/lib/ai/entity-extraction.ts`
- Test: extend its `__tests__` if present

**Interfaces:**
- Consumes: generated prose; the entity maps (`ENTITY_API_PATH`/`ENTITY_TYPE`/`DIFF_FIELDS`).
- Produces: `worldEntity` suggestions through the existing `EntitySuggestionsChip`.

- [ ] **Step 1:** Read `entity-extraction.ts` fully to learn the `EntityKey` union + how `matchEntities`/`diffEntity` and the three maps drive the chip.

- [ ] **Step 2:** Add a `worldEntity` key: `ENTITY_API_PATH.worldEntity = "world-entities"`, `ENTITY_TYPE.worldEntity = "World Element"`, `DIFF_FIELDS.worldEntity = [{ field: "name", label: "Name" }, { field: "summary", label: "Summary" }, { field: "kind", label: "Kind" }]`. Extend `matchEntities` so named non-character/location nouns surface as world-entity suggestions (conservative — only when the extraction model tags them).

- [ ] **Step 3:** Add/extend a unit test for the new key's maps + a `matchEntities` case. Run → pass.

- [ ] **Step 4:** `npx tsc --noEmit` → exit 0.

- [ ] **Step 5:** Commit `feat: AI extraction proposes world entities`.

---

### Task 8: Full-suite verification

- [ ] **Step 1:** Run the full test suite (background): `npx vitest run`. Expected: all pass except the known-flaky `auth.test.ts` Upstash sliding-window test.
- [ ] **Step 2:** `npx tsc --noEmit` → exit 0.
- [ ] **Step 3:** Update `CLAUDE.md` Architecture section with a one-line `world_entities` note + memory `project-consolidation-roadmap` / MASTER-PLAN status tick.
- [ ] **Step 4:** Commit `docs: record world_entities expansion`.
