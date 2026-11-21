/** CCTV monitors are 4:3; most feeds (TD traffic, 320×240) are too. 16:9 feeds letterbox inside a cell. */
export const CELL_ASPECT = 4 / 3;

export interface WallFit {
  cellW: number;
  cellH: number;
  wallW: number;
  wallH: number;
  /** Offset of the wall inside the available area (centred). */
  x: number;
  y: number;
}

/** Largest cols×rows wall of 4:3 cells that fits in w×h with `gap` between and around cells. */
export function fitWall(w: number, h: number, cols: number, rows: number, gap: number, aspect = CELL_ASPECT): WallFit {
  const availW = Math.max(0, w - gap * (cols + 1));
  const availH = Math.max(0, h - gap * (rows + 1));
  let cellW = availW / cols;
  let cellH = cellW / aspect;
  if (cellH * rows > availH) {
    cellH = availH / rows;
    cellW = cellH * aspect;
  }
  const wallW = cellW * cols + gap * (cols + 1);
  const wallH = cellH * rows + gap * (rows + 1);
  return { cellW, cellH, wallW, wallH, x: (w - wallW) / 2, y: (h - wallH) / 2 };
}

/** One wall position in grid units. Slot 0 of a spotlight layout is the large one. */
export interface Slot {
  col: number;
  row: number;
  span: number;
}

/**
 * Positions for a cols×rows unit grid. With `span` > 1 the first slot is a span×span spotlight in the
 * top-left and the remaining units fill in reading order (e.g. 3×3 span 2 = the classic "1+5").
 */
export function slots(cols: number, rows: number, span = 0): Slot[] {
  const big = span > 1 ? Math.min(span, cols, rows) : 0;
  const out: Slot[] = big ? [{ col: 0, row: 0, span: big }] : [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (big && col < big && row < big) continue;
      out.push({ col, row, span: 1 });
    }
  return out;
}

export const slotCount = (cols: number, rows: number, span = 0) => slots(cols, rows, span).length;

/** Pixel rectangle of a slot inside a fitted wall. */
export function slotRect(fit: WallFit, s: Slot, gap: number) {
  return {
    x: fit.x + gap + s.col * (fit.cellW + gap),
    y: fit.y + gap + s.row * (fit.cellH + gap),
    w: s.span * fit.cellW + (s.span - 1) * gap,
    h: s.span * fit.cellH + (s.span - 1) * gap,
  };
}
