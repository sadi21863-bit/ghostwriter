import sharp from "sharp";

// Server-side port of ComicStudio.tsx's client-only exportPng() canvas layout —
// 2 columns × up to 3 rows, 528×528 per panel, 1056×1584 canvas — so the CBZ
// export pipeline can produce the same composed comic PAGE a reader expects,
// instead of zipping each panel's raw crop as its own "page."

const CELL_SIZE = 528;
const COLS = 2;
const MAX_ROWS = 3;
const MAX_PANELS = COLS * MAX_ROWS;

export interface PageLayout {
  cols: number;
  rows: number;
  canvasWidth: number;
  canvasHeight: number;
  cellSize: number;
}

/** Pure grid-dimension math — no image work, so it's unit-testable without sharp. */
export function pageLayoutFor(panelCount: number): PageLayout {
  const count = Math.max(1, Math.min(panelCount, MAX_PANELS));
  const rows = Math.min(MAX_ROWS, Math.ceil(count / COLS));
  return {
    cols: COLS,
    rows,
    canvasWidth: COLS * CELL_SIZE,
    canvasHeight: rows * CELL_SIZE,
    cellSize: CELL_SIZE,
  };
}

/**
 * Composites up to 6 panel image buffers (in panel order) onto one blank page
 * canvas, matching exportPng()'s grid exactly. Extra panels beyond MAX_PANELS
 * are dropped (same `Math.min(panels.length, 6)` cap the client version uses).
 */
export async function compositePage(panelImageBuffers: Buffer[]): Promise<Buffer> {
  const panels = panelImageBuffers.slice(0, MAX_PANELS);
  const layout = pageLayoutFor(panels.length);

  const resized = await Promise.all(
    panels.map(buf => sharp(buf).resize(layout.cellSize, layout.cellSize, { fit: "cover" }).toBuffer())
  );

  const overlays: sharp.OverlayOptions[] = resized.map((buf, i) => ({
    input: buf,
    left: (i % layout.cols) * layout.cellSize,
    top: Math.floor(i / layout.cols) * layout.cellSize,
  }));

  return sharp({
    create: {
      width: layout.canvasWidth,
      height: layout.canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(overlays)
    .jpeg()
    .toBuffer();
}
