// Draws the security-monitor picture (wall or single feed, plus OSD) into a flat 2D canvas.
// The CRT renderer then uploads that canvas as a texture.
import { CHANNEL_BY_KEY, fmtNum } from "../channels";
import { DICTS, chAltName, chName } from "../i18n";
import type { Lang } from "../store";
import { getSnap } from "../snapshots";
import { DARKEN, TILE, project, tileImage, tileUrl } from "../maptiles";
import { hkStamp } from "../../hooks/useClock";
import { fitWall, slotRect, slots } from "../layout";

export interface ScreenView {
  cells: string[];
  cols: number;
  rows: number;
  span: number;
  selected: number;
  single: boolean;
  entry: string;
  switchedAt: number;
  /** Cell hit by the last change (-1 = whole screen). */
  switchedCell: number;
  showMap: boolean;
  presetLabel: string;
  presetAt: number;
  patrol: boolean;
  hideMedia: boolean;
  lang: Lang;
  /** Canvas pixels per CSS pixel, so OSD text matches the DOM wall's sizes. */
  scale: number;
  /** Safe margin (fraction of each side) so the wall clears the tube's curved edge and vignette. */
  inset: number;
}

const OSD = "VT323, 'Fusion Pixel 12px Monospaced TC', 'IBM Plex Mono', monospace";
let noise: HTMLCanvasElement | null = null;

function noiseTile(): HTMLCanvasElement {
  if (!noise) {
    noise = document.createElement("canvas");
    noise.width = noise.height = 128;
  }
  const ctx = noise.getContext("2d")!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 200) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return noise;
}

/** Fit the whole picture inside the cell (letterbox), as a 4:3 monitor shows a 16:9 feed. */
function contain(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = "#f2f2f2", align: CanvasTextAlign = "left") {
  ctx.font = `${size}px ${OSD}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillText(s, x + Math.max(1, size / 14), y + Math.max(1, size / 14));
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** Caption on an 85%-black box so white text stays legible over busy footage. */
function caption(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, align: CanvasTextAlign = "left") {
  ctx.font = `${size}px ${OSD}`;
  const w = ctx.measureText(s).width;
  const px = size * 0.3;
  const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(left - px, y - size * 0.12, w + px * 2, size * 1.15);
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#f2f2f2";
  ctx.fillText(s, x, y);
}

/** Steady status badge, right-aligned at (right, y): white text on a red (or amber) block. */
function badge(ctx: CanvasRenderingContext2D, label: string, right: number, y: number, size: number, bg: string) {
  ctx.font = `${size}px ${OSD}`;
  const tw = ctx.measureText(label).width;
  const px = size * 0.35;
  ctx.fillStyle = bg;
  ctx.fillRect(right - tw - px * 2, y - size * 0.08, tw + px * 2, size * 1.1);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, right - px, y);
}

function drawCell(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, now: number, big: boolean, hideMedia: boolean, lang: Lang, k: number, selected = false) {
  const t = DICTS[lang];
  const ch = CHANNEL_BY_KEY.get(key);
  ctx.fillStyle = "#050607";
  ctx.fillRect(x, y, w, h);
  if (!ch) return;
  const snap = getSnap(key);
  const dead = snap.status === "error" || snap.status === "offline";
  if (snap.bitmap && !dead && !hideMedia) {
    contain(ctx, snap.bitmap, snap.bitmap.width, snap.bitmap.height, x, y, w, h);
  } else if (!hideMedia) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ctx.createPattern(noiseTile(), "repeat")!;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    const label = snap.status === "loading" ? t.searching : snap.status === "offline" ? t.offAir : t.noSignal;
    const fs = Math.min(22, Math.max(13, Math.min(w, h) / k / 9)) * k;
    ctx.fillStyle = "rgba(10,20,120,0.85)";
    ctx.font = `${fs}px ${OSD}`;
    const tw = ctx.measureText(label).width;
    ctx.fillRect(x + w / 2 - tw / 2 - fs * 0.4, y + h / 2 - fs * 0.6, tw + fs * 0.8, fs * 1.2);
    text(ctx, label, x + w / 2, y + h / 2 - fs * 0.5, fs, "#ffffff", "center");
  }

  const fs = (big ? Math.min(18, Math.max(16, h / k / 40)) : Math.min(15, Math.max(12, Math.min(w, h) / k / 14))) * k;
  const pad = fs * 0.45;
  if (selected) {
    // Selected tile: channel number on a yellow tag.
    const label = `CH${fmtNum(ch.num)}`;
    ctx.font = `${fs}px ${OSD}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "#ffd60a";
    ctx.fillRect(x + pad - fs * 0.3, y + pad * 0.6 - fs * 0.08, tw + fs * 0.6, fs * 1.1);
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + pad, y + pad * 0.6);
    caption(ctx, t.kind[ch.kind].toUpperCase(), x + pad + tw + fs * 0.7, y + pad * 0.6, fs);
  } else caption(ctx, `CH${fmtNum(ch.num)} ${t.kind[ch.kind].toUpperCase()}`, x + pad, y + pad * 0.6, fs);
  if (ch.kind === "yt") {
    if (snap.live) badge(ctx, t.live, x + w - pad, y + pad * 0.6, fs, "#d71f1f");
  } else {
    const stale = snap.takenAt && now - snap.takenAt > ch.refreshMs * 3;
    badge(ctx, stale ? t.stale : t.rec, x + w - pad, y + pad * 0.6, fs, stale ? "#c27c00" : "#d71f1f");
  }
  // Primary language always; the other language too when the cell is wide enough.
  ctx.font = `${fs}px ${OSD}`;
  // Small cells: name and stamp share the bottom line, so the name gets whatever the stamp leaves.
  // Big (focused) view: name line above, stamp line below.
  const stamp = ch.kind === "yt" ? hkStamp(now) : snap.takenAt ? hkStamp(snap.takenAt) : "----/--/-- --:--:--";
  const showStamp = big || w > 260;
  const stampW = showStamp && !big ? ctx.measureText(stamp).width + pad : 0;
  const room = w - pad * 2 - stampW - (big ? w * 0.3 : 0);
  // Primary language always; the other language too when it fits.
  const both = `${chName(ch, lang)}  ${chAltName(ch, lang)}`;
  let label = ctx.measureText(both).width <= room ? both : chName(ch, lang);
  const full = label;
  while (label.length > 2 && ctx.measureText(label + "…").width > room) label = label.slice(0, -1);
  if (label !== full) label += "…";
  caption(ctx, label, x + pad, y + h - fs - pad * 0.6 - (big ? fs * 1.25 : 0), fs);
  if (showStamp) caption(ctx, stamp, big ? x + pad : x + w - pad, y + h - fs - pad * 0.6, fs, big ? "left" : "right");
}

function drawMap(ctx: CanvasRenderingContext2D, lat: number, lon: number, approx: boolean, x: number, y: number, w: number, h: number, now: number) {
  const z = approx ? 14 : 16;
  const c = project(lat, lon, z);
  const px = c.x * TILE - w / 2;
  const py = c.y * TILE - h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(x, y, w, h);
  ctx.filter = DARKEN;
  const n = 2 ** z;
  for (let tx = Math.floor(px / TILE); tx <= Math.floor((px + w) / TILE); tx++)
    for (let ty = Math.floor(py / TILE); ty <= Math.floor((py + h) / TILE); ty++) {
      const img = tileImage(tileUrl(z, ((tx % n) + n) % n, ty));
      if (img) ctx.drawImage(img, x + tx * TILE - px, y + ty * TILE - py, TILE, TILE);
    }
  ctx.filter = "none";
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.strokeStyle = "rgba(255,210,0,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + w, cy);
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y + h);
  ctx.stroke();
  const pulse = (now % 1600) / 1600;
  ctx.strokeStyle = `rgba(255,59,48,${1 - pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 6 + pulse * (approx ? 30 : 16), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ff3b30";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  const fs = Math.max(12, Math.min(16, h * 0.08));
  text(ctx, `${lat.toFixed(4)}N ${lon.toFixed(4)}E${approx ? " ≈" : ""}`, x + 6, y + h - fs - 4, fs, "#ffd60a");
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Selected-tile indicator: yellow frame with heavy corner brackets (a camera-select reticle). */
function drawSelection(ctx: CanvasRenderingContext2D, r: CellRect, k: number) {
  const y = "#ffd60a";
  ctx.strokeStyle = y;
  ctx.lineWidth = 3 * k;
  ctx.strokeRect(r.x + 1.5 * k, r.y + 1.5 * k, r.w - 3 * k, r.h - 3 * k);
  const len = Math.min(28 * k, r.w / 4, r.h / 4);
  const t = 6 * k;
  const i = 3 * k;
  ctx.fillStyle = y;
  for (const [cx, cy, sx, sy] of [
    [r.x + i, r.y + i, 1, 1],
    [r.x + r.w - i, r.y + i, -1, 1],
    [r.x + i, r.y + r.h - i, 1, -1],
    [r.x + r.w - i, r.y + r.h - i, -1, -1],
  ]) {
    ctx.fillRect(sx > 0 ? cx : cx - len, sy > 0 ? cy : cy - t, len, t);
    ctx.fillRect(sx > 0 ? cx : cx - t, sy > 0 ? cy : cy - len, t, len);
  }
}

/** Draws the screen and returns each visible cell's rectangle (by cell index) in canvas pixels. */
export function drawScreen(ctx: CanvasRenderingContext2D, w: number, h: number, v: ScreenView, now: number): Map<number, CellRect> {
  const rects = new Map<number, CellRect>();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const gap = v.single ? 0 : Math.max(2, Math.round(w / 400));
  const cols = v.single ? 1 : v.cols;
  const rows = v.single ? 1 : v.rows;
  // Fit the 4:3-cell wall inside the safe area; whatever is left over letterboxes.
  const mx = w * v.inset;
  const my = h * v.inset;
  const fit = fitWall(w - mx * 2, h - my * 2, cols, rows, gap);
  fit.x += mx;
  fit.y += my;
  const indices = v.single ? [v.selected] : v.cells.map((_, i) => i);

  const layout = v.single ? [{ col: 0, row: 0, span: 1 }] : slots(cols, rows, v.span);
  indices.forEach((ci, slot) => {
    const r = slotRect(fit, layout[slot], gap);
    rects.set(ci, r);
    const big = v.single || (v.span > 1 && ci === 0);
    const highlight = !v.single && ci === v.selected && !big;
    drawCell(ctx, v.cells[ci], r.x, r.y, r.w, r.h, now, big, v.hideMedia && v.single, v.lang, v.scale, highlight);
    if (highlight) drawSelection(ctx, r, v.scale);
  });

  // Screen-level OSD (channel number on change, picture mode, sequence) — a notch above the captions.
  const big = 20 * v.scale;
  const active = CHANNEL_BY_KEY.get(v.cells[v.selected]);
  // Channel number OSD sits in the frame being tuned (top-right, under its status badge);
  // whole-screen changes keep it in the screen corner.
  const osdAt = (cell: number) => {
    const r = v.single ? undefined : rects.get(cell);
    return r ? { x: r.x + r.w - big * 0.5, y: r.y + big * 1.5 } : { x: w - mx - big * 0.6, y: my + big * 0.5 };
  };
  if (v.entry) {
    const p = osdAt(v.selected);
    text(ctx, `CH ${v.entry.padEnd(4, "-")}`, p.x, p.y, big * 1.2, "#7CFF6B", "right");
  } else if (now - v.switchedAt < 2500) {
    const cellCh = v.switchedCell >= 0 ? CHANNEL_BY_KEY.get(v.cells[v.switchedCell]) : active;
    if (cellCh) {
      const p = osdAt(v.switchedCell);
      text(ctx, `CH ${fmtNum(cellCh.num)}`, p.x, p.y, big * 1.2, "#7CFF6B", "right");
    }
  }
  if (now - v.presetAt < 2500) text(ctx, v.presetLabel.toUpperCase(), w / 2, h - my - big * 1.8, big * 0.8, "#7CFF6B", "center");
  if (v.patrol) text(ctx, DICTS[v.lang].seq, mx + big * 0.5, h - my - big * 1.3, big * 0.7, "#7CFF6B");

  // Map inset on the pinned video (solo, or the big slot of a pinned layout): top-left, under the channel label.
  const pinnedRect = v.single ? rects.get(v.selected) : v.span > 1 ? rects.get(0) : undefined;
  const pinnedCh = v.single ? active : v.span > 1 ? CHANNEL_BY_KEY.get(v.cells[0]) : undefined;
  if (pinnedRect && v.showMap && pinnedCh?.geo) {
    const { x: cellX, y: cellY, w: cellW } = pinnedRect;
    const mw = Math.round(cellW * 0.18);
    const mh = Math.round(mw * 0.66);
    const fsCap = 18 * v.scale;
    ctx.save();
    ctx.globalAlpha = 0.65;
    // Channel label: left edge at cellX + pad (pad = 0.45·fs), bottom ≈ top + 1.8·fs.
    drawMap(ctx, pinnedCh.geo.lat, pinnedCh.geo.lon, pinnedCh.geo.approx, cellX + fsCap * 0.45, cellY + fsCap * 2.2, mw, mh, now);
    ctx.restore();
  }
  return rects;
}
