# ContextPolicy shadow evaluation (Phase 0, v4 §5.2)

**Verdict: do NOT switch `CONTEXT_POLICY_VERSION` to `mode-aware` yet.**

Date: 2026-10-03
Command: `npx tsx scripts/eval-context-policy.mts`
Switch state: `shadow` (`src/lib/ai/context-policy-version.ts`) — legacy text is what generation uses.

---

## Why this document exists

The mode-aware `ContextPolicy` already existed in `src/lib/modes/registry.ts` and was unit-tested, but the primary generation path never passed `mode`, so **every request received the full legacy policy**. That made it look like a dormant correctness bug.

It is not a pure bug fix. Turning it on changes what the model sees:

- Some modes **gain** sections they never received (`combat`/`horror`/`action` gain WORLD ELEMENTS).
- Most modes **lose** sections they have always received.
- Token cost drops — but by how much, and at what continuity price, was never measured.

v4 §5 therefore requires a shadow-first rollout. This is Stage B.

## Method

26 registered modes × 3 fixtures (`sparse` 3ch/2mem, `rich` 8ch/16mem, `long-running` 40ch/60mem with inflated prose to force Headroom trimming) = **78 combinations**. Each is built twice from identical data — once with no mode (legacy full policy) and once with the mode (policy applied) — and compared.

Every section is populated in the fixture so nothing is absent for accidental reasons.

## Behaviour preservation — PASS

```
OK: in shadow mode the active context is byte-identical to legacy
    for all 78 combinations.
```

Stage A introduces **zero** behavioural change. This is the property that makes
Stage B safe to run repeatedly.

## What the switch would actually change (rich fixture)

| Mode | tok legacy | tok mode-aware | saved | % | world elements lost |
|---|---|---|---|---|---|
| write | 1219 | 1163 | 56 | 5% | **YES** |
| dialogue | 1219 | 1104 | 115 | 9% | **YES** |
| combat | 1219 | 962 | 257 | 21% | no |
| emotional | 1219 | 1104 | 115 | 9% | **YES** |
| atmosphere | 1219 | **409** | **810** | **66%** | **YES** |
| comedy | 1219 | 1052 | 167 | 14% | **YES** |
| mystery | 1219 | 1163 | 56 | 5% | **YES** |
| romance | 1219 | 1104 | 115 | 9% | **YES** |
| horror | 1219 | 962 | 257 | 21% | no |
| monologue | 1219 | 1052 | 167 | 14% | **YES** |
| voice | 1219 | 847 | 372 | 31% | **YES** |
| thriller | 1219 | 1163 | 56 | 5% | **YES** |
| sports | 1219 | 905 | 314 | 26% | **YES** |
| setting | 1219 | **409** | **810** | **66%** | **YES** |
| historical | 1219 | 1110 | 109 | 9% | **YES** |
| scitech | 1219 | **409** | **810** | **66%** | **YES** |
| endings | 1219 | 1163 | 56 | 5% | **YES** |
| action | 1219 | 962 | 257 | 21% | no |

(Full 26-mode table regenerates on every run of the eval script.)

## Findings

### 1. World elements are lost by 23 of 26 modes

`needsWorldEntities` is set `true` on only **combat, horror, action**. The legacy
fallback policy sets it `true` for everything. So switching removes the WORLD
ELEMENTS section from every other mode.

This is almost certainly an **inverted default**, not an intentional exclusion. The
registry's base templates (`FULL`, `BRIEF`) omit `needsWorldEntities` entirely, so
it defaults to falsy and a mode must *opt in*. Only three did. Meanwhile the
section gate in `context-builder.ts` is:

```ts
if (policy.needsWorldEntities && p.worldEntities?.length)
```

Genres where world lore matters most — mystery, romance, thriller, endings,
historical — would silently lose it.

### 2. `needsRealism` has the same shape

`true` only on combat/horror/action/emotional; legacy gives it to all. Realism
domains are cheap, deterministic, and useful well beyond combat.

### 3. The most aggressive modes are the ones that can least afford it

`atmosphere`, `setting` and `scitech` each lose **66%** of context (810 of 1219
estimated tokens) by dropping world elements, memories, plot threads **and**
falling back to brief character depth. `atmosphere` and `setting` are precisely
the modes where sensory/environmental canon matters most, so this is the policy
doing the opposite of its intent.

### 4. The saving is small where it is safe

`write` — the most-used mode — saves only **5%**, and pays for it by losing world
elements. `mystery`, `thriller`, `endings`, `tension`, `composition` and `isekai`
all save **5%** on the same trade. A 5% token saving does not justify removing
canon from the modes a writer spends most of their time in.

### 5. What is genuinely safe

**No mode loses character canon (0 of 26).** `needsCharacters` is on in both base
templates, so the single most important continuity surface is protected. The
`combat`/`horror`/`action` trade (drop memories + plot threads, gain world
elements) is coherent and is the intended design.

## Recommended policy corrections

Applied to the base templates so that individual modes must now *opt out*
explicitly — the inverse of the current design, which required opting in:

```ts
// src/lib/modes/registry.ts
const FULL: ContextPolicy  = { needsCharacters: true, needsLocations: true, needsMemories: true,
                               needsPlotThreads: true, needsRealism: true, needsWorldEntities: true,
                               charDepth: "full" };
const BRIEF: ContextPolicy = { needsCharacters: true, needsLocations: true, needsMemories: false,
                               needsPlotThreads: false, needsRealism: true, needsWorldEntities: true,
                               charDepth: "brief" };
```

This makes the bases match the legacy behaviour they are replacing, so switching
becomes a genuinely surgical change. A mode that really does not want world
elements can now declare `needsWorldEntities: false`.

## Still deferred

- **`voice`** drops locations, memories, plot threads, realism and world elements —
  characters only. That may be intentional (voice-matching is about prose style),
  but it is the second-most aggressive policy and should be a deliberate decision.
- **`charDepth: "brief"`** drops most of each character's profile. Worth validating
  against real prose output rather than token counts.
- **Post-switch validation** still needs real generation, not just token math.

## How to proceed

1. Keep `CONTEXT_POLICY_VERSION = "shadow"`.
2. Land the base-template correction above (behaviour-neutral while shadow).
3. Re-run this eval; the world-element loss count should fall from 23 to 0.
4. Only then flip to `"mode-aware"`, and validate by generating the same scene
   under both policies and reading the prose.

The switch is one line in `src/lib/ai/context-policy-version.ts`. It is not a
remote flag by design (v4 §5.1): it must ship with the build so there is no way to
change context policy in production without a deploy.