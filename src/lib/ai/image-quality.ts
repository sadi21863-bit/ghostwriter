// Shared image/video quality guards. AI image and video models, given only a
// positive prompt, routinely produce anatomy and physics errors (extra/fused
// fingers, extra limbs, broken joints, impossible poses, distorted proportions).
// A negative prompt + an explicit anatomy/physics directive is the single biggest
// cheap lever against this. Used by generateSoulImage, the video request bodies,
// and StoryDiffusion.

/** Exclusions appended as `negative_prompt` to image/video generation. */
export const ANATOMY_NEGATIVE_PROMPT = [
  "deformed", "disfigured", "mutated", "extra limbs", "extra arms", "extra legs",
  "extra fingers", "fused fingers", "too many fingers", "missing fingers",
  "malformed hands", "bad hands", "mangled hands", "bad anatomy",
  "anatomically incorrect", "distorted proportions", "disproportionate body",
  "broken limbs", "twisted limbs", "floating limbs", "dislocated joints",
  "impossible pose", "unnatural pose", "physically impossible",
  "warped face", "asymmetrical eyes", "lazy eye", "cross-eyed",
  "low quality", "blurry", "jpeg artifacts", "watermark", "signature",
].join(", ");

/** Positive directive appended to the prompt to steer toward correct anatomy. */
export const ANATOMY_POSITIVE_DIRECTIVE =
  "Anatomically correct, natural human proportions, correct number of fingers and limbs, physically plausible pose and physics, coherent perspective.";

/** Append the anatomy directive to a prompt if not already present. */
export function withAnatomyDirective(prompt: string): string {
  if (prompt.includes("Anatomically correct")) return prompt;
  return `${prompt.trimEnd()} ${ANATOMY_POSITIVE_DIRECTIVE}`;
}
