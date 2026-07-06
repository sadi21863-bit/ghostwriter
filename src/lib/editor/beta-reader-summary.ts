// Pure, deterministic summary of a beta-reader panel run — no extra LLM call,
// so the headline is free. Kept separate from the route so it's unit-testable
// without a DOM or a mocked Anthropic client.

export type BetaVerdict = "would_continue" | "might_stop" | "would_dnf" | string;

export interface BetaPanelSummary {
  continueCount: number;
  mightStopCount: number;
  dnfCount: number;
  headline: string;
}

export function summarizeBetaPanel(results: { persona: string; verdict: BetaVerdict }[]): BetaPanelSummary {
  const continueCount = results.filter(r => r.verdict === "would_continue").length;
  const mightStopCount = results.filter(r => r.verdict === "might_stop").length;
  const dnfCount = results.filter(r => r.verdict === "would_dnf").length;
  const total = results.length;

  let headline: string;
  if (total === 0) {
    headline = "No reader responses to summarize.";
  } else if (dnfCount > 0) {
    headline = `${dnfCount} of ${total} reader${total === 1 ? "" : "s"} flagged a likely DNF point.`;
  } else if (mightStopCount > 0) {
    headline = `${mightStopCount} of ${total} reader${total === 1 ? "" : "s"} might stop reading here.`;
  } else {
    headline = `${continueCount} of ${total} reader${total === 1 ? "" : "s"} would keep going.`;
  }

  return { continueCount, mightStopCount, dnfCount, headline };
}
