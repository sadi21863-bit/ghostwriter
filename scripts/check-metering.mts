/**
 * Metering pricing audit.
 *
 * Reports routes whose metered operation has no entry in OPERATION_CREDITS, so
 * the operation is silently charged DEFAULT_OPERATION_CREDIT — a pricing bug that
 * is invisible at the call site because `meterAndGate` falls back by design.
 *
 * Charge ORDER is deliberately NOT re-checked here. An earlier version of this
 * script scanned for any `status: 400` after the meter and reported
 * `ai/generate` and `ai/analyze-reference-video` as leaking. Both were false
 * positives: those 400s sit inside a `catch` that already calls `refundCredits`
 * first, so the user is made whole. Reimplementing the ordering rules here would
 * just create a second, cruder copy of a rule that already has a verified test.
 *
 * The authoritative ordering invariants — meter after the entitlement gate, after
 * input validation, and never nested in a `try`/loop/callback — live in
 * `src/lib/metering/__tests__/charge-order.test.ts`, and are run by `npm test`.
 *
 * Usage: npx tsx scripts/check-metering.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === "__tests__") continue;
    const p = resolve(dir, e);
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

// Read the real price table rather than regexing costs.ts, so a key added with a
// computed value or a trailing comment is still seen as priced.
const costsMod = await import(pathToFileURL(resolve(ROOT, "src/lib/metering/costs.ts")).href);
const OPERATION_CREDITS: Record<string, number> = costsMod.OPERATION_CREDITS;
const DEFAULT_OPERATION_CREDIT: number = costsMod.DEFAULT_OPERATION_CREDIT;

type Row = { route: string; op: string; meterLine: number; hasRefund: boolean };

const rows: Row[] = [];

for (const file of walk(resolve(ROOT, "src/app/api"))) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const meterIdx = lines.findIndex((l) => /meterAndGate\(/.test(l));
  if (meterIdx === -1) continue;
  const op = /meterAndGate\([^,]+,\s*["']([^"']+)["']/.exec(lines[meterIdx])?.[1] ?? "?";
  rows.push({
    route: file.replace(ROOT + "\\", ""),
    op,
    meterLine: meterIdx + 1,
    hasRefund: /refundCredits/.test(src),
  });
}

const unpriced = rows.filter((r) => !(r.op in OPERATION_CREDITS));
const neverRefunded = rows.filter((r) => !r.hasRefund);

console.log("Metering pricing audit");
console.log("======================");
console.log(`routes calling meterAndGate       : ${rows.length}`);
console.log(`metered with no OPERATION_CREDITS : ${unpriced.length} (charged DEFAULT_OPERATION_CREDIT = ${DEFAULT_OPERATION_CREDIT})`);
console.log(`routes with no refundCredits path : ${neverRefunded.length}`);
console.log("");
console.log(`charge-order invariants          : enforced by src/lib/metering/__tests__/charge-order.test.ts`);

if (unpriced.length) {
  console.log("");
  console.log("unpriced operations (silently charged the default):");
  for (const r of unpriced) {
    console.log(`  ${r.op.padEnd(26)} ${r.route.replace("src\\app\\api\\", "")}`);
  }
  process.exitCode = 1;
} else {
  console.log("");
  console.log("All metered operations have an explicit price.");
}