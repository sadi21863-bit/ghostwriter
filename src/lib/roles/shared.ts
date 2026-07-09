import type { NextResponse } from "next/server";
import { anthropic } from "@/lib/ai/client";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";

export interface MeteredCallParams {
  userId: string;
  operation: string;
  model: string;
  system: string | any[];
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export type MeteredCallResult =
  | { ok: true; text: string }
  | { ok: false; response: NextResponse };

/**
 * The single call path every Director/Writer/Editor tool route goes through:
 * gate + meter credits, call the model, refund on failure. Centralizing this
 * makes metering structurally impossible to skip (the 2026-07-05 audit found
 * 8 tool routes that called the model directly and never metered at all).
 *
 * On failure the original error is re-thrown after refunding, so each route's
 * own try/catch keeps shaping its existing error response — this only
 * replaces the "meter + call + refund" boilerplate, not each route's
 * request-parsing or response-shaping logic.
 */
export async function runMeteredCall(params: MeteredCallParams): Promise<MeteredCallResult> {
  const gate = await meterAndGate(params.userId, params.operation);
  if (gate) return { ok: false, response: gate };

  try {
    // Streaming, not .create() - found the hard way via a real large-chapter
    // Director call: Anthropic's SDK rejects a synchronous request outright
    // once max_tokens is large enough that the call *might* run past 10
    // minutes ("Streaming is required for operations that may take longer
    // than 10 minutes"), and Sonnet 5's default-on adaptive thinking means
    // real multi-chapter prompts can need a large budget. Streaming sidesteps
    // the timeout risk entirely regardless of maxTokens, so it's the safe
    // default for every caller here, not just the ones with large budgets.
    const stream = anthropic.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
    });
    const msg = await stream.finalMessage();
    const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    return { ok: true, text };
  } catch (e) {
    await refundCredits(params.userId, params.operation);
    throw e;
  }
}
