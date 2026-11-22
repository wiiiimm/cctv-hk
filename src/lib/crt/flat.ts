// What the CRT draws flat (outside the shader) and whether the news ticker may curve — decided in one place.
//
// YouTube can't be drawn into WebGL, so playing videos are real players laid over the tube, and players are flat.
// Only those are flat: a YouTube tile without a player (a still with AUTOPLAY off, off air, loading) is an ordinary
// picture and goes through the shader with everything else — curved, scanlines, mask, static.
// The ticker band sits right above the wall's top row; if any flat tile touches it, a curved band would meet a
// straight edge, so the ticker is flat as well. Otherwise it curves with the rest of the picture.
import { CHANNEL_BY_KEY, MAX_PLAYING_PREVIEWS } from "../channels";
import { getSnap } from "../snapshots";
import type { Rect } from "../arrange";

/**
 * Cells that play a live YouTube player in CRT mode — every visible YouTube tile that is actually live. Off-air /
 * unavailable streams are left to the canvas, which draws the OFF AIR screen like any other dead feed.
 */
export function videoCells(s: { cells: string[]; pinned: boolean; focused: boolean; selected: number; autoplay: boolean }, shown: number): number[] {
  const isLiveYt = (key: string) => {
    const c = CHANNEL_BY_KEY.get(key);
    return c?.kind === "yt" && !c.noEmbed && !!getSnap(key).live; // no-embed channels stay a still on the canvas
  };
  if (s.focused) return isLiveYt(s.cells[s.selected]) ? [s.selected] : [];
  const out: number[] = [];
  // The pinned and the selected video always play; other previews only with AUTOPLAY on, and at most
  // MAX_PLAYING_PREVIEWS of them (else the canvas draws a still).
  let previews = 0;
  for (let i = 0; i < Math.min(shown, s.cells.length); i++) {
    if (!isLiveYt(s.cells[i])) continue;
    if ((s.pinned && i === 0) || i === s.selected) out.push(i);
    else if (s.autoplay && previews < MAX_PLAYING_PREVIEWS) {
      out.push(i);
      previews++;
    }
  }
  return out;
}

/** Visible cells drawn flat: the ones with a playing YouTube player (see videoCells). */
export function flatCells(s: { cells: string[]; pinned: boolean; focused: boolean; selected: number; autoplay: boolean }, shown: number): number[] {
  return videoCells(s, shown);
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
