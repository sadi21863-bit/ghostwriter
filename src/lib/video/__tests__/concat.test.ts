import { describe, it, expect, vi, beforeEach } from "vitest";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: any[]) => spawnMock(...args),
}));

const writeFileMock = vi.fn();
const unlinkMock = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: any[]) => writeFileMock(...args),
  unlink: (...args: any[]) => unlinkMock(...args),
}));

vi.mock("ffmpeg-static", () => ({ default: "/path/to/ffmpeg" }));

import { EventEmitter } from "node:events";
import { concatVideos, probeDuration, concatVideosWithCrossfade } from "../concat";

function makeFakeProcess(exitCode: number, stderr = "") {
  const proc: any = new EventEmitter();
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    if (stderr) proc.stderr.emit("data", Buffer.from(stderr));
    proc.emit("close", exitCode);
  }, 0);
  return proc;
}

describe("concatVideos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
  });

  it("spawns ffmpeg with a concat-demuxer list and -c copy, in input order", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(0));

    await concatVideos(["/tmp/a.mp4", "/tmp/b.mp4", "/tmp/c.mp4"], "/tmp/out.mp4");

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [bin, args] = spawnMock.mock.calls[0];
    expect(bin).toBe("/path/to/ffmpeg");
    expect(args).toEqual(expect.arrayContaining(["-f", "concat", "-safe", "0", "-c", "copy", "/tmp/out.mp4"]));
    // the concat list file path is whatever was passed to -i
    const iIndex = args.indexOf("-i");
    expect(typeof args[iIndex + 1]).toBe("string");

    // the list file content (written before spawning) must reference all 3 inputs in order
    const [, listContent] = writeFileMock.mock.calls[0];
    expect(listContent).toBe("file '/tmp/a.mp4'\nfile '/tmp/b.mp4'\nfile '/tmp/c.mp4'");
  });

  it("rejects with stderr when ffmpeg exits non-zero", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(1, "Invalid data found"));

    await expect(concatVideos(["/tmp/a.mp4"], "/tmp/out.mp4")).rejects.toThrow(/Invalid data found/);
  });

  it("cleans up the temporary concat-list file after success", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(0));

    await concatVideos(["/tmp/a.mp4"], "/tmp/out.mp4");

    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it("still cleans up the temporary concat-list file when ffmpeg fails", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(1, "boom"));

    await expect(concatVideos(["/tmp/a.mp4"], "/tmp/out.mp4")).rejects.toThrow();

    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });
});

describe("probeDuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses HH:MM:SS.ss from ffmpeg's stderr output", async () => {
    // ffmpeg -i with no output exits non-zero — that's expected here, not an error.
    spawnMock.mockReturnValue(makeFakeProcess(1, "Input #0...\n  Duration: 00:00:05.03, start: 0.000000, bitrate: 512 kb/s\n"));

    const seconds = await probeDuration("/tmp/a.mp4");

    expect(seconds).toBeCloseTo(5.03, 2);
    const [bin, args] = spawnMock.mock.calls[0];
    expect(bin).toBe("/path/to/ffmpeg");
    expect(args).toEqual(["-i", "/tmp/a.mp4"]);
  });

  it("computes minutes/hours correctly", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(1, "Duration: 01:02:03.50, start: 0.000000"));
    const seconds = await probeDuration("/tmp/a.mp4");
    expect(seconds).toBeCloseTo(3600 + 120 + 3.5, 2);
  });

  it("throws clearly when no Duration line is present", async () => {
    spawnMock.mockReturnValue(makeFakeProcess(1, "some unrelated ffmpeg output"));
    await expect(probeDuration("/tmp/a.mp4")).rejects.toThrow(/Could not determine duration/);
  });
});

describe("concatVideosWithCrossfade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("probes each input's duration, builds the xfade filter graph, and spawns ffmpeg re-encoded (no -c copy, audio dropped)", async () => {
    // 3 probeDuration calls (one per input), each getting its own fake process,
    // then one final spawn for the actual crossfade concat.
    spawnMock
      .mockReturnValueOnce(makeFakeProcess(1, "Duration: 00:00:05.00, start: 0"))
      .mockReturnValueOnce(makeFakeProcess(1, "Duration: 00:00:05.00, start: 0"))
      .mockReturnValueOnce(makeFakeProcess(0));

    await concatVideosWithCrossfade(["/tmp/a.mp4", "/tmp/b.mp4"], "/tmp/out.mp4", 0.5);

    expect(spawnMock).toHaveBeenCalledTimes(3);
    const [, finalArgs] = spawnMock.mock.calls[2];
    expect(finalArgs).toEqual(expect.arrayContaining(["-i", "/tmp/a.mp4", "-i", "/tmp/b.mp4", "-an", "/tmp/out.mp4"]));
    expect(finalArgs).not.toContain("copy");
    const filterIdx = finalArgs.indexOf("-filter_complex");
    expect(finalArgs[filterIdx + 1]).toContain("xfade=transition=fade");
    const mapIdx = finalArgs.indexOf("-map");
    expect(finalArgs[mapIdx + 1]).toBe("[vout]");
  });

  it("rejects with stderr when the final crossfade ffmpeg call fails", async () => {
    spawnMock
      .mockReturnValueOnce(makeFakeProcess(1, "Duration: 00:00:05.00, start: 0"))
      .mockReturnValueOnce(makeFakeProcess(1, "Duration: 00:00:05.00, start: 0"))
      .mockReturnValueOnce(makeFakeProcess(1, "Invalid filter graph"));

    await expect(concatVideosWithCrossfade(["/tmp/a.mp4", "/tmp/b.mp4"], "/tmp/out.mp4")).rejects.toThrow(/Invalid filter graph/);
  });
});
