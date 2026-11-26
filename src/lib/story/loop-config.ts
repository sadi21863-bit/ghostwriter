/**
 * Story-loop configuration — pure, no I/O.
 *
 * Extracted from `scripts/story-loop.mts` so the fail-fast contract is a unit
 * test rather than a manual check. The temp harness this replaces silently
 * defaulted the title and premise to a lighthouse story when the env was
 * missing; one repair run then imported a cast member from that default.
 * Missing required values here are errors, never defaults.
 */
import { resolve } from "node:path";

export const LOOP_FORMATS = ["Novel", "Screenplay", "Web Series"] as const;
export const LOOP_ENGINE_FORMATS = ["prose", "Screenplay", "Web Series"] as const;

export type LoopFormat = (typeof LOOP_FORMATS)[number];
export type LoopEngineFormat = (typeof LOOP_ENGINE_FORMATS)[number];

export interface LoopConfig {
  readonly title: string;
  readonly format: LoopFormat;
  readonly engineFormat: LoopEngineFormat;
  readonly premise: string;
  readonly chars: string;
  readonly structure: string;
  readonly chapters: number;
  readonly revise: boolean;
  readonly db: string;
  readonly port: number;
  readonly refresh: boolean;
  readonly echoMax: number;
  readonly echoAllow: readonly string[];
  readonly notesOnly: boolean;
}

export interface LoopConfigResult {
  readonly config: LoopConfig;
  readonly errors: string[];
}

type Env = Record<string, string | undefined>;

function envValue(env: Env, name: string): string {
  return String(env[name] ?? "").trim();
}

function readInt(
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max: number,
  errors: string[],
): number {
  const raw = envValue(env, name);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors.push(`${name} must be an integer ${min}..${max} (got "${raw}")`);
    return fallback;
  }
  return n;
}

function readFlag(env: Env, name: string, fallback: boolean, errors: string[]): boolean {
  const raw = envValue(env, name);
  if (!raw) return fallback;
  if (raw === "1") return true;
  if (raw === "0") return false;
  errors.push(`${name} must be 1 or 0 (got "${raw}")`);
  return fallback;
}

function readEnum<T extends string>(
  env: Env,
  name: string,
  allowed: readonly T[],
  fallback: T,
  errors: string[],
): T {
  const raw = envValue(env, name);
  if (!raw) return fallback;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  errors.push(`${name} must be one of ${allowed.join(", ")} (got "${raw}")`);
  return fallback;
}

/**
 * Resolve the loop's configuration from env. `outDir` is where a relative
 * `GW_LOOP_DB` filename lands (the run directory). Every problem is collected,
 * so one invocation reports all of them.
 */
export function readLoopConfig(env: Env, outDir: string): LoopConfigResult {
  const errors: string[] = [];
  const title = envValue(env, "GW_LOOP_TITLE");
  if (!title) errors.push("GW_LOOP_TITLE is required (the project / story title)");
  const premise = envValue(env, "GW_LOOP_PREMISE");
  if (!premise) errors.push("GW_LOOP_PREMISE is required (the story premise)");

  const format = readEnum(env, "GW_LOOP_FORMAT", LOOP_FORMATS, "Novel", errors);
  const derivedEngine: LoopEngineFormat = format === "Novel" ? "prose" : format;
  const engineFormat = readEnum(
    env,
    "GW_LOOP_ENGINE_FORMAT",
    LOOP_ENGINE_FORMATS,
    derivedEngine,
    errors,
  );

  const chapters = readInt(env, "GW_LOOP_CHAPTERS", 10, 1, 500, errors);
  const port = readInt(env, "GW_LOOP_PORT", 4183, 1024, 65535, errors);
  const echoMax = readInt(env, "GW_LOOP_ECHO_MAX", 12, 1, 200, errors);
  const revise = readFlag(env, "GW_LOOP_REVISE", true, errors);
  const refresh = readFlag(env, "GW_LOOP_REFRESH", false, errors);
  const notesOnly = readFlag(env, "GW_LOOP_NOTES", false, errors);

  const dbName = envValue(env, "GW_LOOP_DB") || "loop.sqlite";
  const echoAllow = (envValue(env, "GW_LOOP_ECHO_ALLOW") || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    config: {
      title,
      format,
      engineFormat,
      premise,
      chars: envValue(env, "GW_LOOP_CHARS"),
      structure: envValue(env, "GW_LOOP_STRUCTURE"),
      chapters,
      revise,
      db: resolve(outDir, dbName),
      port,
      refresh,
      echoMax,
      echoAllow,
      notesOnly,
    },
    errors,
  };
}
