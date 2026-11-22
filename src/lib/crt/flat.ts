// What the CRT draws flat (outside the shader) and whether the news ticker may curve — decided in one place.
//
// YouTube can't be drawn into WebGL, so live streams are real players laid over the tube, and players are flat.
// To keep every YouTube tile one shape, off-air / loading YouTube tiles are flat too (drawn on the overlay canvas).
// The ticker band sits right above the wall's top row; if any flat tile touches it, a curved band would meet a
// straight edge, so the ticker is flat as well. Otherwise it curves with the rest of the picture.
import { CHANNEL_BY_KEY } from "../channels";
import type { Rect } from "../arrange";

/** Visible cells drawn flat: every YouTube tile on screen (in full view, just the one shown). */
export function flatCells(s: { cells: string[]; focused: boolean; selected: number }, shown: number): number[] {
  const isYt = (key: string) => CHANNEL_BY_KEY.get(key)?.kind === "yt";
  if (s.focused) return isYt(s.cells[s.selected]) ? [s.selected] : [];
  const out: number[] = [];
  for (let i = 0; i < Math.min(shown, s.cells.length); i++) if (isYt(s.cells[i])) out.push(i);
  return out;
}

/**
 * The ticker curves (is drawn through the shader) unless a flat tile sits in the top row, i.e. starts within a
 * few px of the band's bottom edge. `rectOf(i)` gives cell i's rect in the same units as `bandBottom`.
 */
export function tickerCurves(flat: number[], rectOf: (i: number) => Rect | undefined, bandBottom: number): boolean {
  return !flat.some((i) => {
    const r = rectOf(i);
    return !!r && r.y <= bandBottom + 8;
  });
}
