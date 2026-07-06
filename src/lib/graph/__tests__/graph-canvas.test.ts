import { describe, it, expect } from "vitest";
import {
  selectionKinds, confirmMessageFor, isOptionActionable, blockedReasonText, nodeHealthAccent, linkKindForPair,
  capabilityNodeId, isCapabilityNodeId, capabilityIdFromNodeId, layoutCapabilityNodes, planForConnectionTarget,
  isSubgraphNodeId, subgraphNodeId, collapseSelection, nodesHiddenBySubgraphs, expandSubgraph, type SubgraphNode,
} from "../graph-canvas";
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

describe("capability node id helpers", () => {
  it("round-trips a capability id through capabilityNodeId/capabilityIdFromNodeId", () => {
    const nodeId = capabilityNodeId("villain_pov");
    expect(isCapabilityNodeId(nodeId)).toBe(true);
    expect(capabilityIdFromNodeId(nodeId)).toBe("villain_pov");
  });
  it("does not mistake a real entity id for a capability node", () => {
    expect(isCapabilityNodeId("char-abc-123")).toBe(false);
    expect(capabilityIdFromNodeId("char-abc-123")).toBeNull();
  });
});

describe("layoutCapabilityNodes", () => {
  it("stacks one node per option, vertically centered on the anchor, offset to the right", () => {
    const options = [plan({ capabilityId: "a" }), plan({ capabilityId: "b" }), plan({ capabilityId: "c" })];
    const laid = layoutCapabilityNodes(options, { x: 100, y: 100 }, 50);
    expect(laid).toHaveLength(3);
    expect(laid.map(l => l.capabilityId)).toEqual(["a", "b", "c"]);
    expect(laid.every(l => l.x === 260)).toBe(true);
    // Centered: middle option lands exactly on the anchor's y.
    expect(laid[1].y).toBe(100);
    expect(laid[0].y).toBe(50);
    expect(laid[2].y).toBe(150);
  });

  it("returns an empty array for no options", () => {
    expect(layoutCapabilityNodes([], { x: 0, y: 0 })).toEqual([]);
  });
});

describe("planForConnectionTarget", () => {
  const options = [plan({ capabilityId: "villain_pov" }), plan({ capabilityId: "tension_curve" })];

  it("returns the matching plan when the target is a capability node in the current options", () => {
    const result = planForConnectionTarget(capabilityNodeId("tension_curve"), options);
    expect(result?.capabilityId).toBe("tension_curve");
  });

  it("returns null when the target is a real entity node, not a capability icon", () => {
    expect(planForConnectionTarget("char-abc-123", options)).toBeNull();
  });

  it("returns null when the target is a capability node but no longer in the current options (selection changed)", () => {
    expect(planForConnectionTarget(capabilityNodeId("stale_capability"), options)).toBeNull();
  });

  it("returns null for a null/undefined target or null options", () => {
    expect(planForConnectionTarget(null, options)).toBeNull();
    expect(planForConnectionTarget(capabilityNodeId("villain_pov"), null)).toBeNull();
  });
});

describe("subgraph node id helpers", () => {
  it("round-trips a raw id through subgraphNodeId/isSubgraphNodeId", () => {
    const nodeId = subgraphNodeId("abc-123");
    expect(isSubgraphNodeId(nodeId)).toBe(true);
  });
  it("does not mistake a real entity id or a capability node id for a subgraph node", () => {
    expect(isSubgraphNodeId("char-abc-123")).toBe(false);
    expect(isSubgraphNodeId(capabilityNodeId("villain_pov"))).toBe(false);
  });
});

describe("collapseSelection", () => {
  it("returns null for fewer than 2 members — collapsing one node is just renaming, not grouping", () => {
    expect(collapseSelection([{ id: "a", position: { x: 0, y: 0 } }], "Solo", "raw-1")).toBeNull();
  });

  it("computes the centroid and collects member ids", () => {
    const sg = collapseSelection(
      [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 100, y: 0 } },
        { id: "c", position: { x: 50, y: 100 } },
      ],
      "Hero's Journey",
      "raw-1",
    );
    expect(sg).not.toBeNull();
    expect(sg!.label).toBe("Hero's Journey");
    expect(sg!.memberIds).toEqual(["a", "b", "c"]);
    expect(sg!.centroid).toEqual({ x: 50, y: 100 / 3 });
    expect(isSubgraphNodeId(sg!.id)).toBe(true);
  });

  it("falls back to a default label when given a blank one", () => {
    const sg = collapseSelection(
      [{ id: "a", position: { x: 0, y: 0 } }, { id: "b", position: { x: 0, y: 0 } }],
      "   ",
      "raw-2",
    );
    expect(sg!.label).toBe("Untitled arc");
  });
});

describe("nodesHiddenBySubgraphs / expandSubgraph", () => {
  function sg(over: Partial<SubgraphNode>): SubgraphNode {
    return { id: "sg-1", label: "Arc", memberIds: [], centroid: { x: 0, y: 0 }, ...over };
  }

  it("unions member ids across multiple active subgraphs", () => {
    const hidden = nodesHiddenBySubgraphs([
      sg({ id: "sg-1", memberIds: ["a", "b"] }),
      sg({ id: "sg-2", memberIds: ["c"] }),
    ]);
    expect(hidden).toEqual(new Set(["a", "b", "c"]));
  });

  it("returns an empty set with no active subgraphs", () => {
    expect(nodesHiddenBySubgraphs([])).toEqual(new Set());
  });

  it("expandSubgraph removes only the matching subgraph, revealing its members again", () => {
    const subgraphs = [sg({ id: "sg-1", memberIds: ["a"] }), sg({ id: "sg-2", memberIds: ["b"] })];
    const remaining = expandSubgraph(subgraphs, "sg-1");
    expect(remaining.map(s => s.id)).toEqual(["sg-2"]);
  });

  it("expandSubgraph is a no-op when the id doesn't match any active subgraph", () => {
    const subgraphs = [sg({ id: "sg-1" })];
    expect(expandSubgraph(subgraphs, "sg-nonexistent")).toEqual(subgraphs);
  });
});
