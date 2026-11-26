/**
 * The versioned story loop — write a long book one unit at a time through the
 * real Ghostwriter host, checking and revising each unit:
 *
 *   1. PLAN     one outline call -> N beats (chunked, ~10 at a time)
 *   2. WRITE    one /ai/generate call per unit (prior units in context)
 *   3. REVISE   one revision call per unit (prose + continuity polish)
 *   4. DOCTOR   GET story-doctor; knowledge conflicts involving the unit
 *               trigger up to 2 targeted fix revisions
 *
 * Guards live in `src/lib/story/loop-guards.ts` (versioned and unit-tested):
 * truncated completions are rejected, and a unit that repeats >= GW_LOOP_ECHO_MAX
 * consecutive words from ANY other written unit gets one compression pass.
 *
 * Configuration FAILS FAST: GW_LOOP_TITLE and GW_LOOP_PREMISE are required.
 * The temp harness this replaces silently fell back to a default lighthouse
 * premise when the env was missing, and one repair run imported a cast member
 * from that default. There are no story defaults here.
 *
 * Resumable: units that already have text are skipped, so a book can be built
 * across many sessions (state lives in the host db).
 *
 *   npx tsx scripts/story-loop.mts --check   validate config, print resolved JSON
 *   npx tsx scripts/story-loop.mts           run the loop
 *
 * Env: GW_LOOP_TITLE (required), GW_LOOP_PREMISE (required), GW_LOOP_CHARS,
 *      GW_LOOP_FORMAT (Novel | Screenplay | Web Series, default Novel),
 *      GW_LOOP_ENGINE_FORMAT (prose | Screenplay | Web Series, derived),
 *      GW_LOOP_STRUCTURE, GW_LOOP_CHAPTERS (10), GW_LOOP_REVISE (1),
 *      GW_LOOP_DB (loop.sqlite), GW_LOOP_PORT (4183), GW_LOOP_REFRESH (0),
 *      GW_LOOP_ECHO_MAX (12), GW_LOOP_ECHO_ALLOW ("phrase|phrase").
 */
import { spawn, exec } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { openSync, closeSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanBeat,
  looksTruncated,
  scrubArtifacts,
  splitUnitTitle,
  words,
  worstRepeat,
} from "@/lib/story/loop-guards";
import { readLoopConfig, type LoopEngineFormat } from "@/lib/story/loop-config";

const USAGE = `story-loop — write a book one unit at a time through the local host

Usage:
  npx tsx scripts/story-loop.mts            run (resumes written units)
  npx tsx scripts/story-loop.mts --check    validate env and print config
  npx tsx scripts/story-loop.mts --help     this text

Required:
  GW_LOOP_TITLE      project / story title (no default)
  GW_LOOP_PREMISE    story premise (no default)

Optional:
  GW_LOOP_CHARS      cast contract; warning when empty
  GW_LOOP_FORMAT     Novel | Screenplay | Web Series   (default Novel)
  GW_LOOP_ENGINE_FORMAT  prose | Screenplay | Web Series (derived from FORMAT)
  GW_LOOP_STRUCTURE  structure / style constraints
  GW_LOOP_CHAPTERS   number of units                    (default 10)
  GW_LOOP_REVISE     1 | 0                              (default 1)
  GW_LOOP_DB         db filename under %TEMP%\\gw-loop   (default loop.sqlite)
  GW_LOOP_PORT       host port                          (default 4183)
  GW_LOOP_REFRESH    1 | 0, wipe the db first           (default 0)
  GW_LOOP_ECHO_MAX   repetition threshold in words      (default 12)
  GW_LOOP_ECHO_ALLOW deliberate refrains, "phrase|phrase"
`;

const OUT = resolve(process.env["TEMP"] ?? ".", "gw-loop");

const UNIT_FOR = (engine: LoopEngineFormat): string =>
  engine === "Screenplay" ? "scene" : engine === "Web Series" ? "episode" : "chapter";

const UNIT_PLURAL_FOR = (engine: LoopEngineFormat): string =>
  engine === "Screenplay" ? "scenes" : engine === "Web Series" ? "episodes" : "chapters";

/** Format contract the engine cannot infer from the one-word format name. */
function formatContract(engine: LoopEngineFormat): string {
  if (engine === "Screenplay") {
    return [
      "FORMAT CONTRACT - SCREENPLAY. Every unit is ONE SCENE of a film script, not prose.",
      "- Open with a slug line on its own line, ALL CAPS, in the form: INT. GREENHOUSE - NIGHT or EXT. PLATFORM - DAY. Use INT. or EXT., a real location, then DAY or NIGHT. No scene numbers.",
      "- After the slug line: action paragraphs, present tense, visual and audible only - what the camera sees and what we hear. No interior thoughts, no narration, no 'we see'.",
      "- Dialogue is character-cued: the speaking character's name in ALL CAPS on its own line, then the spoken line below it. A parenthetical only when delivery changes the meaning.",
      "- No chapter labels, no 'SCENE 1:', no headings other than the slug line.",
    ].join("\n");
  }
  if (engine === "Web Series") {
    return [
      "FORMAT CONTRACT - WEB SERIES. Every unit is ONE EPISODE of a serialized show.",
      "- Open with a COLD OPEN: a short, grabby scene that starts in motion and poses the episode's hook. Put the label 'COLD OPEN' on its own line before it.",
      "- Then 2-3 act beats, each labelled on its own line: 'ACT ONE', 'ACT TWO', 'ACT THREE' (at least two acts; use as many as the episode needs).",
      "- End on a CLIFFHANGER: a hard cut on a question, threat, or reversal that makes the next episode necessary.",
      "- Visual, scene-based prose with dialogue is allowed (an episode treatment, not a novel): present tense, concrete locations, dialogue that plays. No chapter labels, no episode numbers inside the text.",
    ].join("\n");
  }
  return "";
}

function planContract(engine: LoopEngineFormat): string {
  const unit = UNIT_FOR(engine);
  if (engine === "Screenplay" || engine === "Web Series") {
    return `Each plan line: a short human ${unit} title (never a slug line, never '${unit.toUpperCase()} 1:'), then one sentence of what the ${unit} must accomplish.`;
  }
  return "";
}

function writeSpec(engine: LoopEngineFormat): string {
  if (engine === "Screenplay") {
    return "~800-1000 words of screenplay only: slug line, action paragraphs, character-cued dialogue. No commentary, no headings other than the slug line.";
  }
  if (engine === "Web Series") {
    return "~900-1100 words of the episode only: cold open, 2-3 act beats, cliffhanger. No commentary, no preamble.";
  }
  return "~900 words of prose only. No headings, no commentary.";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let hostPid: number | undefined;
function killHost(): void {
  if (hostPid) {
    try {
      exec(`taskkill /PID ${hostPid} /T /F`, () => undefined);
    } catch {
      /* gone */
    }
    hostPid = undefined;
  }
}

function readEnvValue(file: string, name: string): string | null {
  try {
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((l) => l.trimStart().startsWith(`${name}=`));
    if (!line) return null;
    const v = line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    return v || null;
  } catch {
    return null;
  }
}

interface Graph {
  project?: {
    chapters?: {
      id: string;
      title: string;
      content?: string | null;
      sortOrder?: number | null;
    }[];
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }

  const { config, errors } = readLoopConfig(process.env, OUT);
  const checkOnly = argv.includes("--check") || process.env["GW_LOOP_CHECK"] === "1";

  if (checkOnly) {
    if (errors.length) {
      console.error("[loop] invalid configuration:");
      for (const e of errors) console.error(`  - ${e}`);
      process.exitCode = 2;
      return;
    }
    console.log(
      JSON.stringify(
        {
          title: config.title,
          format: config.format,
          engineFormat: config.engineFormat,
          units: config.chapters,
          db: config.db,
          port: config.port,
          revise: config.revise,
          refresh: config.refresh,
          echoMax: config.echoMax,
          echoAllow: config.echoAllow.length,
          chars: config.chars.length > 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (errors.length) {
    console.error("[loop] invalid configuration:");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("[loop] nothing was started; set the missing values or pass --check to validate.");
    process.exit(2);
  }
  if (!config.chars) {
    console.error("[loop] WARNING: GW_LOOP_CHARS is empty - no cast contract was supplied");
  }

  const {
    title: TITLE,
    format: FORMAT,
    engineFormat: ENGINE_FORMAT,
    premise: PREMISE,
    chars: CHARS,
    structure: STRUCTURE,
    chapters: CHAPTERS,
    revise: REVISE,
    db: DB,
    port: PORT,
    refresh: REFRESH,
    echoMax: ECHO_MAX,
    echoAllow: ECHO_ALLOW,
  } = config;

  const UNIT = UNIT_FOR(ENGINE_FORMAT);
  const UNIT_PLURAL = UNIT_PLURAL_FOR(ENGINE_FORMAT);
  const FORMAT_EXTRA = formatContract(ENGINE_FORMAT);
  const PLAN_EXTRA = planContract(ENGINE_FORMAT);
  const WRITE_SPEC = writeSpec(ENGINE_FORMAT);

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  if (REFRESH) {
    for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
      try {
        rmSync(f, { force: true });
      } catch {
        /* */
      }
    }
  }

  const REPO = resolve(process.cwd());
  const key = readEnvValue(resolve(REPO, ".env.local"), "GW_LOCAL_API_KEY");
  if (!key) {
    console.error("[loop] no GW_LOCAL_API_KEY in .env.local");
    process.exit(1);
  }

  const undici = createRequire(resolve(REPO, "package.json"))("undici") as typeof import("undici");
  const slowAgent = new undici.Agent({ headersTimeout: 1_800_000, bodyTimeout: 1_800_000 });

  const SLUG = TITLE.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const errLog = resolve(OUT, `host-${SLUG}-${PORT}.err`);
  const outLog = resolve(OUT, `host-${SLUG}-${PORT}.out`);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GW_LOCAL_DB: DB,
    GW_LOCAL_HOST_PORT: String(PORT),
    GW_LOCAL_GENERATION: "opencode",
    GW_LOCAL_API_KEY: key,
    GW_LOCAL_MODEL: "deepseek-v4.1-flash",
    GW_LOCAL_TIMEOUT_MS: "900000",
  };
  const outFd = openSync(outLog, "w");
  const errFd = openSync(errLog, "w");
  const child = spawn("cmd.exe", ["/c", "npx tsx scripts/spawn-local-host.mts"], {
    cwd: REPO,
    env,
    stdio: ["ignore", outFd, errFd],
  });
  hostPid = child.pid;
  closeSync(outFd);
  closeSync(errFd);

  let token = "";
  for (let waited = 0; waited < 600_000; waited += 500) {
    await sleep(500);
    if (existsSync(errLog)) {
      const m = readFileSync(errLog, "utf8").match(/owner token \(per launch\) : (\S+)/);
      if (m) {
        token = m[1]!;
        break;
      }
    }
  }
  if (!token) {
    console.error("[loop] host boot timeout");
    process.exit(1);
  }
  console.error("[loop] host up");

  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const api = async (path: string, method: string, body?: unknown) => {
    const res = await undici.fetch(`http://127.0.0.1:${PORT}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(900_000),
      dispatcher: slowAgent,
    } as unknown as import("undici").RequestInit);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* */
    }
    if (!res.ok || data["ok"] === false) {
      throw new Error(`${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return data;
  };

  // -- resume or create the project ------------------------------------------
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await api("/projects", "GET");
      break;
    } catch (e) {
      if (attempt === 20) {
        console.error("[loop] host never became ready; stderr tail:");
        console.error(readFileSync(errLog, "utf8").slice(-1200));
        throw e;
      }
      await sleep(1000);
    }
  }

  const list = (await api("/projects", "GET")) as {
    projects?: { id: string; name: string }[];
  };
  let projectId = (list.projects ?? []).find((p) => p.name === TITLE)?.id;
  let graph: Graph | null = null;

  if (!projectId) {
    const created = (await api("/projects", "POST", {
      name: TITLE,
      format: FORMAT,
      storyType: "linear",
    })) as { project?: { id?: string } };
    projectId = created.project?.id;
    if (!projectId) throw new Error("project create returned no id");
    const g = (await api(`/projects/${encodeURIComponent(projectId)}`, "GET")) as Graph;
    const firstId = g?.project?.chapters?.[0]?.id;
    if (!firstId) throw new Error("seeded chapter missing");
    const db = new DatabaseSync(DB);
    db.exec("PRAGMA busy_timeout = 5000");
    const ins = db.prepare(
      "INSERT INTO chapters (id, project_id, title, content, sort_order, word_count, created_at, updated_at) VALUES (?, ?, ?, '', ?, 0, ?, ?)",
    );
    const now = Date.now();
    for (let i = 1; i < CHAPTERS; i++) {
      ins.run(
        `loop-${projectId}-ch${i + 1}`,
        projectId,
        ENGINE_FORMAT === "prose"
          ? `Chapter ${i + 1}`
          : `${UNIT === "scene" ? "Scene" : "Episode"} ${i + 1}`,
        i,
        now,
        now,
      );
    }
    db.close();
  }

  graph = (await api(`/projects/${encodeURIComponent(projectId)}`, "GET")) as Graph;
  const rows = (graph?.project?.chapters ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (rows.length < CHAPTERS) {
    throw new Error(
      `project has ${rows.length} chapters, need ${CHAPTERS}; use GW_LOOP_REFRESH=1 with a fresh db`,
    );
  }

  // -- PLAN (only when no outline note exists) --------------------------------
  const outlinePath = resolve(OUT, `${SLUG}.outline.md`);
  let beats: string[] = [];
  if (existsSync(outlinePath)) {
    beats = readFileSync(outlinePath, "utf8").split(/\r?\n/).map(cleanBeat).filter(Boolean);
    console.error(`[loop] plan loaded (${beats.length} beats)`);
  }
  while (beats.length < CHAPTERS) {
    const from = beats.length + 1;
    const want = Math.min(10, CHAPTERS - beats.length);
    const planned = (await api("/ai/generate", "POST", {
      projectId,
      mode: "outline",
      format: ENGINE_FORMAT,
      prompt: [
        `Plan ${UNIT_PLURAL} ${from} through ${from + want - 1} of a ${CHAPTERS}-${UNIT} ${FORMAT.toLowerCase()} titled "${TITLE}".`,
        `Premise: ${PREMISE}`,
        `Characters: ${CHARS}`,
        STRUCTURE ? `Structure & style constraints: ${STRUCTURE}` : "",
        FORMAT_EXTRA,
        beats.length
          ? `Earlier ${UNIT_PLURAL}:\n${beats.map((b, j) => `${j + 1}. ${b}`).join("\n")}`
          : "",
        PLAN_EXTRA,
        `Return exactly ${want} numbered lines in the form: "${from}. ${UNIT === "chapter" ? "Chapter" : UNIT === "scene" ? "Scene" : "Episode"} title \u2014 one-sentence beat of what changes."`,
        `No preface, no commentary, no extra lines.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    })) as { text?: unknown };
    const got = String(planned.text ?? "")
      .split(/\r?\n/)
      .map(cleanBeat)
      .filter(Boolean)
      .slice(0, want);
    if (!got.length) {
      console.error("[loop] planning returned nothing; stopping plan growth");
      break;
    }
    beats.push(...got);
    writeFileSync(outlinePath, beats.map((b, i) => `${i + 1}. ${b}`).join("\n"), "utf8");
    console.error(`[loop] planned through ${UNIT} ${beats.length}`);
  }
  if (beats.length < CHAPTERS) {
    console.error(
      `[loop] WARNING: plan has ${beats.length} beats for ${CHAPTERS} ${UNIT_PLURAL}; ` +
        `missing units get a generic beat`,
    );
  }

  const summaryPath = resolve(OUT, `${SLUG}.log.md`);
  const log = (line: string) => {
    writeFileSync(
      summaryPath,
      existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") + line + "\n" : line + "\n",
      "utf8",
    );
  };
  log(`# ${TITLE} \u2014 ${FORMAT}\n\nPremise: ${PREMISE}\n`);

  const priorLine = (i: number): string => {
    const c = rows[i]?.content ?? "";
    const first = c.split(/(?<=[.!?])\s+/)[0] ?? "";
    return first.slice(0, 220);
  };

  for (let i = 0; i < CHAPTERS; i++) {
    const row = rows[i]!;
    const beat = beats[i] ?? `Advance the story: ${UNIT} ${i + 1}.`;
    let content = String(row.content ?? "").trim();
    if (content) {
      console.error(`[loop] ${UNIT} ${i + 1}: exists, skipping`);
      continue;
    }

    const history = Array.from(
      { length: i },
      (_, j) => `- ${UNIT} ${j + 1}: ${priorLine(j)}`,
    ).join("\n");
    const prompt = [
      `You are writing "${TITLE}", a ${FORMAT}.`,
      `Premise: ${PREMISE}`,
      `Characters: ${CHARS}`,
      STRUCTURE ? `Structure & style constraints: ${STRUCTURE}` : "",
      FORMAT_EXTRA,
      `${UNIT === "chapter" ? "Chapter" : UNIT === "scene" ? "Scene" : "Episode"} plan (for orientation only):\n${beats.map((b, j) => `${j + 1}. ${b}`).join("\n")}`,
      i > 0
        ? `${UNIT === "chapter" ? "Chapters" : UNIT === "scene" ? "Scenes" : "Episodes"} already written (stay consistent):\n${history}`
        : "",
      `CRAFT RULES: vary sentence openings \u2014 never start more than two consecutive sentences with "The", "She", or "He"; do not reuse a signature gesture, phrase, or ${UNIT}-ending image from earlier ${UNIT_PLURAL}; at least a quarter of the ${UNIT} should be dialogue; end on a TURN (new information or a decision), never on a static lyrical image; no ${UNIT} labels, no "BEAT:" prefixes, no "--- ${UNIT.toUpperCase()} N ---" separators inside the text.`,
      i === CHAPTERS - 1
        ? `FINAL ${UNIT.toUpperCase()}: pay off the promises the story has earned. A deliberately open thread is allowed \u2014 at most one major one \u2014 and the openness must be a visible choice on the page, not an accident. Do not force a resolution the story has not built toward.`
        : "",
      `Write ${UNIT} ${i + 1}, "${beat.replace(/^.*?\u2014\s*/, "")}". ${WRITE_SPEC}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const t0 = Date.now();
    let out: { text?: unknown } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        out = (await api("/ai/generate", "POST", {
          projectId,
          chapterId: row.id,
          mode: "write",
          format: ENGINE_FORMAT,
          prompt,
          dynamicContext: i > 0 ? String(rows[i - 1]?.content ?? "").slice(-1500) : "",
        })) as { text?: unknown };
      } catch (e) {
        out = null;
        console.error(
          `[loop] ${UNIT} ${i + 1}: transient failure (attempt ${attempt + 1}): ` +
            (e instanceof Error ? e.message.slice(0, 140) : String(e)),
        );
      }
      const candidate = scrubArtifacts(String(out?.text ?? ""));
      if (candidate && !looksTruncated(candidate)) {
        content = candidate;
        break;
      }
      if (candidate) {
        console.error(
          `[loop] ${UNIT} ${i + 1}: completion cut off mid-sentence (attempt ${attempt + 1}); retrying`,
        );
      }
      await sleep(3000 + attempt * 2000);
    }
    if (!content) throw new Error(`${UNIT} ${i + 1}: no complete generation after retries`);

    if (REVISE) {
      const rev = (await api("/ai/generate", "POST", {
        projectId,
        chapterId: row.id,
        mode: "write",
        format: ENGINE_FORMAT,
        prompt: [
          `Revise the following ${UNIT} of "${TITLE}" for quality, rhythm, and continuity with the plan.`,
          FORMAT_EXTRA,
          `Keep every plot event and name; do not add or remove scenes; return ONLY the full revised ${UNIT}, no commentary.`,
          `${UNIT === "chapter" ? "Chapter" : UNIT === "scene" ? "Scene" : "Episode"} plan: ${beat}`,
          `--- ${UNIT.toUpperCase()} ${i + 1} ---`,
          content,
        ]
          .filter(Boolean)
          .join("\n"),
        dynamicContext: "",
      })) as { text?: unknown };
      const revised = scrubArtifacts(String(rev.text ?? ""));
      if (revised.length > content.length * 0.5 && !looksTruncated(revised)) {
        content = revised;
      } else if (revised.length > content.length * 0.5) {
        console.error(
          `[loop] ${UNIT} ${i + 1}: revision cut off mid-sentence; keeping the complete draft`,
        );
      }
    }

    // REPETITION GUARD: compare with every other written unit (not just the
    // ones before it), so a resumed run also catches an echo of a later unit.
    const repeat = worstRepeat(content, rows, i, { allow: ECHO_ALLOW });
    if (repeat.run >= ECHO_MAX) {
      console.error(
        `[loop] ${UNIT} ${i + 1}: repeats ${UNIT} ${repeat.index + 1} for ${repeat.run} consecutive words; compressing`,
      );
      try {
        const fix = (await api("/ai/generate", "POST", {
          projectId,
          chapterId: row.id,
          mode: "write",
          format: ENGINE_FORMAT,
          prompt: [
            `This ${UNIT} repeats a passage from an earlier ${UNIT} almost verbatim (${repeat.run} consecutive words).`,
            `Rewrite so the repeated passage is compressed to at most one sentence that references the earlier event; keep every plot event and the ${UNIT} ending.`,
            FORMAT_EXTRA,
            `Return ONLY the full rewritten ${UNIT}, no commentary.`,
            `--- ${UNIT.toUpperCase()} ${i + 1} ---`,
            content,
          ]
            .filter(Boolean)
            .join("\n"),
          dynamicContext: "",
        })) as { text?: unknown };
        const fixed = scrubArtifacts(String(fix.text ?? ""));
        const after = fixed
          ? worstRepeat(fixed, rows, i, { allow: ECHO_ALLOW })
          : { run: Number.MAX_SAFE_INTEGER, index: -1 };
        if (
          fixed.length > content.length * 0.5 &&
          !looksTruncated(fixed) &&
          after.run < ECHO_MAX
        ) {
          content = fixed;
          console.error(
            `[loop] ${UNIT} ${i + 1}: repetition ${repeat.run} -> ${after.run} words; kept the rewrite`,
          );
          log(
            `- ${UNIT} ${i + 1}: repetition guard ${repeat.run} -> ${after.run} words (vs ${UNIT} ${repeat.index + 1})`,
          );
        } else {
          console.error(
            `[loop] ${UNIT} ${i + 1}: repetition fix rejected (run ${after.run}, ${words(fixed)} words); keeping the draft`,
          );
        }
      } catch (e) {
        console.error(
          `[loop] ${UNIT} ${i + 1}: repetition fix failed: ` +
            (e instanceof Error ? e.message.slice(0, 140) : String(e)),
        );
      }
    }

    await api(
      `/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(row.id)}`,
      "PATCH",
      {
        patch: {
          title: splitUnitTitle(beat, `${UNIT} ${i + 1}`),
          content,
        },
      },
    );
    row.content = content;

    await api(`/projects/${encodeURIComponent(projectId)}/story-memories`, "POST", {
      fact: beat,
      chapterIndex: i,
      structuredData: { keyEvents: [beat] },
    });

    // DOCTOR: act on knowledge conflicts that involve this unit.
    for (let attempt = 0; attempt < 2; attempt++) {
      const doctor = (await api(
        `/projects/${encodeURIComponent(projectId)}/story-doctor`,
        "GET",
      )) as {
        issues?: {
          kind?: string;
          message?: string;
          chapterIndex?: number;
          learnedAtChapter?: number;
        }[];
      };
      const mine = (doctor.issues ?? []).filter(
        (x) =>
          x.kind === "knowledge-conflict" &&
          (x.chapterIndex === i || x.learnedAtChapter === i + 1),
      );
      if (!mine.length) break;
      const note = mine.map((x) => `- ${x.message}`).join("\n");
      const fix = (await api("/ai/generate", "POST", {
        projectId,
        chapterId: row.id,
        mode: "write",
        format: ENGINE_FORMAT,
        prompt: [
          `The continuity checker flagged contradictions involving this ${UNIT} of "${TITLE}":`,
          note,
          FORMAT_EXTRA,
          `Rewrite ONLY this ${UNIT} to remove the contradictions while keeping every event, name, and the ${UNIT}'s outcome. Return ONLY the full rewritten ${UNIT}.`,
          `--- ${UNIT.toUpperCase()} ${i + 1} ---`,
          content,
        ]
          .filter(Boolean)
          .join("\n"),
        dynamicContext: "",
      })) as { text?: unknown };
      const fixed = scrubArtifacts(String(fix.text ?? ""));
      if (fixed.length > content.length * 0.5 && !looksTruncated(fixed)) {
        content = fixed;
        await api(
          `/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(row.id)}`,
          "PATCH",
          { patch: { content } },
        );
        row.content = content;
      } else break;
    }

    const secs = Math.round((Date.now() - t0) / 1000);
    const w = words(content);
    log(`- ${UNIT} ${i + 1}: ${beat} (${w} words, ${secs}s)`);
    console.error(`[loop] ${UNIT} ${i + 1}/${CHAPTERS} done: ${w} words in ${secs}s`);
  }

  const finalGraph = (await api(
    `/projects/${encodeURIComponent(projectId)}`,
    "GET",
  )) as Graph;
  const chapters = (finalGraph?.project?.chapters ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const book = chapters
    .map((c, i) => `## ${i + 1}. ${c.title}\n\n${String(c.content ?? "").trim()}\n`)
    .join("\n");
  const total = words(book);
  writeFileSync(
    resolve(OUT, `${SLUG}.md`),
    `# ${TITLE}\n\n_${FORMAT} \u00b7 ${total} words_\n\n${book}\n`,
    "utf8",
  );
  const doctor = await api(
    `/projects/${encodeURIComponent(projectId)}/story-doctor`,
    "GET",
  );
  writeFileSync(resolve(OUT, `${SLUG}.doctor.json`), JSON.stringify(doctor, null, 2), "utf8");
  console.error(
    `[loop] DONE: ${total} words across ${chapters.filter((c) => String(c.content ?? "").trim()).length} ${UNIT_PLURAL}`,
  );
}

main()
  .catch((e) => {
    console.error("[loop] FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => killHost());
