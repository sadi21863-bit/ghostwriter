export type BubbleType = "speech" | "shout" | "thought";

export interface DialogueBubbleParams {
  width: number;
  height: number;
  bubbleType: BubbleType;
}

const FILL = "#ffffff";
const STROKE = "#000000";
const STROKE_WIDTH = 4;

export function buildDialogueBubbleSvg({ width, height, bubbleType }: DialogueBubbleParams): string {
  const cx = width / 2;
  const cy = height * 0.58;
  const rx = width * 0.46;
  const ry = height * 0.38;

  const body = bubbleType === "shout"
    ? jaggedPolygon(cx, cy, rx, ry)
    : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${FILL}" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" />`;

  const tail = bubbleType === "thought" ? thoughtTrailCircles(cx, cy, ry) : speechTail(cx, cy, ry);

  // Tail/trail drawn first (no stroke) so it sits visually under the bubble body.
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${tail}${body}</svg>`;
}

export function buildCaptionBoxSvg(width: number, height: number): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="6" fill="rgba(0,0,0,0.82)" /></svg>`;
}

function speechTail(cx: number, cy: number, ry: number): string {
  const tipY = Math.max(2, cy - ry * 1.5);
  return `<polygon points="${cx - 18},${cy - ry * 0.5} ${cx + 18},${cy - ry * 0.5} ${cx - 4},${tipY}" fill="${FILL}" />`;
}

function thoughtTrailCircles(cx: number, cy: number, ry: number): string {
  const baseY = cy - ry * 0.6;
  const circles = [
    { r: 14, dy: 0 },
    { r: 9, dy: -26 },
    { r: 5, dy: -46 },
  ];
  return circles
    .map(c => `<circle cx="${cx - 10}" cy="${Math.max(4, baseY + c.dy)}" r="${c.r}" fill="${FILL}" stroke="${STROKE}" stroke-width="2" />`)
    .join("");
}

function jaggedPolygon(cx: number, cy: number, rx: number, ry: number): string {
  const points: string[] = [];
  const spikes = 14;
  for (let i = 0; i < spikes; i++) {
    const angle = (i / spikes) * Math.PI * 2;
    const radiusFactor = i % 2 === 0 ? 1 : 0.72;
    const x = cx + Math.cos(angle) * rx * radiusFactor;
    const y = cy + Math.sin(angle) * ry * radiusFactor;
    points.push(`${x},${y}`);
  }
  return `<polygon points="${points.join(" ")}" fill="${FILL}" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" />`;
}
