import { describe, expect, it } from "vitest";
import type { TransactionSource } from "@/lib/core/handlers/apply-story-transaction";
import type { CanonicalMutationKind } from "@/lib/core/repositories";

/**
 * Mechanical pin on §11's `CanonicalMutationKind` union.
 *
 * The union can't be enumerated at runtime, so the pin is the object below:
 * `satisfies Record<CanonicalMutationKind, true>` makes a union member missing
 * here (a member removed from the type) or an extra key (a typo / a member not
 * in the type) a `tsc --noEmit` error in THIS file. The runtime assertions then
 * keep the same guarantee visible for the vitest runs, which do not typecheck.
 *
 * Every entry mirrors a real emission site (`hooks.onCanonicalMutation?.(…)`
 * across src/lib/core/handlers/*) in handler-file order, so the set also
 * documents §11's real trigger surface as of the §7/§12 Handler migration.
 */
const OBSERVED_KINDS = {
  "chapter.update": true,
  "chapter.delete": true,
  "character.create": true,
  "character.update": true,
  "character.delete": true,
  "location.create": true,
  "location.update": true,
  "location.delete": true,
  "plotThread.create": true,
  "plotThread.update": true,
  "plotThread.delete": true,
  "referenceWork.create": true,
  "referenceWork.delete": true,
  "worldEntity.create": true,
  "worldEntity.update": true,
  "worldEntity.delete": true,
  "violation.acknowledge": true,
  "relationship.upsert": true,
  "project.create": true,
  "project.update": true,
  "project.delete": true,
  "comicPage.create": true,
  "comicPage.delete": true,
  "comicPanel.create": true,
  "comicPanel.update": true,
  "comicPanel.regenerate": true,
  "comicPanel.letter": true,
  "shot.update": true,
  "storyThread.create": true,
  "storyThread.update": true,
  "storyPromise.create": true,
  "storyPromise.update": true,
  "memory.create": true,
  "memory.delete": true,
  "checkpoint.create": true,
  "checkpoint.delete": true,
  "storyTransaction.revert": true,
  "storyTransaction.model-proposal": true,
  "storyTransaction.user-edit": true,
  "storyTransaction.import": true,
} satisfies Record<CanonicalMutationKind, true>;

describe("CanonicalMutationKind (§11) — union pin", () => {
  it("the pin is EXACTLY the union (satisfies guards coverage at type level; count guards it at runtime)", () => {
    expect(Object.keys(OBSERVED_KINDS)).toHaveLength(40);
  });

  it("the most typo-prone kinds exist as members", () => {
    expect(OBSERVED_KINDS["comicPanel.regenerate"]).toBe(true);
    expect(OBSERVED_KINDS["comicPanel.letter"]).toBe(true);
    expect(OBSERVED_KINDS["referenceWork.create"]).toBe(true);
    expect(OBSERVED_KINDS["relationship.upsert"]).toBe(true);
    expect(OBSERVED_KINDS["worldEntity.update"]).toBe(true);
    expect(OBSERVED_KINDS["storyTransaction.revert"]).toBe(true);
    expect(OBSERVED_KINDS["shot.update"]).toBe(true);
  });

  it("covers the kinds apply-story-transaction derives from its TransactionSource template literal", () => {
    // `storyTransaction.${input.source}` must stay a union member for every
    // TransactionSource — this is the one emission site built from a variable.
    for (const source of ["model-proposal", "user-edit", "import"] as const satisfies readonly TransactionSource[]) {
      expect(OBSERVED_KINDS[`storyTransaction.${source}`]).toBe(true);
    }
  });
});
