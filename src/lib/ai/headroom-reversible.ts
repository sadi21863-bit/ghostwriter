// Headroom — reversible compression (the CCR concept from the real Headroom lib,
// github.com/chopratejas/headroom). The signature idea our first cut missed:
// compress context before it reaches the model, but CACHE THE ORIGINAL locally so
// the full source can be retrieved on demand. Compressed context goes to the LLM;
// nothing is lost because the original is one `retrieve(token)` away.
//
// The compressor is injected and defaults to our deterministic lossless
// `compactContext`. It can be swapped for the real Headroom engines (LLMLingua-2
// for prose, schema-aware for structured) or content-type routing later — this
// module owns the reversible cache + accounting, not the compression algorithm.
import { compactContext, estimateTokens } from "@/lib/ai/headroom";

export type Compressor = (text: string) => string;

export interface CompressedRef {
  /** Opaque token to retrieve the original via the store. */
  token: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
}

export interface ReversibleStore {
  /** Compress `text`, cache the original, return the compressed form + a retrieval token. */
  compress(text: string, compressor?: Compressor): CompressedRef;
  /** Fetch the original text for a token (undefined if unknown/evicted). */
  retrieve(token: string): string | undefined;
  /** Aggregate savings, for a "Headroom saved N tokens" readout. */
  stats(): { entries: number; originalTokens: number; compressedTokens: number; tokensSaved: number };
}

// Small, dependency-free content hash so identical originals share a token (dedupe).
function hashKey(s: string): string {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "hr:" + (h >>> 0).toString(16);
}

/** In-memory reversible store. Swap the backing map for a cache/DB to persist. */
export function createReversibleStore(): ReversibleStore {
  const originals = new Map<string, string>();
  let origTokens = 0;
  let compTokens = 0;

  return {
    compress(text, compressor = compactContext) {
      const token = hashKey(text);
      if (!originals.has(token)) originals.set(token, text);
      const compressed = compressor(text);
      const originalTokens = estimateTokens(text);
      const compressedTokens = estimateTokens(compressed);
      origTokens += originalTokens;
      compTokens += compressedTokens;
      return { token, compressed, originalTokens, compressedTokens };
    },
    retrieve(token) {
      return originals.get(token);
    },
    stats() {
      return {
        entries: originals.size,
        originalTokens: origTokens,
        compressedTokens: compTokens,
        tokensSaved: origTokens - compTokens,
      };
    },
  };
}
