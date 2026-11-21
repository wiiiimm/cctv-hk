// Responsive wall arrangement driven by the user's preview size. The wall always fills the screen:
// as many 4:3 previews as fit at (about) the chosen size, stretched slightly so the space is used evenly.
//
// - No pin: previews fill the whole stage.
// - Pinned: previews form one regular grid and the pinned video covers a square block of cells, so every
//   preview is the same size and aligned.
//   - "side": block top-left, leaving a column of previews on its right and a row below (classic 1+N).
//   - "wide": block as wide as fits while leaving a row below; centred, previews fill either side.
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

  // Pinned: one regular grid of equal previews; the pinned video covers a span×span block of cells
  // (4:3, since every cell is 4:3), so the previews beside and below it are the same size and aligned.
  const side = a.pinMode === "side";
  let q = p;
  let g = gridFor(w, h, q, gap);
  // Too few cells for a block plus previews: shrink the previews until it works.
  const need = (gg: { cols: number; rows: number }) => (side ? Math.min(gg.cols, gg.rows) >= 3 : gg.cols >= 2 && gg.rows >= 3);
  while (!need(g) && q > 48) {
    q *= 0.9;
    g = gridFor(w, h, q, gap);
  }
  const span = Math.max(1, side ? Math.min(g.cols - 1, g.rows - 1) : Math.min(g.cols, g.rows - 1));
  const startCol = side ? 0 : Math.floor((g.cols - span) / 2);
  const f = fitWall(w, h, g.cols, g.rows, gap);
  const cell = (c: number, r: number, n = 1): Rect => ({
    x: f.x + gap + c * (f.cellW + gap),
    y: f.y + gap + r * (f.cellH + gap),
    w: n * f.cellW + (n - 1) * gap,
    h: n * f.cellH + (n - 1) * gap,
  });
  const rects: Rect[] = [cell(startCol, 0, span)];
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      const inBlock = r < span && c >= startCol && c < startCol + span;
      if (!inBlock) rects.push(cell(c, r));
    }
  return { rects, kind: side ? "side" : "wide" };
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
