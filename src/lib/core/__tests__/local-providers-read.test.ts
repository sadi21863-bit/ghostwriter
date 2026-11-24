/**
 * Phase 4 slice 4c — provider portability's routing + visibility half, pinned
 * at two layers:
 *
 *  - the module: `resolveProfileRouting` (§12.1 tier→slot routing over REAL
 *    `MODE_REGISTRY` modes), `makeProfileChooseProvider` (an unset profile
 *    composes NOTHING — the port is omitted, the pipeline keeps its own
 *    `{provider:"default", model:"default"}` placeholder path), and
 *    `makeLocalProvidersReadPort` ( injected detection + presence-only env
 *    reads — the full read deep-equals a fixture carrying ZERO secret strings
 *    even when the env carries non-empty key VALUES);
 *  - the transport: `GET /providers` over `dispatchLoopback` (the snapshot
 *    suite's minimal-deps pattern, tripled here rather than imported across
 *    test files) — 501 by default like every optional cluster, 401 BEFORE
 *    routing, 200 with the exact visibility body once the composition root
 *    plants the read, and the DEFAULT-composed read (real `detectLocalProviders`
 *    against zero live localhost servers, capped at a fast probe) answering
 *    `detected: []` — honest reality, never a hidden fallback.
 *
 * No test path touches a real model server; the only real detection probe is
 * one deliberately-dead loopback port with a tight timeout.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  makeProfileChooseProvider,
  makeLocalProvidersReadPort,
  resolveProfileRouting,
  type ProfileRouting,
} from "@/lib/core/local-provider-routing";
import type { DetectedLocalProvider } from "@/lib/core/local-provider-adapter";
import { readLocalGenerationProfile, type LocalGenerationProfile } from "@/lib/core/local-generation-profile";
import { MODE_REGISTRY } from "@/lib/modes/registry";
import {
  defaultLocalRoutes,
  dispatchLoopback,
  type DefaultRouteDeps,
} from "@/lib/core/local-host";

/**
 * Two REAL registry modes — one tiered "default", one tiered "quality" —
 * derived from MODE_REGISTRY itself instead of hand-named, so registry drift
 * cannot silently uncouple the tests from the engine's tier mapping.
 */
function realModeWithTier(tier: "default" | "quality"): string {
  const found = Object.entries(MODE_REGISTRY).find(([, cfg]) => cfg.modelTier === tier);
  if (!found) throw new Error(`no real mode carries modelTier "${tier}"`);
  return found[0];
}
const DEFAULT_TIER_MODE = realModeWithTier("default");
const QUALITY_TIER_MODE = realModeWithTier("quality");

/**
 * The exact env var names the profile module reads — fixtures are built
 * through `readLocalGenerationProfile` itself, never by inventing names.
 */
const SLOT_ENV = {
  "GW_LOCAL_PROVIDER": "anthropic",
  "GW_LOCAL_MODEL": "local-sonnet-x",
  "GW_LOCAL_FAST_MODEL": "local-haiku-x",
  "GW_LOCAL_QUALITY_MODEL": "local-opus-x",
} as const satisfies Record<string, string>;

/** A non-empty (but fake) credential VALUE the presence pin must never leak. */
const SECRET = "sk-test-secret-1";

const DETECTED: DetectedLocalProvider = {
  baseUrl: "http://127.0.0.1:11434/v1",
  label: "Ollama",
  models: ["qwen3:8b", "llama3.1"],
};

describe("resolveProfileRouting (§12.1 — mode tier → profile slot)", () => {
  it("an unset profile resolves the pipeline's own placeholder, never a provider from nothing", () => {
    expect(resolveProfileRouting(null, DEFAULT_TIER_MODE)).toEqual({
      provider: "default",
      model: "default",
    });
    expect(resolveProfileRouting(null, QUALITY_TIER_MODE)).toEqual({
      provider: "default",
      model: "default",
    });
  }, 20000);

  it("a configured slot wins per tier: default-tier and quality-tier REAL modes", () => {
    const profile = readLocalGenerationProfile({ ...SLOT_ENV });
    expect(profile.provider).toBe("anthropic");
    expect(resolveProfileRouting(profile, DEFAULT_TIER_MODE)).toEqual({
      provider: "anthropic",
      model: SLOT_ENV["GW_LOCAL_MODEL"],
    });
    expect(resolveProfileRouting(profile, QUALITY_TIER_MODE)).toEqual({
      provider: "anthropic",
      model: SLOT_ENV["GW_LOCAL_QUALITY_MODEL"],
    });
  }, 20000);

  it.each(["fast", "default", "quality"] as const)(
    "a mode tiered %s selects exactly that profile slot (the tier vocabulary, driven with a real mode)",
    (tier) => {
      const registry = MODE_REGISTRY as unknown as Record<string, { modelTier?: string }>;
      const original = registry[QUALITY_TIER_MODE];
      registry[QUALITY_TIER_MODE] = {
        ...(original as object),
        modelTier: tier,
      } as never;
      try {
        const model = readLocalGenerationProfile({ ...SLOT_ENV }).models[tier];
        expect(model).toBeTruthy();
        expect(resolveProfileRouting(readLocalGenerationProfile({ ...SLOT_ENV }), QUALITY_TIER_MODE)).toEqual({
          provider: SLOT_ENV["GW_LOCAL_PROVIDER"],
          model,
        });
      } finally {
        // Never leave the shared registry mutated for another test.
        registry[QUALITY_TIER_MODE] = original;
      }
    },
    20000,
  );

  it("a tier outside fast/default/quality falls to the default slot (the guard)", () => {
    const registry = MODE_REGISTRY as unknown as Record<string, { modelTier?: string }>;
    const original = registry[QUALITY_TIER_MODE];
    registry[QUALITY_TIER_MODE] = {
      ...(original as object),
      modelTier: "hyper-future-tier",
    } as never;
    try {
      const profile = readLocalGenerationProfile({ ...SLOT_ENV });
      expect(resolveProfileRouting(profile, QUALITY_TIER_MODE)).toEqual({
        provider: "anthropic",
        model: SLOT_ENV["GW_LOCAL_MODEL"],
      });
    } finally {
      registry[QUALITY_TIER_MODE] = original;
    }
  }, 20000);

  it("an unknown mode (cfg undefined) falls to the default tier's slot", () => {
    const profile = readLocalGenerationProfile({ ...SLOT_ENV });
    expect(resolveProfileRouting(profile, "cohost")).toEqual({
      provider: "anthropic",
      model: SLOT_ENV["GW_LOCAL_MODEL"],
    });
  }, 20000);

  it("a null slot on the chosen tier falls to the pipeline's placeholder model", () => {
    const qualityOnly = readLocalGenerationProfile({
      "GW_LOCAL_PROVIDER": "anthropic",
      "GW_LOCAL_QUALITY_MODEL": SLOT_ENV["GW_LOCAL_QUALITY_MODEL"],
    });
    expect(resolveProfileRouting(qualityOnly, QUALITY_TIER_MODE)).toEqual({
      provider: "anthropic",
      model: SLOT_ENV["GW_LOCAL_QUALITY_MODEL"],
    });
    expect(resolveProfileRouting(qualityOnly, DEFAULT_TIER_MODE)).toEqual({
      provider: "anthropic",
      model: "default",
    });
  }, 20000);
});

describe("makeProfileChooseProvider (the optional routing port a bundle may carry)", () => {
  it("an UNSET profile composes NOTHING: null profile → undefined", () => {
    expect(makeProfileChooseProvider(null)).toBeUndefined();
  }, 20000);

  it("a provider with every model slot null composes NOTHING — no port that pretends to route", () => {
    const providerOnly = readLocalGenerationProfile({
      "GW_LOCAL_PROVIDER": "anthropic",
      "GW_LOCAL_MODEL": "   ", // whitespace is unset per the profile reader
    });
    expect(providerOnly.provider).toBe("anthropic");
    expect(providerOnly.models).toEqual({ default: null, fast: null, quality: null });
    expect(makeProfileChooseProvider(providerOnly)).toBeUndefined();
  }, 20000);

  it("a provider with any slot set composes the port, resolving exact routing per REAL mode tier", async () => {
    const choose = makeProfileChooseProvider(readLocalGenerationProfile({ ...SLOT_ENV }));
    expect(choose).toBeTypeOf("function");
    // Plain StageOutcome return — the pipeline awaits a bare value, a stop
    // never rides ({provider, model} carries no `stop` key).
    expect(await choose!({ mode: DEFAULT_TIER_MODE, prompt: "p" } as never)).toEqual({
      provider: "anthropic",
      model: SLOT_ENV["GW_LOCAL_MODEL"],
    });
    expect(await choose!({ mode: QUALITY_TIER_MODE, prompt: "p" } as never)).toEqual({
      provider: "anthropic",
      model: SLOT_ENV["GW_LOCAL_QUALITY_MODEL"],
    });
  }, 20000);

  it("a fast-only profile routes default-tier modes to the placeholder (no quality slot to serve)", async () => {
    const fastOnly = readLocalGenerationProfile({
      "GW_LOCAL_PROVIDER": "anthropic",
      "GW_LOCAL_FAST_MODEL": SLOT_ENV["GW_LOCAL_FAST_MODEL"],
    });
    const choose = makeProfileChooseProvider(fastOnly);
    expect(choose).toBeTypeOf("function");
    expect(await choose!({ mode: QUALITY_TIER_MODE, prompt: "p" } as never)).toEqual({
      provider: "anthropic",
      model: "default",
    });
  }, 20000);
});

describe("makeLocalProvidersReadPort (the §12 provider-visibility read)", () => {
  it("rides the injected detection verbatim and never throws", async () => {
    const read = await makeLocalProvidersReadPort(null, { detect: async () => [DETECTED] }).read();
    expect(read.detected).toEqual([DETECTED]);
    // A detect that honestly finds nothing is carried as [] (reality, not a
    // hidden fallback).
    const none = await makeLocalProvidersReadPort(null, { detect: async () => [] }).read();
    expect(none.detected).toEqual([]);
  }, 20000);

  it("the routing mirrors the profile VERBATIM — the SETTING, not a resolution", async () => {
    const profile = readLocalGenerationProfile({ ...SLOT_ENV });
    const { routing } = await makeLocalProvidersReadPort(profile, { detect: async () => [], env: {} }).read();
    expect(routing).toEqual({
      provider: profile.provider,
      models: profile.models,
    } satisfies ProfileRouting);
  }, 20000);

  it("the full read is exactly booleans + routing + detected — no key VALUE ever rides (the presence-only pin)", async () => {
    const secretEnv: Record<string, string | undefined> = {
      ...SLOT_ENV,
      "GW_LOCAL_API_KEY": SECRET,
      "GW_LOCAL_OPENAI_API_KEY": SECRET,
      "GW_LOCAL_SEGMIND_API_KEY": SECRET,
    };
    const profile: LocalGenerationProfile = readLocalGenerationProfile(secretEnv);
    const read = await makeLocalProvidersReadPort(profile, {
      detect: async () => [DETECTED],
      env: secretEnv,
    }).read();
    expect(read).toEqual({
      routing: {
        provider: "anthropic",
        models: {
          default: SLOT_ENV["GW_LOCAL_MODEL"],
          fast: SLOT_ENV["GW_LOCAL_FAST_MODEL"],
          quality: SLOT_ENV["GW_LOCAL_QUALITY_MODEL"],
        },
      },
      keyPresence: { anthropic: true, openai: true, segmind: true },
      detected: [DETECTED],
    });
    // Belt and braces over the digital pin: the secret never serializes.
    expect(JSON.stringify(read)).not.toContain(SECRET);
  }, 20000);

  it("a null-profile read stays safe and honest — routing all null, presence computed from env anyway", async () => {
    const read = await makeLocalProvidersReadPort(null, {
      detect: async () => [DETECTED],
      env: { "GW_LOCAL_SEGMIND_API_KEY": SECRET },
    }).read();
    expect(read).toEqual({
      routing: { provider: null, models: { default: null, fast: null, quality: null } },
      keyPresence: { anthropic: false, openai: false, segmind: true },
      detected: [DETECTED],
    });
    expect(JSON.stringify(read)).not.toContain(SECRET);
  }, 20000);

  it("empty-string env vars are NOT presence (the profile reader's own convention)", async () => {
    const read = await makeLocalProvidersReadPort(null, {
      detect: async () => [],
      env: {
        "GW_LOCAL_API_KEY": "",
        "GW_LOCAL_OPENAI_API_KEY": "   ",
        "GW_LOCAL_SEGMIND_API_KEY": "present",
      },
    }).read();
    expect(read.keyPresence).toEqual({ anthropic: false, openai: true, segmind: true });
  }, 20000);
});

describe("GET /providers over the loopback transport (dispatchLoopback, the snapshot suite's pattern)", () => {
  const minimalRepos = (): DefaultRouteDeps =>
    ({
      chapterRepo: { ownsProject: async () => true, updateScoped: async () => null, deleteScoped: async () => undefined },
      storyBibleRepo: { ownsProject: async () => true, readSections: async () => ({}) },
      storyTransactionRepo: { ownsProject: async () => true, record: async () => undefined, applyChanges: async () => undefined },
    }) as DefaultRouteDeps;
  const TOKEN = "c".repeat(64);
  const req = (method: string, path: string, body?: string, token = TOKEN): Parameters<typeof dispatchLoopback>[0] => ({
    method,
    path,
    headers: { authorization: token ? `Bearer ${token}` : "", origin: "" },
    body: body ? Buffer.from(body, "utf8") : null,
  });

  it("501 by default — every optional cluster answers 501 until a composition root plants the port", async () => {
    const out = await dispatchLoopback(req("GET", "/providers"), {
      expectedToken: TOKEN,
      routes: defaultLocalRoutes(minimalRepos()),
    });
    expect(out.status).toBe(501);
    expect(out.body).toEqual({
      ok: false,
      status: 501,
      reason: "Provider visibility is not configured for this host.",
    });
  }, 20000);

  it("401 BEFORE routing for an unauthenticated bearer — visibility requires the owner token too", async () => {
    const routes = defaultLocalRoutes({
      ...(minimalRepos() as object),
      providersRead: makeLocalProvidersReadPort(readLocalGenerationProfile({ ...SLOT_ENV }), {
        detect: async () => [DETECTED],
        env: {},
      }),
    } as DefaultRouteDeps);
    const out = await dispatchLoopback(req("GET", "/providers", undefined, ""), {
      expectedToken: TOKEN,
      routes,
    });
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: "unauthorized" });
  }, 20000);

  it("200 with the exact visibility body once the composition root plants the real read port", async () => {
    const secretEnv: Record<string, string | undefined> = {
      ...SLOT_ENV,
      "GW_LOCAL_API_KEY": SECRET,
      "GW_LOCAL_OPENAI_API_KEY": SECRET,
    };
    const routes = defaultLocalRoutes({
      ...(minimalRepos() as object),
      providersRead: makeLocalProvidersReadPort(readLocalGenerationProfile(secretEnv), {
        detect: async () => [DETECTED],
        env: secretEnv,
      }),
    } as DefaultRouteDeps);
    const out = await dispatchLoopback(req("GET", "/providers"), {
      expectedToken: TOKEN,
      routes,
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      routing: {
        provider: "anthropic",
        models: {
          default: SLOT_ENV["GW_LOCAL_MODEL"],
          fast: SLOT_ENV["GW_LOCAL_FAST_MODEL"],
          quality: SLOT_ENV["GW_LOCAL_QUALITY_MODEL"],
        },
      },
      keyPresence: { anthropic: true, openai: true, segmind: false },
      detected: [DETECTED],
    });
    // The wire carries no credential value, only its presence.
    expect(JSON.stringify(out.body)).not.toContain(SECRET);
  }, 20000);

  it("the DEFAULT-composed read over zero live localhost servers answers detected: [] — honest reality, capped fast", async () => {
    const routes = defaultLocalRoutes({
      ...(minimalRepos() as object),
      providersRead: makeLocalProvidersReadPort(null, {
        // The REAL detection, but pointed at one dead loopback port with a
        // tight timeout so the read stays fast and deterministic.
        detectOpts: { probes: [{ port: 1, label: "dead" }], timeoutMs: 1000 },
        env: {},
      }),
    } as DefaultRouteDeps);
    const out = await dispatchLoopback(req("GET", "/providers"), {
      expectedToken: TOKEN,
      routes,
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      routing: { provider: null, models: { default: null, fast: null, quality: null } },
      keyPresence: { anthropic: false, openai: false, segmind: false },
      detected: [],
    });
  }, 20000);
});

describe("local provider routing — source purity (live-shell-reachability convention)", () => {
  it("never imports the Neon side, the pg schema, or the Next runtime", () => {
    const source = readFileSync(join(__dirname, "../local-provider-routing.ts"), "utf-8");
    expect(source).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
    expect(source).not.toMatch(/"next(\/|-auth)?"/);
    expect(source).not.toMatch(/@neondatabase\/serverless/);
  }, 20000);
});
