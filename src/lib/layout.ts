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
