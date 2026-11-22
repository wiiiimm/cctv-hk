// Responsive wall arrangement driven by the user's preview size. The wall always fills the screen.
//
// - No pin: a grid of previews at about the chosen size. Columns and rows are picked to fill the stage exactly,
//   letting each cell's shape flex a little (±FLEX) around 4:3 instead of leaving black bands. When the group has
//   fewer feeds than the grid holds, the grid is re-fitted to that count so there are no empty rows.
// - Pinned: previews form one regular grid and the pinned video covers a span×span block of cells.
//   - "side": block top-left, leaving a column of previews on its right and a row below (classic 1+N).
//   - "wide": the pinned tile spans the full width; previews sit only in rows below it.
// - Solo ("full"): one fitted 4:3 picture.
//
// Rect index i is the wall's cell i (cell 0 = the pinned video when pinned). `capacity` is how many cells the stage
// holds at this preview size; the store adopts it so paging / patrol move by exactly one screenful, even when a
// small group shows fewer, bigger tiles.
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
  /** Feeds available for this wall (pinned one included). Fewer than the grid holds → re-fit to this count. */
  count?: number;
  /** How far a cell may stretch from 4:3 (0 = strict 4:3). */
  flex?: number;
}

export interface Arrangement {
  rects: Rect[];
  /** Cells the stage holds at this preview size (≥ rects.length when a small group is re-fitted). */
  capacity: number;
  kind: "solo" | "grid" | "side" | "wide";
}

/** Preview size range and steps (CSS px of tile width). */
export const PREVIEW_MIN = 120;
export const PREVIEW_MAX = 520;
export const PREVIEW_STEP = 20;
export const PREVIEW_DEFAULT = 300;
/** Default cell-shape flex around 4:3. */
export const FLEX = 0.15;

interface GridFit {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** Offset that centres the grid in its box. */
  x: number;
  y: number;
}

/** Fit a cols × rows grid into w×h: fill the width, fill the height within the flex range, centre any leftover. */
function fitGrid(w: number, h: number, cols: number, rows: number, gap: number, flex: number): GridFit {
  let cellW = (w - gap * (cols + 1)) / cols;
  let cellH = (h - gap * (rows + 1)) / rows;
  const minH = cellW / (CELL_ASPECT * (1 + flex)); // widest allowed shape
  const maxH = cellW / (CELL_ASPECT * (1 - flex)); // tallest allowed shape
  if (cellH > maxH) cellH = maxH; // too much height: cap it, leftover is centred
  if (cellH < minH) cellW = cellH * CELL_ASPECT * (1 + flex); // too little height: narrow the cells instead
  const usedW = cellW * cols + gap * (cols + 1);
  const usedH = cellH * rows + gap * (rows + 1);
  return { cols, rows, cellW, cellH, x: (w - usedW) / 2, y: (h - usedH) / 2 };
}

/** The best grid for ~p-wide cells in w×h: fills the stage while staying close to the asked size. */
export function bestGrid(w: number, h: number, p: number, gap: number, flex = FLEX): GridFit {
  const c0 = Math.max(1, Math.floor((w - gap) / (p + gap)));
  let best: (GridFit & { score: number }) | null = null;
  for (const cols of [c0, c0 + 1]) {
    const cellW = (w - gap * (cols + 1)) / cols;
    if (cols > c0 && cellW < 0.8 * p) continue;
    const rf = (h - gap) / (cellW / CELL_ASPECT + gap);
    for (const rows of new Set([Math.max(1, Math.floor(rf)), Math.max(1, Math.ceil(rf))])) {
      const f = fitGrid(w, h, cols, rows, gap, flex);
      const covered = (f.cellW * f.cellH * cols * rows) / (w * h);
      const score = covered - 0.25 * Math.abs(f.cellW - p) / p;
      if (!best || score > best.score) best = { ...f, score };
    }
  }
  return best!;
}

/** Biggest-cell grid for exactly `count` tiles in w×h (used when a group has fewer feeds than the grid holds). */
function countGrid(w: number, h: number, count: number, maxCols: number, gap: number, flex: number): GridFit {
  let best: GridFit | null = null;
  for (let cols = 1; cols <= Math.max(1, Math.min(maxCols, count)); cols++) {
    const f = fitGrid(w, h, cols, Math.ceil(count / cols), gap, flex);
    if (!best || f.cellW * f.cellH > best.cellW * best.cellH) best = f;
  }
  return best!;
}

function gridRects(f: GridFit, gap: number, n: number, ox = 0, oy = 0): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / f.cols);
    // Centre a partly filled last row.
    const inRow = Math.min(f.cols, n - r * f.cols);
    const shift = ((f.cols - inRow) * (f.cellW + gap)) / 2;
    const c = i % f.cols;
    out.push({ x: ox + f.x + gap + shift + c * (f.cellW + gap), y: oy + f.y + gap + r * (f.cellH + gap), w: f.cellW, h: f.cellH });
  }
  return out;
}

/** Fill a box with ~previewW tiles (exact-fill grid). Kept for callers that tile a sub-area. */
export function fillBox(x: number, y: number, w: number, h: number, previewW: number, gap: number, flex = FLEX): Rect[] {
  if (w <= 0 || h <= 0) return [];
  const f = bestGrid(w, h, previewW, gap, flex);
  return gridRects(f, gap, f.cols * f.rows, x, y);
}

export function arrange(a: ArrangeInput): Arrangement {
  const { w, h, gap } = a;
  const flex = a.flex ?? FLEX;
  if (w <= 0 || h <= 0) return { rects: [], capacity: 0, kind: "grid" };
  // Never let a preview be wider than the stage allows for at least one tile.
  const p = Math.max(40, Math.min(a.previewW, w - gap * 2, (h - gap * 2) * CELL_ASPECT));

  if (a.solo) {
    const f = fitWall(w, h, 1, 1, 0);
    return { rects: [{ x: f.x, y: f.y, w: f.cellW, h: f.cellH }], capacity: 1, kind: "solo" };
  }

  if (!a.pinned) {
    const g = bestGrid(w, h, p, gap, flex);
    const capacity = g.cols * g.rows;
    if (a.count !== undefined && a.count > 0 && a.count < capacity) {
      const f = countGrid(w, h, a.count, g.cols, gap, flex);
      return { rects: gridRects(f, gap, a.count), capacity, kind: "grid" };
    }
    return { rects: gridRects(g, gap, capacity), capacity, kind: "grid" };
  }

  if (a.pinMode === "wide") return wideLayout(w, h, p, gap, flex);

  // Side: one regular grid of equal previews; the pinned video covers a span×span block of cells top-left, so the
  // column beside it and the row below are the same size and aligned.
  let q = p;
  let g = bestGrid(w, h, q, gap, flex);
  // Too few cells for a block plus previews: shrink the previews until it works.
  while (Math.min(g.cols, g.rows) < 3 && q > 48) {
    q *= 0.9;
    g = bestGrid(w, h, q, gap, flex);
  }
  const span = Math.max(1, Math.min(g.cols - 1, g.rows - 1));
  const cell = (c: number, r: number, n = 1): Rect => ({
    x: g.x + gap + c * (g.cellW + gap),
    y: g.y + gap + r * (g.cellH + gap),
    w: n * g.cellW + (n - 1) * gap,
    h: n * g.cellH + (n - 1) * gap,
  });
  const rects: Rect[] = [cell(0, 0, span)];
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) if (!(r < span && c < span)) rects.push(cell(c, r));
  return { rects, capacity: rects.length, kind: "side" };
}

/**
 * Wide: the pinned tile always spans the full width, with previews only in rows below it (never beside it).
 * On tall stages it is a full-width 4:3 and the leftover height becomes as many preview rows as fit (cells flex to
 * use the height exactly); on wide stages it keeps one preview row and the picture letterboxes inside the tile.
 */
function wideLayout(w: number, h: number, p: number, gap: number, flex: number): Arrangement {
  const cols = Math.max(1, Math.floor((w - gap) / (p + gap)));
  const cellW = (w - gap * (cols + 1)) / cols;
  let cellH = cellW / CELL_ASPECT;
  const fullW = w - gap * 2;
  const maxBigH = fullW / CELL_ASPECT; // never taller than a full-width 4:3 picture
  // At least one preview row; on tall stages, as many rows as fit under a full-width 4:3 picture.
  let rows = Math.max(1, Math.floor((h - gap * 2 - Math.min(maxBigH, h * 0.6)) / (cellH + gap)));
  while (rows > 1 && h - gap * 2 - rows * (cellH + gap) < Math.min(maxBigH, h * 0.4)) rows--;
  let bigH = Math.max(40, Math.min(maxBigH, h - gap * 2 - rows * (cellH + gap)));
  // Any height left over (the pinned tile already at full-width 4:3): let the preview rows absorb it within flex.
  const spare = h - gap * 2 - bigH - rows * (cellH + gap);
  if (spare > 0) cellH = Math.min(cellW / (CELL_ASPECT * (1 - flex)), cellH + spare / rows);
  bigH = Math.max(40, Math.min(maxBigH, h - gap * 2 - rows * (cellH + gap)));
  const rects: Rect[] = [{ x: gap, y: gap, w: fullW, h: bigH }];
  const top = gap + bigH + gap;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) rects.push({ x: gap + c * (cellW + gap), y: top + r * (cellH + gap), w: cellW, h: cellH });
  return { rects, capacity: rects.length, kind: "wide" };
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
