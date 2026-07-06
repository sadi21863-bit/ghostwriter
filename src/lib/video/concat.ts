import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
import { buildXfadeFilterComplex } from "./xfade";

/**
 * Concatenates videos via ffmpeg's concat demuxer with stream-copy (-c copy,
 * no re-encoding) — only valid when every input shares the same codec/
 * resolution/timebase, true here since all inputs are Seedance-2.0 outputs
 * generated under this app's own fixed request shape.
 */
export async function concatVideos(inputPaths: string[], outputPath: string): Promise<void> {
  const listPath = `${outputPath}.list.txt`;
  const listContent = inputPaths.map(p => `file '${p}'`).join("\n");
  await writeFile(listPath, listContent);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath as unknown as string, [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
        outputPath,
      ]);

      let stderr = "";
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code: number) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg concat failed (exit ${code}): ${stderr}`));
      });
    });
  } finally {
    // Clean up the list file on both success and failure — a failed ffmpeg
    // run shouldn't leave it behind.
    await unlink(listPath);
  }
}

/**
 * Reads a video file's duration by running ffmpeg with no output and parsing
 * its stderr "Duration: HH:MM:SS.ss" line — no ffprobe binary is installed
 * (adding one means a new dependency plus mirroring the ffmpeg-static
 * Vercel-bundling gotcha for it too), and the already-bundled ffmpeg binary
 * already reports this for free. A non-zero exit code is EXPECTED here (no
 * output was requested) and is not itself an error.
 */
export async function probeDuration(path: string): Promise<number> {
  const stderr = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ffmpegPath as unknown as string, ["-i", path]);
    let out = "";
    proc.stderr.on("data", (chunk: Buffer) => { out += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", () => resolve(out));
  });

  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not determine duration for ${path} from ffmpeg output.`);
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * Crossfades between clips (ffmpeg's xfade filter) instead of concatVideos'
 * hard stream-copy cuts. Requires re-encoding — xfade decodes and blends
 * frames, so -c copy isn't an option here. Audio is dropped (-an): these
 * clips carry no meaningful audio today (Seedance's request shape never
 * asks for generate_audio), and acrossfade needs confirmed audio streams on
 * every input to do safely — a real sound/music layer is separately deferred
 * scope, not silently patched in here.
 */
export async function concatVideosWithCrossfade(inputPaths: string[], outputPath: string, transitionDuration = 0.5): Promise<void> {
  const durations = await Promise.all(inputPaths.map(probeDuration));
  const { filterComplex, finalLabel } = buildXfadeFilterComplex(durations, transitionDuration);

  const inputArgs = inputPaths.flatMap(p => ["-i", p]);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath as unknown as string, [
      "-y",
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", `[${finalLabel}]`,
      "-an",
      outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg crossfade concat failed (exit ${code}): ${stderr}`));
    });
  });
}
