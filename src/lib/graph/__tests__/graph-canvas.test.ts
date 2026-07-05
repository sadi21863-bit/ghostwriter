import { describe, it, expect } from "vitest";
import { selectionKinds, confirmMessageFor, isOptionActionable, blockedReasonText, nodeHealthAccent, linkKindForPair } from "../graph-canvas";
import type { GraphRunPlan } from "../graph-program";
import type { GraphHealthIssue } from "../graph-health";

function plan(over: Partial<GraphRunPlan>): GraphRunPlan {
  return {
    capabilityId: "x", label: "X", nodeIds: ["a"], available: true,
    action: { type: "noop" }, costUsd: 0, requiresConfirm: false, ...over,
  } as GraphRunPlan;
}

describe("selectionKinds", () => {
  it("returns the distinct entity kinds in a selection, deduped and order-stable", () => {
    expect(selectionKinds([{ type: "thread" }, { type: "character" }, { type: "thread" }]))
      .toEqual(["thread", "character"]);
  });
  it("ignores nodes without a recognised type", () => {
    expect(selectionKinds([{ type: "mystery" }, {}])).toEqual([]);
  });
  it("recognises chapter nodes", () => {
    expect(selectionKinds([{ type: "chapter" }])).toEqual(["chapter"]);
  });
});

describe("confirmMessageFor", () => {
  it("returns a cost message for a paid, available plan", () => {
    const msg = confirmMessageFor(plan({ label: "Comic Studio", nodeIds: ["a", "b"], costUsd: 0.58, requiresConfirm: true }));
    expect(msg).toContain("Comic Studio");
    expect(msg).toContain("2 selected nodes");
    expect(msg).toContain("$0.58");
  });
  it("returns null when no confirm is needed", () => {
    expect(confirmMessageFor(plan({ requiresConfirm: false }))).toBeNull();
  });
  it("returns null for an unavailable plan", () => {
    expect(confirmMessageFor(plan({ available: false, requiresConfirm: true, costUsd: 1 }))).toBeNull();
  });
});

describe("isOptionActionable / blockedReasonText", () => {
  it("an available plan is actionable with no blocked reason", () => {
    const p = plan({});
    expect(isOptionActionable(p)).toBe(true);
    expect(blockedReasonText(p)).toBeNull();
  });
  it("a key-missing plan is not actionable and explains why", () => {
    const p = plan({ available: false, reason: "missing_segmind_key" });
    expect(isOptionActionable(p)).toBe(false);
    expect(blockedReasonText(p)).toContain("Segmind");
  });
  it("an upgrade-gated plan explains the gate", () => {
    expect(blockedReasonText(plan({ available: false, reason: "upgrade_required" }))).toBe("Upgrade required");
  });
});

function issue(over: Partial<GraphHealthIssue>): GraphHealthIssue {
  return {
    kind: "isolated_entity", severity: "info", nodeId: "n1", nodeName: "Thing",
    message: "msg", ...over,
  };
}

describe("nodeHealthAccent", () => {
  it("returns null when there are no issues", () => {
    expect(nodeHealthAccent([])).toBeNull();
  });
  it("returns the warning color when any issue is a warning", () => {
    expect(nodeHealthAccent([issue({ severity: "info" }), issue({ severity: "warning" })])).toBe("#f87171");
  });
  it("returns the info color when all issues are info", () => {
    expect(nodeHealthAccent([issue({ severity: "info" })])).toBe("#f59e0b");
  });
});

describe("linkKindForPair", () => {
  it("resolves character+character to relationship", () => {
    expect(linkKindForPair("character", "character")).toBe("relationship");
  });
  it("resolves character+location to appears_at, order-independent", () => {
    expect(linkKindForPair("character", "location")).toBe("appears_at");
    expect(linkKindForPair("location", "character")).toBe("appears_at");
  });
  it("resolves character+thread to drives, order-independent", () => {
    expect(linkKindForPair("character", "thread")).toBe("drives");
    expect(linkKindForPair("thread", "character")).toBe("drives");
  });
  it("rejects location+thread", () => {
    expect(linkKindForPair("location", "thread")).toBeNull();
  });
  it("rejects location+location and thread+thread", () => {
    expect(linkKindForPair("location", "location")).toBeNull();
    expect(linkKindForPair("thread", "thread")).toBeNull();
  });
  it("rejects any pairing involving world_entity or chapter", () => {
    expect(linkKindForPair("character", "world_entity")).toBeNull();
    expect(linkKindForPair("character", "chapter")).toBeNull();
    expect(linkKindForPair("world_entity", "chapter")).toBeNull();
  });
});
