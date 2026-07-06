// Pure helpers for the Promise Tracker panel (storyThreads/storyPromises/
// storyCheckpoints — see src/db/schema.ts). Kept out of the React component so
// the priority/status color+label mapping is unit-testable without a DOM.
// Deliberately named "Promise Tracker" rather than "Threads" to avoid colliding
// with the World Bible's existing, separate plotThreads "Threads" tab.

export type PromisePriority = "A" | "B" | "C" | string;
export type PromiseStatus = "open" | "paid_off" | string;
export type ThreadStatus = "open" | "resolved" | string;

const PRIORITY_COLOR: Record<string, string> = {
  A: "#ef4444",
  B: "#f59e0b",
  C: "#6b7280",
};

/** Traffic-light-ish color for a promise's priority (A highest urgency). Unknown
 * priorities fall back to the same neutral color as "C". */
export function priorityColor(priority: PromisePriority): string {
  return PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.C;
}

const PROMISE_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  paid_off: "Paid Off",
};

/** Humanize a storyPromises.status value. Unknown values are title-cased as a
 * safe fallback rather than showing a raw snake_case string. */
export function promiseStatusLabel(status: PromiseStatus): string {
  if (PROMISE_STATUS_LABEL[status]) return PROMISE_STATUS_LABEL[status];
  return status
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const THREAD_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  resolved: "Resolved",
};

/** Humanize a storyThreads.status value. Same fallback shape as promiseStatusLabel. */
export function threadStatusLabel(status: ThreadStatus): string {
  if (THREAD_STATUS_LABEL[status]) return THREAD_STATUS_LABEL[status];
  return status
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
