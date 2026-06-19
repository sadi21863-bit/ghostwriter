// Regression test for the launch-blocking Audio Novel freeze bug (2026-06-20):
// the route looped `openai.audio.speech.create()` sequentially over every
// chapter segment with no `maxDuration` export, so a full chapter (many
// segments) could run past Vercel's default function timeout and get killed
// mid-run with no response ever reaching the client — a "Generate Audio"
// click that never resolves. This is a static source-text check (the route
// imports `openai`/`@vercel/blob` at module scope, so importing it directly
// would require mocking the whole AI/storage stack for no extra value here).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("audio generate route", () => {
  it("declares a maxDuration long enough for a multi-segment TTS loop", () => {
    const match = SOURCE.match(/export const maxDuration\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(300);
  });
});
