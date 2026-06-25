import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";

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
