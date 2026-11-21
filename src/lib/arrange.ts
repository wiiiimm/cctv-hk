// Responsive wall arrangement driven by the user's preview size. The wall always fills the screen:
// as many 4:3 previews as fit at (about) the chosen size, stretched slightly so the space is used evenly.
//
// - No pin: previews fill the whole stage.
// - Pinned: previews form one regular grid and the pinned video covers a square block of cells, so every
//   preview is the same size and aligned.
//   - "side": block top-left, leaving a column of previews on its right and a row below (classic 1+N).
//   - "wide": the pinned tile spans the full width; previews sit only in rows below it.
// - Solo ("full"): one fitted 4:3 picture.
//
// Rect index i is the wall's cell i (cell 0 = the pinned video when pinned). The number of rects is the
// wall's capacity, which the store adopts so paging / patrol move by exactly one screenful.
import { CELL_ASPECT, fitWall } from "./layout";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PinMode = "wide" | "side";

export interface ArrangeInput {
  w: number;
  h: number;
  /** How the pinned video is sized (ignored when not pinned). */
  pinMode: PinMode;
  /** Preview (non-pinned tile) width the user asked for, in the same units as w/h. */
  previewW: number;
  pinned: boolean;
  solo: boolean;
  gap: number;
}

export interface Arrangement {
  rects: Rect[];
  kind: "solo" | "grid" | "side" | "wide";
}

/** Preview size range and steps (CSS px of tile width). */
export const PREVIEW_MIN = 120;
export const PREVIEW_MAX = 520;
export const PREVIEW_STEP = 20;
export const PREVIEW_DEFAULT = 300;

/** Fill a box with as many ~previewW 4:3 tiles as fit, grown evenly to use the box. */
export function fillBox(x: number, y: number, w: number, h: number, previewW: number, gap: number): Rect[] {
  if (w <= 0 || h <= 0) return [];
  const ph = previewW / CELL_ASPECT;
  const cols = Math.floor((w - gap) / (previewW + gap));
  const rows = Math.floor((h - gap) / (ph + gap));
  if (cols < 1 || rows < 1) return [];
  const f = fitWall(w, h, cols, rows, gap);
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push({ x: x + f.x + gap + c * (f.cellW + gap), y: y + f.y + gap + r * (f.cellH + gap), w: f.cellW, h: f.cellH });
  return out;
}

export function arrange(a: ArrangeInput): Arrangement {
  const { w, h, gap } = a;
  if (w <= 0 || h <= 0) return { rects: [], kind: "grid" };
  // Never let a preview be wider than the stage allows for at least one tile.
  const p = Math.max(40, Math.min(a.previewW, w - gap * 2, (h - gap * 2) * CELL_ASPECT));

  if (a.solo) {
    const f = fitWall(w, h, 1, 1, 0);
    return { rects: [{ x: f.x, y: f.y, w: f.cellW, h: f.cellH }], kind: "solo" };
  }

  if (!a.pinned) {
    const rects = fillBox(0, 0, w, h, p, gap);
    return { rects: rects.length ? rects : fillBox(0, 0, w, h, Math.min(w, h) / 2, gap), kind: "grid" };
  }

  if (a.pinMode === "wide") return wideLayout(w, h, p, gap);

  // Side: one regular grid of equal previews; the pinned video covers a span×span block of cells top-left
  // (4:3, since every cell is 4:3), so the column beside it and the row below are the same size and aligned.
  let q = p;
  let g = gridFor(w, h, q, gap);
  // Too few cells for a block plus previews: shrink the previews until it works.
  while (Math.min(g.cols, g.rows) < 3 && q > 48) {
    q *= 0.9;
    g = gridFor(w, h, q, gap);
  }
  const span = Math.max(1, Math.min(g.cols - 1, g.rows - 1));
  const f = fitWall(w, h, g.cols, g.rows, gap);
  const cell = (c: number, r: number, n = 1): Rect => ({
    x: f.x + gap + c * (f.cellW + gap),
    y: f.y + gap + r * (f.cellH + gap),
    w: n * f.cellW + (n - 1) * gap,
    h: n * f.cellH + (n - 1) * gap,
  });
  const rects: Rect[] = [cell(0, 0, span)];
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) if (!(r < span && c < span)) rects.push(cell(c, r));
  return { rects, kind: "side" };
}

/**
 * Wide: the pinned tile always spans the full width, with previews only in rows below it (never beside it).
 * On tall stages it is a full-width 4:3 and the leftover height becomes as many preview rows as fit; on wide
 * stages it keeps one preview row and the picture letterboxes inside the tile.
 */
function wideLayout(w: number, h: number, p: number, gap: number): Arrangement {
  const cols = Math.max(1, Math.floor((w - gap) / (p + gap)));
  const cellW = (w - gap * (cols + 1)) / cols;
  const cellH = cellW / CELL_ASPECT;
  const fullW = w - gap * 2;
  const maxBigH = fullW / CELL_ASPECT; // never taller than a full-width 4:3 picture
  // At least one preview row; on tall stages, as many rows as fit under a full-width 4:3 picture.
  let rows = Math.max(1, Math.floor((h - gap * 2 - Math.min(maxBigH, h * 0.6)) / (cellH + gap)));
  while (rows > 1 && h - gap * 2 - rows * (cellH + gap) < Math.min(maxBigH, h * 0.4)) rows--;
  const bigH = Math.max(40, Math.min(maxBigH, h - gap * 2 - rows * (cellH + gap)));
  const rects: Rect[] = [{ x: gap, y: gap, w: fullW, h: bigH }];
  const top = gap + bigH + gap;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) rects.push({ x: gap + c * (cellW + gap), y: top + r * (cellH + gap), w: cellW, h: cellH });
  return { rects, kind: "wide" };
}

/** Columns × rows of ~previewW 4:3 cells that fit in w×h. */
function gridFor(w: number, h: number, previewW: number, gap: number) {
  const ph = previewW / CELL_ASPECT;
  return {
    cols: Math.max(1, Math.floor((w - gap) / (previewW + gap))),
    rows: Math.max(1, Math.floor((h - gap) / (ph + gap))),
  };
}

// The arrangement currently on screen, so keyboard / gamepad navigation follows what the user sees.
let live: Rect[] = [];
export function publishGeometry(rects: Rect[]) {
  live = rects;
}
export function liveGeometry(): Rect[] {
  return live;
}

/** Index of the nearest rect from `from` in direction (dx, dy), or -1. */
export function neighbour(rects: Rect[], from: number, dx: number, dy: number): number {
  const c = rects.map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }));
  const o = c[from];
  if (!o) return -1;
  let best = -1;
  let bestD = Infinity;
  c.forEach((pt, i) => {
    const along = (pt.x - o.x) * dx + (pt.y - o.y) * dy;
    if (i === from || along <= 1) return;
    const across = Math.abs((pt.x - o.x) * dy) + Math.abs((pt.y - o.y) * dx);
    const d = along + across * 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
