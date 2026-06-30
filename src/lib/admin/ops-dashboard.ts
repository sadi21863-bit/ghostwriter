export interface EventCount {
  event: string;
  count: number;
}

/** Turns the analytics route's `Record<event, count>` into a count-descending list for display. */
export function rankEventCounts(counts: Record<string, number>): EventCount[] {
  return Object.entries(counts)
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count);
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
