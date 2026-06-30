import sharp from "sharp";
import path from "path";
import { buildDialogueBubbleSvg, buildCaptionBoxSvg, type BubbleType } from "./bubble-svg";

export type { BubbleType };

const FONT_DIR = path.join(process.cwd(), "src/lib/comic-lettering/fonts");
const REGULAR_FONT = path.join(FONT_DIR, "ComicNeue-Regular.ttf");
const BOLD_FONT = path.join(FONT_DIR, "ComicNeue-Bold.ttf");

export interface CompositeLetteringParams {
  imageBuffer: Buffer;
  dialogue?: string;
  caption?: string;
  speakerName?: string;
  bubbleType?: BubbleType;
}

export async function compositeLettering({
  imageBuffer,
  dialogue,
  caption,
  speakerName,
  bubbleType = "speech",
}: CompositeLetteringParams): Promise<Buffer> {
  const hasDialogue = !!dialogue?.trim();
  const hasCaption = !!caption?.trim();
  if (!hasDialogue && !hasCaption) return imageBuffer;

  const base = sharp(imageBuffer);
  const { width = 1024, height = 1024 } = await base.metadata();
  const overlays: sharp.OverlayOptions[] = [];

  if (hasCaption) {
    const boxHeight = Math.round(height * 0.12);
    overlays.push({ input: Buffer.from(buildCaptionBoxSvg(width, boxHeight)), top: 0, left: 0 });
    const textOverlay = await renderText(caption!.trim(), REGULAR_FONT, Math.round(width * 0.92), Math.round(boxHeight * 0.8), true);
    overlays.push(centerWithin(textOverlay, { top: 0, left: 0, width, height: boxHeight }));
  }

  if (hasDialogue) {
    const bubbleHeight = Math.round(height * 0.32);
    const bubbleTop = height - bubbleHeight;
    overlays.push({
      input: Buffer.from(buildDialogueBubbleSvg({ width, height: bubbleHeight, bubbleType })),
      top: bubbleTop,
      left: 0,
    });
    const label = speakerName?.trim() ? `${speakerName.trim()}: ${dialogue!.trim()}` : dialogue!.trim();
    const textOverlay = await renderText(label, BOLD_FONT, Math.round(width * 0.7), Math.round(bubbleHeight * 0.55), false);
    overlays.push(centerWithin(textOverlay, { top: bubbleTop, left: 0, width, height: bubbleHeight }));
  }

  return base.composite(overlays).png().toBuffer();
}

async function renderText(text: string, fontfile: string, width: number, height: number, light: boolean): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Caption text sits on a dark box → render white; bubble text sits on white → black.
  const colored = light ? `<span foreground="white">${escapePango(text)}</span>` : escapePango(text);
  const buffer = await sharp({
    text: {
      text: colored,
      font: "Comic Neue",
      fontfile,
      width,
      height,
      rgba: true,
      align: "center",
    },
  }).png().toBuffer();
  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width ?? width, height: meta.height ?? height };
}

function centerWithin(
  textOverlay: { buffer: Buffer; width: number; height: number },
  box: { top: number; left: number; width: number; height: number }
): sharp.OverlayOptions {
  return {
    input: textOverlay.buffer,
    top: box.top + Math.round((box.height - textOverlay.height) / 2),
    left: box.left + Math.round((box.width - textOverlay.width) / 2),
  };
}

function escapePango(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
