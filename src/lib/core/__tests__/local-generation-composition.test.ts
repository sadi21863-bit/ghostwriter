/**
 * Master-plan Phase 4 slice 4d — the composed generation bundle
 * (`local-generation-composition.ts`). Every assertion here is a COMPOSITION
 * decision or an identity, never binder/adapter behavior: the binder factory
 * and both adapter factories are injected doubles (their real bodies are
 * owned by their own suites), detection is injected (or drives the real
 * closed-localhost refusal), and the only touches of the real world are
 * `readLocalGenerationProfile` fixture builds and in-memory SQLite handles
 * the composition never queries.
 *
 * Pinned verbatim-category (§5.6, via the module header):
 *  - unset/empty `GW_LOCAL_GENERATION` ⇒ `null` (boot default OFF, no noise);
 *  - `auto` ⇒ the first DETECTED localhost target composes the
 *    OpenAI-compatible adapter with NO key of any kind — the secret-egress
 *    pin builds a profile with `hasOpenAIKey` and an env carrying the key's
 *    VALUE, and the endpoint the adapter factory receives must serialize
 *    without either secret;
 *  - `generic` / `anthropic` ⇒ explicit operator plants whose env decision
 *    must be complete (loud `console.error` + `null` otherwise), the key
 *    VALUE riding only there;
 *  - the bundle itself (binder markers, `chooseProvider` iff the profile
 *    routes) is assertable by identity because composition is assembly.
 */

import { describe, it, expect, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import {
  makeLocalGenerationDeps,
  type LocalGenerationCompositionDeps,
} from "@/lib/core/local-generation-composition";
import type { LocalGenerationDeps } from "@/lib/core/local-host";
import { detectLocalProviders, type DetectedLocalProvider } from "@/lib/core/local-provider-adapter";
import type { GenerateChapterPorts } from "@/lib/core/handlers/generate-chapter";
import { readLocalGenerationProfile } from "@/lib/core/local-generation-profile";

// ---------------------------------------------------------------------------
// Triples from scratch (never imported across test files), 4c/4d conventions.
// ---------------------------------------------------------------------------

const created: SqliteDbHandle[] = [];
afterAll(() => {
  for (const h of created) h.sqlite.close();
  created.length = 0;
});

function freshDb(): SqliteDbHandle {
  const h = createSqliteDb(":memory:");
  created.push(h);
  return h;
}

/** Generate doubles — stable identities the composition must carry untoward. */
const openAIGenerate: NonNullable<GenerateChapterPorts["generate"]> = async () => ({
  text: "generated-by-the-openai-double",
  model: "openai-double-model",
  tokensUsed: 7,
});
const anthropicGenerate: NonNullable<GenerateChapterPorts["generate"]> = async () => ({
  text: "generated-by-the-anthropic-double",
  model: "anthropic-double-model",
  tokensUsed: 9,
});

/** The binder factory double: returns THE marker ports, records its deps. */
function binderDouble() {
  const ports = {
    buildContext: async () => ({ static: "marker-static" }),
    loadViolations: async () => ({ op_protagonist: { confirmed: true } }),
    persist: async () => undefined,
  };
  const received: unknown[] = [];
  const buildContextBuilder: LocalGenerationCompositionDeps["buildContextBuilder"] = (deps) => {
    received.push(deps);
    return ports;
  };
  return { buildContextBuilder, ports, received };
}

/** Adapter factory doubles: return THE generate fn, record the endpoint. */
function openAIFactoryDouble() {
  const endpoints: unknown[] = [];
  const makeOpenAIAdapter: NonNullable<LocalGenerationCompositionDeps["makeOpenAIAdapter"]> = (
    endpoint,
  ) => {
    endpoints.push(endpoint);
    return openAIGenerate;
  };
  return { makeOpenAIAdapter, endpoints };
}
function anthropicFactoryDouble() {
  const endpoints: unknown[] = [];
  const makeAnthropicAdapter: NonNullable<LocalGenerationCompositionDeps["makeAnthropicAdapter"]> = (
    endpoint,
  ) => {
    endpoints.push(endpoint);
    return anthropicGenerate;
  };
  return { makeAnthropicAdapter, endpoints };
}

/** Detection doubles: the injected shape `deps.detect` carries. */
function detectDouble(returning: readonly DetectedLocalProvider[]) {
  const calls: number[] = [];
  const detect: LocalGenerationCompositionDeps["detect"] = async () => {
    calls.push(calls.length + 1);
    return returning;
  };
  return { detect, calls };
}

const DETECTED: DetectedLocalProvider = {
  baseUrl: "http://127.0.0.1:11434/v1",
  label: "Ollama",
  models: ["qwen3:8b", "llama3.1"],
};

/**
 * Fake-but-plausible key VALUES. The presence pin never lets `CLOUD_SECRET`
 * reach an auto-composed endpoint; the profile's own read reduces
 * `PROFILE_KEY` to a boolean, so its VALUE never enters the profile either.
 */
const CLOUD_SECRET = "sk-cloud-secret-4d-e8311";
const PROFILE_KEY = "sk-profile-presence-4d";
const OPERATOR_PLANT = "sk-operator-plant-4d";

/**
 * Profile fixtures built through the REAL reader (the 4c convention — every
 * field is real, never hand-shaped). The keyed profile routes (provider +
 * default slot set), so `chooseProvider` must ride.
 */
const ROUTED_PROFILE_WITH_OPENAI_KEY = readLocalGenerationProfile({
  "GW_LOCAL_PROVIDER": "openai-compatible",
  "GW_LOCAL_MODEL": "profile-default-model",
  "GW_LOCAL_OPENAI_API_KEY": PROFILE_KEY,
});
const PROFILE_WITH_DEFAULT_MODEL = readLocalGenerationProfile({
  "GW_LOCAL_MODEL": "profile-default-model",
});
const PROFILE_WITH_ANTHROPIC_PRESENCE = readLocalGenerationProfile({
  "GW_LOCAL_API_KEY": PROFILE_KEY, // presence only — the VALUE never survives
});

function baseDeps(
  overrides: Partial<LocalGenerationCompositionDeps> = {},
): LocalGenerationCompositionDeps {
  return {
    db: freshDb().db,
    localOwnerId: "u-owner-4d",
    profile: null,
    tier: "all_access",
    env: {},
    ...overrides,
  };
}

/** Console capture — the house spy pattern (spies allowed; module-mocking barred). */
function captureConsole() {
  const errors: unknown[][] = [];
  const warnings: unknown[][] = [];
  const err = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
  const warn = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warnings.push(args);
  });
  return { errors, warnings, restore: () => { err.mockRestore(); warn.mockRestore(); } };
}

// ---------------------------------------------------------------------------
// The mode decisions.
// ---------------------------------------------------------------------------

describe("GW_LOCAL_GENERATION decisions — the §5.6 split as composition", () => {
  it("unset or empty env composes NOTHING — null, and no logging noise", async () => {
    const binder = binderDouble();
    const openAI = openAIFactoryDouble();
    const quiet = captureConsole();
    try {
      const unset = await makeLocalGenerationDeps(
        baseDeps({ env: {}, buildContextBuilder: binder.buildContextBuilder, ...openAI }),
      );
      expect(unset).toBeNull();
      const empty = await makeLocalGenerationDeps(
        baseDeps({ env: { "GW_LOCAL_GENERATION": "" }, ...openAI, ...binder }),
      );
      expect(empty).toBeNull();
      // Boot default OFF is silent: no decision was made, so nothing logs.
      expect(quiet.errors).toEqual([]);
      expect(quiet.warnings).toEqual([]);
    } finally {
      quiet.restore();
    }
  }, 20000);

  it("auto with nothing detected → null + the exact warn", async () => {
    const detected = detectDouble([]);
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const quiet = captureConsole();
    try {
      const deps = await makeLocalGenerationDeps(
        baseDeps({
          env: { "GW_LOCAL_GENERATION": "auto" },
          profile: ROUTED_PROFILE_WITH_OPENAI_KEY,
          ...detected,
          ...openAI,
          ...binder,
        }),
      );
      expect(deps).toBeNull();
      expect(quiet.warnings).toEqual([
        ["[local-generation] no localhost provider detected — generation stays OFF"],
      ]);
      expect(quiet.errors).toEqual([]);
      // Nothing was composed ahead of the refusal — no adapter, no binder.
      expect(openAI.endpoints).toEqual([]);
      expect(binder.received).toEqual([]);
    } finally {
      quiet.restore();
    }
  }, 20000);

  it("auto with a detected target composes the OpenAI adapter — the SECRET-EGRESS PIN", async () => {
    // A profile carrying the openai-key PRESENCE + a composition env carrying
    // the key's VALUE: neither may reach the detected-localhost endpoint.
    const detected = detectDouble([DETECTED]);
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const deps = await makeLocalGenerationDeps(
      baseDeps({
        env: {
          "GW_LOCAL_GENERATION": "auto",
          "GW_LOCAL_OPENAI_API_KEY": CLOUD_SECRET,
        },
        profile: ROUTED_PROFILE_WITH_OPENAI_KEY,
        ...detected,
        ...openAI,
        ...binder,
      }),
    );
    expect(deps).not.toBeNull();
    // `generate` is the injected factory's return — identity, not a copy.
    expect(deps!.generate).toBe(openAIGenerate);
    // The factory got exactly ONE endpoint, shaped by the DETECTION fixture.
    expect(openAI.endpoints).toHaveLength(1);
    const endpoint = openAI.endpoints[0]!;
    expect(endpoint).toEqual({
      baseUrl: DETECTED.baseUrl,
      model: DETECTED.models[0],
      apiKey: undefined,
    });
    // THE PIN: deep-serialize the endpoint arg — no secret string of any kind
    // survives anywhere in it (the env's cloud VALUE, nor the profile's key).
    const serialized = JSON.stringify(endpoint);
    expect(serialized).not.toContain(CLOUD_SECRET);
    expect(serialized).not.toContain(PROFILE_KEY);
    expect(serialized).not.toContain("sk-");
    // The binder markers ride by identity, and the binder got the §5.6 deps.
    expect(deps!.buildContext).toBe(binder.ports.buildContext);
    expect(deps!.loadViolations).toBe(binder.ports.loadViolations);
    expect(deps!.persist).toBe(binder.ports.persist);
    expect(binder.received).toHaveLength(1);
    const capturedBinder = binder.received[0]! as { db: unknown; ownerId: string; tier: string };
    expect(capturedBinder.ownerId).toBe("u-owner-4d");
    expect(capturedBinder.tier).toBe("all_access");
    // The db-handle identity has its own test below (it needs the deps input).
  }, 20000);

  it("auto with a detected target — the binder's db IS the composition's handle (identity)", async () => {
    const detected = detectDouble([DETECTED]);
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const depsInput = baseDeps({
      env: { "GW_LOCAL_GENERATION": "auto" },
      ...detected,
      ...openAI,
      ...binder,
    });
    const deps = await makeLocalGenerationDeps(depsInput);
    expect(deps).not.toBeNull();
    const capturedBinder = binder.received[0]! as { db: unknown };
    expect(capturedBinder.db).toBe(depsInput.db);
  }, 20000);

  it("auto — an unset profile ⇒ NO chooseProvider; a routed profile ⇒ one rides and resolves", async () => {
    const detected = detectDouble([DETECTED]);
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const unrouted = await makeLocalGenerationDeps(
      baseDeps({ env: { "GW_LOCAL_GENERATION": "auto" }, ...detected, ...openAI, ...binder }),
    );
    expect(unrouted).not.toBeNull();
    expect("chooseProvider" in (unrouted as object)).toBe(false);

    const routed = await makeLocalGenerationDeps(
      baseDeps({
        env: { "GW_LOCAL_GENERATION": "auto" },
        profile: ROUTED_PROFILE_WITH_OPENAI_KEY,
        ...detectDouble([DETECTED]),
        ...openAI,
        ...binder,
      }),
    );
    expect(routed).not.toBeNull();
    expect(typeof (routed as LocalGenerationDeps).chooseProvider).toBe("function");
    // Light resolution touch (the routing resolution is 4c's own suite): a
    // real mode routes through the real router to the profile's slots.
    const resolved = await (routed as LocalGenerationDeps).chooseProvider!({ mode: "write" } as never);
    expect("stop" in resolved ? undefined : resolved).toEqual({
      provider: "openai-compatible",
      model: "profile-default-model",
    });
  }, 20000);

  it("generic without GW_LOCAL_ENDPOINT_URL → null + the exact missing-decision error", async () => {
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const quiet = captureConsole();
    try {
      const deps = await makeLocalGenerationDeps(
        baseDeps({
          env: {
            "GW_LOCAL_GENERATION": "generic",
            "GW_LOCAL_API_KEY": OPERATOR_PLANT,
            "GW_LOCAL_MODEL": "some-model",
          },
          ...openAI,
          ...binder,
        }),
      );
      expect(deps).toBeNull();
      expect(quiet.errors).toEqual([
        ["[local-generation] GW_LOCAL_GENERATION=generic requires GW_LOCAL_ENDPOINT_URL — generation stays OFF"],
      ]);
      expect(quiet.warnings).toEqual([]);
      expect(openAI.endpoints).toEqual([]);
      expect(binder.received).toEqual([]);
    } finally {
      quiet.restore();
    }
  }, 20000);

  it("generic composes the OpenAI-compatible adapter off the operator's env decision", async () => {
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const deps = await makeLocalGenerationDeps(
      baseDeps({
        env: {
          "GW_LOCAL_GENERATION": "generic",
          "GW_LOCAL_ENDPOINT_URL": "http://127.0.0.1:8080",
          "GW_LOCAL_MODEL": "env-model-4d",
          "GW_LOCAL_API_KEY": OPERATOR_PLANT,
        },
        ...openAI,
        ...binder,
      }),
    );
    expect(deps).not.toBeNull();
    expect(deps!.generate).toBe(openAIGenerate);
    expect(openAI.endpoints).toEqual([
      {
        baseUrl: "http://127.0.0.1:8080",
        model: "env-model-4d",
        // The operator's planted VALUE rides explicitly (§5.6).
        apiKey: OPERATOR_PLANT,
      },
    ]);
    expect(deps!.buildContext).toBe(binder.ports.buildContext);
    expect(deps!.loadViolations).toBe(binder.ports.loadViolations);
    expect(deps!.persist).toBe(binder.ports.persist);
  }, 20000);

  it("generic model resolution: GW_LOCAL_MODEL wins, then profile.models.default, then the adapter's own 'default'", async () => {
    const cases: Array<{
      readonly env: Record<string, string>;
      readonly profile: LocalGenerationCompositionDeps["profile"];
      readonly expectedModel: string;
    }> = [
      {
        env: { "GW_LOCAL_GENERATION": "generic", "GW_LOCAL_ENDPOINT_URL": "http://127.0.0.1:8080", "GW_LOCAL_MODEL": "env-model-4d" },
        profile: PROFILE_WITH_DEFAULT_MODEL,
        expectedModel: "env-model-4d",
      },
      {
        env: { "GW_LOCAL_GENERATION": "generic", "GW_LOCAL_ENDPOINT_URL": "http://127.0.0.1:8080" },
        profile: PROFILE_WITH_DEFAULT_MODEL,
        expectedModel: "profile-default-model",
      },
      {
        env: { "GW_LOCAL_GENERATION": "generic", "GW_LOCAL_ENDPOINT_URL": "http://127.0.0.1:8080" },
        profile: null,
        expectedModel: "default",
      },
    ];
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    for (const c of cases) {
      openAI.endpoints.length = 0;
      const deps = await makeLocalGenerationDeps(
        baseDeps({ env: c.env, profile: c.profile, ...openAI, ...binder }),
      );
      expect(deps).not.toBeNull();
      expect((openAI.endpoints[0]! as { model: string }).model).toBe(c.expectedModel);
    }
  }, 20000);

  it("generic — a key PRESENCE on the profile never plants the key: the VALUE rides only an explicit env", async () => {
    // The profile carries hasApiKey truth (built from a VALUE the profile
    // object itself must never carry); the composition env carries NO key.
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const deps = await makeLocalGenerationDeps(
      baseDeps({
        env: { "GW_LOCAL_GENERATION": "generic", "GW_LOCAL_ENDPOINT_URL": "http://127.0.0.1:8080" },
        profile: PROFILE_WITH_ANTHROPIC_PRESENCE,
        ...openAI,
        ...binder,
      }),
    );
    expect(deps).not.toBeNull();
    const endpoint = openAI.endpoints[0]! as { apiKey?: string };
    expect(endpoint.apiKey).toBeUndefined();
    expect(JSON.stringify(endpoint)).not.toContain(PROFILE_KEY);
  }, 20000);

  it("anthropic missing GW_LOCAL_API_KEY → null + the exact error", async () => {
    const anthropic = anthropicFactoryDouble();
    const binder = binderDouble();
    const quiet = captureConsole();
    try {
      const deps = await makeLocalGenerationDeps(
        baseDeps({ env: { "GW_LOCAL_GENERATION": "anthropic", "GW_LOCAL_MODEL": "claude-on-lan" }, ...anthropic, ...binder }),
      );
      expect(deps).toBeNull();
      expect(quiet.errors).toEqual([
        ["[local-generation] GW_LOCAL_GENERATION=anthropic requires GW_LOCAL_API_KEY and GW_LOCAL_MODEL — generation stays OFF"],
      ]);
      expect(anthropic.endpoints).toEqual([]);
      expect(binder.received).toEqual([]);
    } finally {
      quiet.restore();
    }
  }, 20000);

  it("anthropic missing a model (no GW_LOCAL_MODEL, no profile slot) → null + the exact error", async () => {
    const anthropic = anthropicFactoryDouble();
    const binder = binderDouble();
    const quiet = captureConsole();
    try {
      const deps = await makeLocalGenerationDeps(
        baseDeps({
          env: { "GW_LOCAL_GENERATION": "anthropic", "GW_LOCAL_API_KEY": OPERATOR_PLANT },
          profile: null,
          ...anthropic,
          ...binder,
        }),
      );
      expect(deps).toBeNull();
      expect(quiet.errors).toEqual([
        ["[local-generation] GW_LOCAL_GENERATION=anthropic requires GW_LOCAL_API_KEY and GW_LOCAL_MODEL — generation stays OFF"],
      ]);
      expect(anthropic.endpoints).toEqual([]);
      expect(binder.received).toEqual([]);
    } finally {
      quiet.restore();
    }
  }, 20000);

  it("anthropic with key+model composes the dedicated adapter — the key VALUE rides (the §5.6 explicit plant), model resolution as generic", async () => {
    const anthropic0 = anthropicFactoryDouble();
    const binder0 = binderDouble();
    const deps0 = await makeLocalGenerationDeps(
      baseDeps({
        env: {
          "GW_LOCAL_GENERATION": "anthropic",
          "GW_LOCAL_API_KEY": OPERATOR_PLANT,
          "GW_LOCAL_MODEL": "env-model-4d",
        },
        ...anthropic0,
        ...binder0,
      }),
    );
    expect(deps0).not.toBeNull();
    expect(deps0!.generate).toBe(anthropicGenerate);
    expect(anthropic0.endpoints).toEqual([
      { model: "env-model-4d", apiKey: OPERATOR_PLANT },
    ]);
    expect(deps0!.buildContext).toBe(binder0.ports.buildContext);
    expect(deps0!.loadViolations).toBe(binder0.ports.loadViolations);
    expect(deps0!.persist).toBe(binder0.ports.persist);

    // Model resolution: no env model → the profile's default slot.
    const anthropic1 = anthropicFactoryDouble();
    const binder1 = binderDouble();
    const deps1 = await makeLocalGenerationDeps(
      baseDeps({
        env: { "GW_LOCAL_GENERATION": "anthropic", "GW_LOCAL_API_KEY": OPERATOR_PLANT },
        profile: PROFILE_WITH_DEFAULT_MODEL,
        ...anthropic1,
        ...binder1,
      }),
    );
    expect(deps1).not.toBeNull();
    expect((anthropic1.endpoints[0]! as { model: string }).model).toBe("profile-default-model");
  }, 20000);

  it("an explicit-but-unrecognized mode refuses LOUDLY, never silently stays OFF", async () => {
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const quiet = captureConsole();
    try {
      const deps = await makeLocalGenerationDeps(
        baseDeps({ env: { "GW_LOCAL_GENERATION": "auto-composed-banana" }, ...openAI, ...binder }),
      );
      expect(deps).toBeNull();
      expect(quiet.errors).toHaveLength(1);
      expect(String(quiet.errors[0]![0])).toContain('unknown GW_LOCAL_GENERATION mode "auto-composed-banana"');
      expect(openAI.endpoints).toEqual([]);
      expect(binder.received).toEqual([]);
    } finally {
      quiet.restore();
    }
  }, 20000);

  it("the default-detect path composes honestly when nothing answers: a closed probe refuses fast → null + warn", async () => {
    // Deterministic by PORT, not by environment: the injected detect runs the
    // REAL detectLocalProviders against an UNUSED port with the documented
    // sub-second ceiling — a closed port refuses fast whatever else is running
    // on this box (a live Ollama on :11434 must not change this pin).
    const openAI = openAIFactoryDouble();
    const binder = binderDouble();
    const quiet = captureConsole();
    try {
      const deps = await makeLocalGenerationDeps(
        baseDeps({
          env: { "GW_LOCAL_GENERATION": "auto" },
          detect: (o) =>
            detectLocalProviders({
              ...o,
              probes: [{ port: 59999, label: "unused" }],
              timeoutMs: 300,
            }),
          ...openAI,
          ...binder,
        }),
      );
      expect(deps).toBeNull();
      expect(quiet.warnings).toEqual([
        ["[local-generation] no localhost provider detected — generation stays OFF"],
      ]);
      expect(openAI.endpoints).toEqual([]);
      expect(binder.received).toEqual([]);
    } finally {
      quiet.restore();
    }
  }, 20000);
});

// ---------------------------------------------------------------------------
// Source purity — the mirrored live-shell-reachability convention.
// ---------------------------------------------------------------------------

describe("local generation composition — source purity (mirrored convention)", () => {
  it("makes no @/db value import, never imports Next or Neon; the suite mocks nothing", () => {
    const source = readFileSync(join(__dirname, "../local-generation-composition.ts"), "utf-8");
    // (1) Any `@/db...` import must be a TYPE-only import — a VALUE import of
    // @/db (or @/db/schema, or @/db/sqlite) is barred. The type-only
    // `DrizzleSqliteDb` handle is the established exception.
    expect(source).not.toMatch(/import\s+\{[^}]*\}\s*from\s*"@\/db/);
    // (2) No Next runtime (route/auth) import.
    expect(source).not.toMatch(/"next(\/|-auth)?"/);
    // (3) Never the Neon driver.
    expect(source).not.toMatch(/@neondatabase\/serverless/);
    // (4) The suite itself mocks nothing — every double is injected.
    const suite = readFileSync(__filename, "utf-8");
    expect(suite).not.toMatch(/vi\.mock/);
  }, 20000);

  it(
    "opencode lane: requires BOTH the key and a model — absent either, OFF with the exact error",
    async () => {
      const openAI = openAIFactoryDouble();
      const quiet = captureConsole();
      try {
        const noKey = await makeLocalGenerationDeps(
          baseDeps({ env: { GW_LOCAL_GENERATION: "opencode" }, ...openAI, ...binderDouble() }),
        );
        const noModel = await makeLocalGenerationDeps(
          baseDeps({
            env: { GW_LOCAL_GENERATION: "opencode", GW_LOCAL_API_KEY: "oc-key" },
            ...openAI,
            ...binderDouble(),
          }),
        );
        expect(noKey).toBeNull();
        expect(noModel).toBeNull();
        expect(
          quiet.errors.filter((e) => String(e[0]).includes("GW_LOCAL_GENERATION=opencode")),
        ).toHaveLength(2);
        expect(openAI.endpoints).toEqual([]);
      } finally {
        quiet.restore();
      }
    },
    20000,
  );

  it(
    "opencode lane: composes the OpenAI-compatible adapter against the Go base with key + model",
    async () => {
      const openAI = openAIFactoryDouble();
      const deps = await makeLocalGenerationDeps(
        baseDeps({
          env: {
            GW_LOCAL_GENERATION: "opencode",
            GW_LOCAL_API_KEY: "oc-key",
            GW_LOCAL_MODEL: "deepseek-v4.1-flash",
          },
          ...openAI,
          ...binderDouble(),
        }),
      );
      expect(deps).not.toBeNull();
      expect(openAI.endpoints).toEqual([
        {
          baseUrl: "https://opencode.ai/inference/go/openai/v1",
          model: "deepseek-v4.1-flash",
          apiKey: "oc-key",
        },
      ]);
    },
    20000,
  );

  it(
    "auto prefers the detected provider that SERVES GW_LOCAL_MODEL (Ollama + llamafile coexist)",
    async () => {
      const openAI = openAIFactoryDouble();
      const deps = await makeLocalGenerationDeps(
        baseDeps({
          env: { GW_LOCAL_GENERATION: "auto", GW_LOCAL_MODEL: "qwen-coder" },
          detect: async () => [
            { baseUrl: "http://127.0.0.1:11434/v1", label: "Ollama", models: ["llama3.2:3b"] },
            { baseUrl: "http://127.0.0.1:8080/v1", label: "Local server", models: ["qwen-coder"] },
          ],
          ...openAI,
          ...binderDouble(),
        }),
      );
      expect(deps).not.toBeNull();
      expect(openAI.endpoints).toEqual([
        { baseUrl: "http://127.0.0.1:8080/v1", model: "qwen-coder" },
      ]);
    },
    20000,
  );

  it(
    "auto falls back to the documented probe order when no provider serves the chosen model",
    async () => {
      const openAI = openAIFactoryDouble();
      const deps = await makeLocalGenerationDeps(
        baseDeps({
          env: { GW_LOCAL_GENERATION: "auto", GW_LOCAL_MODEL: "not-served-anywhere" },
          detect: async () => [
            { baseUrl: "http://127.0.0.1:11434/v1", label: "Ollama", models: ["llama3.2:3b"] },
            { baseUrl: "http://127.0.0.1:8080/v1", label: "Local server", models: ["qwen-coder"] },
          ],
          ...openAI,
          ...binderDouble(),
        }),
      );
      expect(openAI.endpoints).toEqual([
        { baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2:3b" },
      ]);
    },
    20000,
  );
});
