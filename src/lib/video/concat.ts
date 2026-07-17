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

/**
 * Trims a clip to [startSec, endSec] (endSec null = keep to the clip's
 * natural end), re-encoding rather than stream-copying. -ss is placed AFTER
 * -i (decode-based, frame-accurate) rather than before it (fast but only
 * keyframe-accurate) — worth the extra decode cost given these clips are
 * only 5-15s long. Uses -t (output duration) rather than -to for the end
 * point — -to's meaning shifts depending on whether -ss was an input or
 * output option; -t is unambiguously "write this many seconds of output"
 * either way.
 */
export async function trimClip(inputPath: string, outputPath: string, startSec: number, endSec: number | null): Promise<void> {
  const args = ["-y", "-i", inputPath, "-ss", String(startSec)];
  if (endSec != null) args.push("-t", String(endSec - startSec));
  args.push(outputPath);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath as unknown as string, args);
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg trim failed (exit ${code}): ${stderr}`));
    });
  });
}

/**
 * Mixes a background-audio track under a video, replacing/attaching its
 * audio stream. Pads the audio with silence (apad) before applying -shortest
 * so a too-short track can never truncate the VIDEO — -shortest then only
 * ever trims trailing music/silence to the video's own length. The video
 * stream itself is untouched (-c:v copy) — only the audio needs encoding.
 *
 * Loudness-normalized (same EBU R128 target as concatAudioBuffers's fix for
 * the standalone Audio Novel/podcast path, item 71/72 research) — without
 * this, a scene's own audio and its mixed-in music can land at inconsistent
 * perceived volume, the identical bug just fixed elsewhere in the app but
 * never applied to this, the video pipeline's own audio mixing.
 */
export async function mixAudioIntoVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath as unknown as string, [
      "-y",
      "-i", videoPath,
      "-i", audioPath,
      "-filter_complex", "[1:a]apad,loudnorm=I=-16:TP=-1.5:LRA=11[a]",
      "-map", "0:v",
      "-map", "[a]",
      "-c:v", "copy",
      "-shortest",
      outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg audio mix failed (exit ${code}): ${stderr}`));
    });
  });
}
