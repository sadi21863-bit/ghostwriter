// Pure drag-reorder helper for Phase C's filmstrip (shots) and panel grid
// (comic panels) — kept out of the React components so the reordering math is
// unit-testable without a DOM/drag-event simulation. sortOrder (shots) and
// panelIndex (comic panels) already existed in the schema; this is only the
// missing "compute the new order" step the doc's own note called out
// ("sortOrder already exists... it's just never exposed to the UI").

/**
 * Move `draggedId` to just before `targetId` in an ordered list of ids. Pure —
 * returns a new array, never mutates. No-ops (returns the original array
 * reference) when the ids are equal or targetId isn't found.
 */
export function reorderIds(ids: string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId) return ids;
  const without = ids.filter(id => id !== draggedId);
  const targetIdx = without.indexOf(targetId);
  if (targetIdx === -1) return ids;
  return [...without.slice(0, targetIdx), draggedId, ...without.slice(targetIdx)];
}

/**
 * Given a freshly-reordered id list, return only the {id, order} pairs whose
 * order actually changed vs. the original order map — so the caller only
 * PATCHes the shots/panels that genuinely moved, not the whole list.
 */
export function changedOrders(
  reorderedIds: string[],
  originalOrderById: Record<string, number>,
): { id: string; order: number }[] {
  const changed: { id: string; order: number }[] = [];
  reorderedIds.forEach((id, i) => {
    if (originalOrderById[id] !== i) changed.push({ id, order: i });
  });
  return changed;
}
