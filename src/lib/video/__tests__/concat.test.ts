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
import { concatVideos } from "../concat";

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
