import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OPERATION_CREDITS, DEFAULT_OPERATION_CREDIT } from "@/lib/metering/costs";

/**
 * Phase 0 / v4 §7.3 — charge-order invariant.
 *
 * A route must decide whether the request is ALLOWED (entitlement + input
 * validation) before it reserves credits. `refundCredits` is only ever wired to
 * `catch` blocks, never to early returns, so any 403/400 emitted after
 * `meterAndGate` silently burns the user's credits for work that never happened.
 *
 * This is a source-level assertion rather than a behavioural one because the
 * failure mode is a control-flow ordering that unit tests with mocked meters
 * cannot observe: they mock `meterAndGate` and therefore cannot tell whether it
 * ran before or after the gate.
 *
 * It also pins that every metered operation has an explicit price, so an
 * operation cannot silently fall through to DEFAULT_OPERATION_CREDIT.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const API_DIR = join(ROOT, "src/app/api");

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (["node_modules", ".next", "__tests__"].includes(e)) continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (e === "route.ts") out.push(p);
  }
  return out;
}

interface RouteInfo {
  rel: string;
  meterLine: number;
  op: string;
  /** Line of the entitlement gate that must precede metering, if any. */
  entitlementLine: number | null;
  /** Lines of 400-level input validation that should precede metering. */
  validationLines: number[];
  hasRefund: boolean;
  /** `try` line the meter is nested inside, if any. Must be null. */
  nestedInTry: number | null;
  /** `for`/`map`/arrow-callback line the meter is nested inside. Must be null. */
  nestedInLoop: number | null;
  /**
   * Phase 2 adapter rewrite: the meter lives inside a `reserve` port handed to
   * `runGenerationPipeline` rather than in a handler body. Single execution,
   * settle-once, and refund-on-post-reserve-failure are the PIPELINE's
   * contract (behaviourally pinned in generation-service.test.ts), so the
   * "handler top level" heuristic below does not apply to these routes — the
   * port-metered properties they can still be held to are checked instead.
   */
  portMetered: boolean;
  /** Occurrences of `await meterAndGate(` — a port-metered route must have 1. */
  meterCount: number;
}

/** Statements that mean the handler has started doing real, chargeable work. */
const WORK_RE =
  /client\.messages|anthropic|\bawait fetch\(|buildPromiseLedger|buildVoiceExemplars|buildAuthorVoiceExemplars|buildSceneBlueprint|groundInWebResearch|\bgenerate\(|generateStream\(|generateEmbedding|getTTSProvider|parseChapterIntoSegments|GoogleGenAI/;

/**
 * Routes that charge through the shared `runMeteredCall` seam
 * (`src/lib/roles/shared.ts`) instead of calling `meterAndGate` themselves.
 * `runDirectorCall`/`runWriterCall`/`runEditorCall` are all aliases of it.
 *
 * These were completely invisible to the ordering invariants below, which only
 * look for a literal `meterAndGate` call — a route using the seam is metered
 * correctly but would never be checked.
 */
const SEAM_CALL_RE = /\bawait run(?:Metered|Director|Writer|Editor)Call\s*\(/;
const REFUSAL_STATUS_RE = /status:\s*(400|401|403|404|422|500|503)/;

const FUNCTION_DECL_RE = /^(?:export\s+)?(?:async\s+)?function\s/;

const seamRoutes: Array<{ rel: string; op: string; chargeLine: number; uncompensated: number[] }> = [];
for (const file of walk(API_DIR)) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const chargeIdx = lines.findIndex((l) => SEAM_CALL_RE.test(l));
  if (chargeIdx === -1) continue;
  // `operation` sits on a later line of the multi-line argument object, so read a
  // window rather than the call line alone.
  const opWindow = lines.slice(chargeIdx, chargeIdx + 8).join("\n");
  const op = /operation:\s*['"]([^'"]+)['"]/.exec(opWindow)?.[1] ?? "";

  // Scan only the function that contains the charge. Ordering is a runtime
  // property of one call path, so comparing raw line numbers across handler
  // boundaries produces nonsense: in `generate-package` the charge sits in a
  // helper at line 170 while POST's ownership 404 is at line 336 — POST runs
  // first, so that 404 is free, not a leak.
  const decls: number[] = [];
  lines.forEach((l, i) => { if (FUNCTION_DECL_RE.test(l)) decls.push(i); });
  const enclosingStart = decls.filter((d) => d < chargeIdx).pop();
  const enclosingEnd = decls.find((d) => d > chargeIdx);
  const from = chargeIdx;
  const to = enclosingEnd === undefined ? lines.length : enclosingEnd;
  void enclosingStart;

  // A refusal after the charge is only acceptable if the handler refunds first.
  // `runMeteredCall` refunds internally when the model call THROWS, so the
  // uncovered case is a route's own post-success parse failure.
  const refunded = lines.findIndex((l, i) => i > from && i < to && /refundCredits/.test(l));
  const uncompensated: number[] = [];
  lines.forEach((l, i) => {
    if (i <= from || i >= to) return;
    if (REFUSAL_STATUS_RE.test(l) && refunded === -1) uncompensated.push(i + 1);
  });

  seamRoutes.push({
    rel: file.replace(ROOT + "\\", "").replace(/\\/g, "/"),
    op,
    chargeLine: chargeIdx + 1,
    uncompensated,
  });
}

const routes: RouteInfo[] = [];
for (const file of walk(API_DIR)) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const meterIdx = lines.findIndex((l) => /const gate = await meterAndGate\(/.test(l));
  if (meterIdx === -1) continue;
  const op = /meterAndGate\([^,]+,\s*['"]([^'"]+)['"]/.exec(lines[meterIdx])?.[1] ?? "";

  // The entitlement gate is the FIRST canAccessFeature check in the handler,
  // wherever it appears. Finding it only *before* the meter would make this
  // assertion tautological: a route that meters first would simply look like it
  // had no gate at all.
  const entIdx = lines.findIndex((l) => /if \(!canAccessFeature\(/.test(l));

  // Only 400 responses emitted BEFORE any real work count as input validation.
  // A 400 returned after the model call (e.g. from a catch) is not a leak.
  const workIdx = lines.findIndex((l, i) => i > meterIdx && WORK_RE.test(l));
  const limit = workIdx === -1 ? lines.length : workIdx;
  const valLines: number[] = [];
  lines.forEach((l, i) => {
    if (i > meterIdx && i < limit && /status:\s*400/.test(l)) valLines.push(i + 1);
  });

  // The meter must sit at the handler's top level. Two failure modes if it does not:
  //   - inside a `try`, a throw reaches `catch` and calls `refundCredits` for a
  //     charge that never happened, silently crediting the user;
  //   - inside a loop or callback (e.g. `Promise.allSettled` over N personas), it
  //     runs N times and charges N credits for one request.
  // Top level is measured against the meter's own indentation, since handler bodies
  // are not uniformly indented across this codebase.
  const meterIndent = (lines[meterIdx].match(/^\s*/) ?? [""])[0].length;
  // Exception: the meter inside the pipeline's `reserve` port is not a nesting
  // bug — `runGenerationPipeline` calls `reserve` exactly once and settles the
  // reservation exactly once. Detect it structurally: the nearest line with
  // LESS indentation than the meter is the `reserve:` port field itself.
  let nearestShallower = -1;
  for (let i = meterIdx - 1; i >= 0; i--) {
    const ind = (lines[i].match(/^\s*/) ?? [""])[0].length;
    if (ind < meterIndent) {
      nearestShallower = i;
      break;
    }
  }
  const portMetered =
    nearestShallower >= 0 && /^\s*reserve:\s*async/.test(lines[nearestShallower]);
  const meterCount = (src.match(/\bawait meterAndGate\(/g) ?? []).length;
  let nestedInTry: number | null = null;
  let nestedInLoop: number | null = null;
  if (!portMetered) {
    for (let i = 0; i < meterIdx; i++) {
      const ind = (lines[i].match(/^\s*/) ?? [""])[0].length;
      if (ind >= meterIndent) continue;
      if (/^\s*try\s*\{\s*$/.test(lines[i])) nestedInTry = i + 1;
      if (/^\s*(for \(|while \(|.*\.map\(|.*\.forEach\(|.*=>\s*\{\s*$)/.test(lines[i])) {
        nestedInLoop = i + 1;
      }
    }
  }

  routes.push({
    rel: file.replace(ROOT + "\\", "").replace(/\\/g, "/"),
    meterLine: meterIdx + 1,
    op,
    entitlementLine: entIdx === -1 ? null : entIdx + 1,
    validationLines: valLines,
    hasRefund: /refundCredits/.test(src),
    nestedInTry,
    nestedInLoop,
    portMetered,
    meterCount,
  });
}

describe("metering charge-order invariant", () => {
  it("finds the metered routes to check", () => {
    // Guards against this whole suite silently passing on an empty file set.
    expect(routes.length).toBeGreaterThan(20);
  });

  it("reserves credits only AFTER the entitlement gate", () => {
    const offenders = routes.filter(
      (r) => r.entitlementLine !== null && r.entitlementLine > r.meterLine,
    );
    expect(
      offenders.map((o) => `${o.rel}: gate at ${o.entitlementLine} but meter at ${o.meterLine}`),
    ).toEqual([]);
  });

  it("reserves credits only AFTER input validation", () => {
    // A 400 emitted after metering charges the user for a request that was
    // rejected before doing any work.
    const offenders = routes.filter((r) =>
      r.validationLines.some((v) => v > r.meterLine),
    );
    expect(
      offenders.map((o) => `${o.rel}: 400 at ${o.validationLines.filter((v) => v > o.meterLine)} but meter at ${o.meterLine}`),
    ).toEqual([]);
  });

  it("reserves credits at the handler's top level, never inside a try or loop", () => {
    // Port-metered routes (`reserve:` port into runGenerationPipeline) are
    // exempt from this STRUCTURAL heuristic — single execution and settle-once
    // are the pipeline's tested behaviour — and are held to a property that
    // stays statically checkable instead: the meter is written exactly once.
    const offenders = routes.filter(
      (r) => !r.portMetered && (r.nestedInTry !== null || r.nestedInLoop !== null),
    );
    expect(
      offenders.map(
        (o) =>
          `${o.rel}: meter at ${o.meterLine} nested in try=${o.nestedInTry} loop=${o.nestedInLoop}`,
      ),
    ).toEqual([]);
  });

  it("port-metered routes meter exactly once per request", () => {
    // What the top-level heuristic hunts is a meter that can run many times for
    // one request. A meter inside the pipeline's `reserve` port runs once by
    // the pipeline's own contract; the residual static risk is a SECOND meter
    // call elsewhere in the same file, charging twice.
    const offenders = routes.filter((r) => r.portMetered && r.meterCount !== 1);
    expect(
      offenders.map((o) => `${o.rel}: ${o.meterCount} meterAndGate calls in a reserve-port route`),
    ).toEqual([]);
  });

  it("prices every metered operation explicitly", () => {
    const unpriced = routes.filter((r) => r.op && !(r.op in OPERATION_CREDITS));
    expect(
      unpriced.map((u) => `${u.rel}: "${u.op}" has no OPERATION_CREDITS entry (charged ${DEFAULT_OPERATION_CREDIT})`),
    ).toEqual([]);
  });

  it("prices every seam-metered operation explicitly", () => {
    const unpriced = seamRoutes.filter((r) => r.op && !(r.op in OPERATION_CREDITS));
    expect(
      unpriced.map((u) => `${u.rel}: "${u.op}" has no OPERATION_CREDITS entry (charged ${DEFAULT_OPERATION_CREDIT})`),
    ).toEqual([]);
  });

  it("has no dead price entries — every priced operation is reachable from a route", () => {
    // A price entry nothing charges is a trap: it reads as "this operation costs
    // X" while the route actually bills something else. `surgical-edit` and
    // `prose-fix` both sat at 0.6 in the table while their routes metered as
    // `"prose"` and charged 0.5.
    const reachable = new Set<string>([
      ...routes.map((r) => r.op),
      ...seamRoutes.map((r) => r.op),
    ]);
    const dead = Object.keys(OPERATION_CREDITS).filter((op) => !reachable.has(op));
    expect(dead).toEqual([]);
  });
});

describe("seam-metered routes (runMeteredCall and its aliases)", () => {
  it("finds the seam-metered routes to check", () => {
    // Guards against this block silently passing on an empty file set.
    expect(seamRoutes.length).toBeGreaterThan(5);
  });

  it("never refuses a request after charging without refunding it", () => {
    // The seam charges at the call site, so any 4xx emitted afterwards must be
    // compensated by a refund somewhere in the handler.
    const offenders = seamRoutes.filter((r) => r.uncompensated.length > 0);
    expect(
      offenders.map((o) => `${o.rel}: charge at ${o.chargeLine}, uncompensated refusal at ${o.uncompensated}`),
    ).toEqual([]);
  });

  it("always names an operation, so the charge is attributable", () => {
    const anonymous = seamRoutes.filter((r) => !r.op);
    expect(anonymous.map((a) => `${a.rel}: seam call with no operation`)).toEqual([]);
  });
});

describe("documented exceptions", () => {
  // These routes meter before validation for a stated reason. They are listed
  // explicitly so the exception is a deliberate, reviewed decision rather than
  // something the invariant silently tolerates.
  const ALLOWED = new Set<string>([]);

  it("has no unlisted exceptions", () => {
    // ALLOWED is empty by design: every metered route must satisfy the invariants
    // above. This asserts the list stays empty until a real exception is reviewed.
    expect([...ALLOWED]).toEqual([]);
  });

  it("keeps the exception list honest (no stale entries)", () => {
    const all = new Set(routes.map((r) => r.rel));
    const stale = [...ALLOWED].filter((a) => !all.has(a));
    expect(stale).toEqual([]);
  });
});