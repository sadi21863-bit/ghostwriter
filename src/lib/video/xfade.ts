// Pure ffmpeg xfade filter_complex graph builder — no ffmpeg, no I/O, so the
// offset math is unit-testable without spawning a real process. Chains xfade
// across N clips using the standard cumulative-offset formula: each transition
// starts `transitionDuration` seconds before the running total would
// otherwise end, and the running total shrinks by `transitionDuration` each
// time two clips are merged (the overlap is shared, not duplicated).

export interface XfadeFilterGraph {
  filterComplex: string;
  finalLabel: string;
}

/**
 * Clamp the requested transition duration so it can never exceed (or come too
 * close to) the shortest clip's own length — an unclamped value could produce
 * a negative or invalid xfade offset for a very short shot.
 */
function safeTransitionDuration(durations: number[], requested: number): number {
  const shortest = Math.min(...durations);
  return Math.min(requested, shortest * 0.4);
}

export function buildXfadeFilterComplex(durations: number[], transitionDuration: number): XfadeFilterGraph {
  if (durations.length < 2) {
    throw new Error("buildXfadeFilterComplex needs at least 2 clip durations to chain a transition.");
  }
  const t = safeTransitionDuration(durations, transitionDuration);

  let prevLabel = "0:v";
  let cumulative = durations[0];
  const parts: string[] = [];

  for (let i = 1; i < durations.length; i++) {
    const offset = cumulative - t;
    const outLabel = i === durations.length - 1 ? "vout" : `v${i}`;
    parts.push(`[${prevLabel}][${i}:v]xfade=transition=fade:duration=${t}:offset=${offset.toFixed(3)}[${outLabel}]`);
    cumulative = cumulative + durations[i] - t;
    prevLabel = outLabel;
  }

  return { filterComplex: parts.join(";"), finalLabel: "vout" };
}
