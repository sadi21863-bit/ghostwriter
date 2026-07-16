import { describe, it, expect, vi, beforeEach } from "vitest";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: any[]) => spawnMock(...args),
}));

const writeFileMock = vi.fn();
const unlinkMock = vi.fn();
const readFileMock = vi.fn();
const mkdtempMock = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: any[]) => writeFileMock(...args),
  unlink: (...args: any[]) => unlinkMock(...args),
  readFile: (...args: any[]) => readFileMock(...args),
  mkdtemp: (...args: any[]) => mkdtempMock(...args),
}));

vi.mock("ffmpeg-static", () => ({ default: "/path/to/ffmpeg" }));

import { EventEmitter } from "node:events";
import { concatAudioBuffers } from "../concat-audio";

function makeFakeProcess(exitCode: number, stderr = "") {
  const proc: any = new EventEmitter();
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    if (stderr) proc.stderr.emit("data", Buffer.from(stderr));
    proc.emit("close", exitCode);
  }, 0);
  return proc;
}

describe("concatAudioBuffers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    mkdtempMock.mockResolvedValue("/tmp/gw-audio-concat-xyz");
    readFileMock.mockResolvedValue(Buffer.from("final-audio"));
  });

  it("throws immediately when given an empty array, without touching the filesystem or ffmpeg", async () => {
    await expect(concatAudioBuffers([])).rejects.toThrow(/at least one buffer/);
    expect(mkdtempMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("re-encodes via the concat demuxer (not raw byte concatenation) and applies loudnorm by default", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(0));

    const result = await concatAudioBuffers([Buffer.from("a"), Buffer.from("b")]);

    expect(result).toEqual(Buffer.from("final-audio"));
    // 2 segment writes + 1 list-file write (no silence requested)
    expect(writeFileMock).toHaveBeenCalledTimes(3);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [bin, args] = spawnMock.mock.calls[0];
    expect(bin).toBe("/path/to/ffmpeg");
    expect(args).toEqual(expect.arrayContaining(["-f", "concat", "-safe", "0", "-c:a", "libmp3lame"]));
    expect(args).toContain("-af");
    expect(args[args.indexOf("-af") + 1]).toContain("loudnorm");
  });

  it("skips loudnorm when normalize is false", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(0));

    await concatAudioBuffers([Buffer.from("a")], { normalize: false });

    const [, args] = spawnMock.mock.calls[0];
    expect(args).not.toContain("-af");
  });

  it("generates a shared silence clip and interleaves it between (not before/after) segments when pauseMs is set", async () => {
    // 1st spawn: silence generation. 2nd spawn: the actual concat.
    spawnMock
      .mockReturnValueOnce(makeFakeProcess(0))
      .mockReturnValueOnce(makeFakeProcess(0));

    await concatAudioBuffers([Buffer.from("a"), Buffer.from("b"), Buffer.from("c")], { pauseMs: 400 });

    expect(spawnMock).toHaveBeenCalledTimes(2);
    const [, silenceArgs] = spawnMock.mock.calls[0];
    expect(silenceArgs).toEqual(expect.arrayContaining(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.4"]));

    // list file is the 4th writeFile call (3 segments + list) — find it by content shape
    const listCall = writeFileMock.mock.calls.find(([, content]) => typeof content === "string" && content.includes("list") === false && content.includes("file '"));
    expect(listCall).toBeTruthy();
    const [, listContent] = listCall!;
    const lines = (listContent as string).split("\n");
    // 3 segments + 2 silences interleaved = 5 lines, silence never first or last
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("segment-0.mp3");
    expect(lines[1]).toContain("silence.mp3");
    expect(lines[2]).toContain("segment-1.mp3");
    expect(lines[3]).toContain("silence.mp3");
    expect(lines[4]).toContain("segment-2.mp3");
  });

  it("does not generate a silence clip for a single-segment input even if pauseMs is set", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(0));

    await concatAudioBuffers([Buffer.from("a")], { pauseMs: 400 });

    expect(spawnMock).toHaveBeenCalledTimes(1); // only the final concat call, no silence-generation call
  });

  it("cleans up all temp files (segments, list, output) on success", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(0));

    await concatAudioBuffers([Buffer.from("a"), Buffer.from("b")]);

    // 2 segments + list + output = 4 temp files
    expect(unlinkMock).toHaveBeenCalledTimes(4);
  });

  it("still cleans up temp files when ffmpeg fails, and rejects with stderr", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(1, "Invalid data found"));

    await expect(concatAudioBuffers([Buffer.from("a")])).rejects.toThrow(/Invalid data found/);
    expect(unlinkMock).toHaveBeenCalled();
  });
});
