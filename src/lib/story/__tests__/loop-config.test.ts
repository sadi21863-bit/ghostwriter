import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { readLoopConfig } from "@/lib/story/loop-config";

/**
 * The loop's configuration contract. The bug that motivated extracting this
 * module: the temp harness silently defaulted the title and premise to a
 * lighthouse story, so a run with missing env generated the wrong book. These
 * tests pin that missing required values are ERRORS, not defaults.
 */

const OUT = resolve("C:/tmp/gw-loop");

function cfg(env: Record<string, string | undefined>) {
  return readLoopConfig(env, OUT);
}

describe("required values", () => {
  it("reports both missing title and premise instead of defaulting them", () => {
    const { config, errors } = cfg({});
    expect(errors).toEqual([
      "GW_LOOP_TITLE is required (the project / story title)",
      "GW_LOOP_PREMISE is required (the story premise)",
    ]);
    expect(config.title).toBe("");
    expect(config.premise).toBe("");
  });

  it("treats whitespace-only values as missing", () => {
    const { errors } = cfg({ GW_LOOP_TITLE: "   ", GW_LOOP_PREMISE: "\n\t" });
    expect(errors).toHaveLength(2);
  });

  it("is clean when both required values are present", () => {
    expect(
      cfg({ GW_LOOP_TITLE: "The Quiet Room", GW_LOOP_PREMISE: "A booth records last words." })
        .errors,
    ).toEqual([]);
  });
});

describe("format", () => {
  it("derives the engine format from the story format", () => {
    expect(cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P", GW_LOOP_FORMAT: "Novel" }).config.engineFormat).toBe("prose");
    expect(cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P", GW_LOOP_FORMAT: "Screenplay" }).config.engineFormat).toBe("Screenplay");
    expect(cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P", GW_LOOP_FORMAT: "Web Series" }).config.engineFormat).toBe("Web Series");
  });

  it("accepts an explicit engine format override", () => {
    const { config, errors } = cfg({
      GW_LOOP_TITLE: "T",
      GW_LOOP_PREMISE: "P",
      GW_LOOP_FORMAT: "Novel",
      GW_LOOP_ENGINE_FORMAT: "Web Series",
    });
    expect(errors).toEqual([]);
    expect(config.engineFormat).toBe("Web Series");
  });

  it("rejects a removed creator format", () => {
    const { errors } = cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P", GW_LOOP_FORMAT: "Podcast" });
    expect(errors).toEqual([
      'GW_LOOP_FORMAT must be one of Novel, Screenplay, Web Series (got "Podcast")',
    ]);
  });
});

describe("numeric and flag values", () => {
  it("applies the documented defaults", () => {
    const { config } = cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P" });
    expect(config.chapters).toBe(10);
    expect(config.port).toBe(4183);
    expect(config.echoMax).toBe(12);
    expect(config.revise).toBe(true);
    expect(config.refresh).toBe(false);
    expect(config.notesOnly).toBe(false);
    expect(config.chars).toBe("");
    expect(config.structure).toBe("");
  });

  it("reports every invalid value in one pass", () => {
    const { errors } = cfg({
      GW_LOOP_TITLE: "T",
      GW_LOOP_PREMISE: "P",
      GW_LOOP_CHAPTERS: "0",
      GW_LOOP_PORT: "80",
      GW_LOOP_ECHO_MAX: "999",
      GW_LOOP_REVISE: "yes",
      GW_LOOP_REFRESH: "maybe",
      GW_LOOP_NOTES: "yes",
    });
    expect(errors).toHaveLength(6);
    expect(errors[0]).toContain("GW_LOOP_CHAPTERS must be an integer 1..500");
    expect(errors[1]).toContain("GW_LOOP_PORT must be an integer 1024..65535");
    expect(errors[2]).toContain("GW_LOOP_ECHO_MAX must be an integer 1..200");
    expect(errors[3]).toContain("GW_LOOP_REVISE must be 1 or 0");
    expect(errors[4]).toContain("GW_LOOP_REFRESH must be 1 or 0");
    expect(errors[5]).toContain("GW_LOOP_NOTES must be 1 or 0");
  });

  it("accepts the 0/1 flag form", () => {
    const { config, errors } = cfg({
      GW_LOOP_TITLE: "T",
      GW_LOOP_PREMISE: "P",
      GW_LOOP_REVISE: "0",
      GW_LOOP_REFRESH: "1",
      GW_LOOP_NOTES: "1",
    });
    expect(errors).toEqual([]);
    expect(config.revise).toBe(false);
    expect(config.refresh).toBe(true);
    expect(config.notesOnly).toBe(true);
  });
});

describe("db and refrains", () => {
  it("resolves a relative db under the run directory", () => {
    const { config } = cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P", GW_LOOP_DB: "book.sqlite" });
    expect(config.db).toBe(resolve(OUT, "book.sqlite"));
  });

  it("keeps an absolute db path", () => {
    const absolute = resolve("C:/data/book.sqlite");
    const { config } = cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P", GW_LOOP_DB: absolute });
    expect(config.db).toBe(absolute);
  });

  it("splits, trims and drops empty refrain phrases", () => {
    const { config } = cfg({
      GW_LOOP_TITLE: "T",
      GW_LOOP_PREMISE: "P",
      GW_LOOP_ECHO_ALLOW: " the light remembers | | every ship ",
    });
    expect(config.echoAllow).toEqual(["the light remembers", "every ship"]);
  });

  it("keeps the cast contract when supplied", () => {
    const { config } = cfg({ GW_LOOP_TITLE: "T", GW_LOOP_PREMISE: "P", GW_LOOP_CHARS: "Nia, Emil" });
    expect(config.chars).toBe("Nia, Emil");
  });
});
