// Draws the security-monitor picture (wall or single feed, plus OSD) into a flat 2D canvas.
// The CRT renderer then uploads that canvas as a texture.
import { wxIconImage } from "../wxIcons";
import { CHANNEL_BY_KEY, fmtNum } from "../channels";
import { DICTS, chAltName, chName } from "../i18n";
import type { Lang } from "../store";
import { getSnap } from "../snapshots";
import type { NewsItem } from "../news";
import { DARKEN, FLIGHT_MS, fmtLatLon, flyView, pointIn, reducedMotion, tileImage, tilesForView, viewOf, type MapView } from "../maptiles";
import { hkStamp } from "../../hooks/useClock";
import { arrange, type PinMode } from "../arrange";
import { ICON_PATHS, type IconName } from "../../components/icons";

export interface ScreenView {
  cells: string[];
  /** A video is pinned (cell 0 shown large). */
  pinned: boolean;
  pinMode: PinMode;
  /** User's preview width in CSS px (scaled by `scale` for the canvas). */
  previewW: number;
  selected: number;
  single: boolean;
  entry: string;
  switchedAt: number;
  /** Cell hit by the last change (-1 = whole screen). */
  switchedCell: number;
  showMap: boolean;
  /** Map inset folded to a small box. */
  mapMini?: boolean;
  presetLabel: string;
  presetAt: number;
  patrol: boolean;
  /** Cells covered by a real YouTube player in the DOM: drawn without a picture (OSD only). */
  videoCells: number[];
  /** Cells drawn flat on the overlay (all YouTube tiles: players can't be warped, so off-air ones match them). */
  flatCells?: number[];
  lang: Lang;
  /** Canvas pixels per CSS pixel, so OSD text matches the DOM wall's sizes. */
  scale: number;
  /**
   * Pin buttons drawn into the picture (so every CRT effect applies to them): which cell, which buttons
   * (left → right), and their opacity. Invisible DOM buttons on top handle the clicks.
   */
  pinUi?: { cell: number; buttons: { icon: IconName; on: boolean }[]; opacity: number };
  /** Feeds available for the wall (re-fits small groups, same as the DOM wall). */
  count?: number;
  /** News ticker items drawn in a band across the top of the tube (null = off). */
  news?: NewsItem[] | null;
  /** A live YouTube player sits right under the band: leave the band empty, the flat DOM ticker covers it. */
  flatTicker?: boolean;
  /** Height of that band in CSS px. */
  newsH?: number;
  aspect?: number;
  pinAspect?: number;
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

/** Phones: preview badges become a dot (the pinned / full tile keeps its label), matching the DOM wall. */
const phoneMq = typeof window !== "undefined" ? window.matchMedia("(max-width: 760px)") : null;

/** Steady status badge, right-aligned at (right, y): white text on a red (or amber) block — or just a dot. */
function badge(ctx: CanvasRenderingContext2D, label: string, right: number, y: number, size: number, bg: string, dot = false) {
  if (dot) {
    const r = size * 0.32;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(right - r, y + size * 0.5, r + size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(right - r, y + size * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
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

/**
 * One wall cell: picture (or no-signal screen) on `ctx`, then its OSD (labels, badge, caption, stamp) on `osd` —
 * the shader canvas normally; the flat overlay above the players for live YouTube cells, so a player never hides it.
 */
function drawCell(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, now: number, big: boolean, hideMedia: boolean, lang: Lang, k: number, selected = false, osd: CanvasRenderingContext2D = ctx) {
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
    const blocked = snap.reason === "blocked";
    const label = snap.status === "loading" ? t.searching : blocked ? t.unavailable : snap.status === "offline" ? t.offAir : t.noSignal;
    const fs = Math.min(22, Math.max(13, Math.min(w, h) / k / 9)) * k;
    const cy = y + h / 2 - (blocked ? fs * 0.5 : 0);
    ctx.fillStyle = "rgba(10,20,120,0.85)";
    ctx.font = `${fs}px ${OSD}`;
    const tw = ctx.measureText(label).width;
    ctx.fillRect(x + w / 2 - tw / 2 - fs * 0.4, cy - fs * 0.6, tw + fs * 0.8, fs * 1.2);
    text(ctx, label, x + w / 2, cy - fs * 0.5, fs, "#ffffff", "center");
    if (blocked) {
      // Second line: a quiet hint at why ("May be region-restricted").
      const sf = fs * 0.62;
      ctx.font = `${sf}px ${OSD}`;
      const sw = ctx.measureText(t.maybeRegion).width;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(x + w / 2 - sw / 2 - sf * 0.5, cy + fs * 0.85, sw + sf, sf * 1.3);
      text(ctx, t.maybeRegion, x + w / 2, cy + fs * 0.85 + sf * 0.12, sf, "#dfe3ea", "center");
    }
  }

  ctx = osd; // everything below is OSD
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
    if (snap.live) badge(ctx, snap.replay ? t.replay : t.live, x + w - pad, y + pad * 0.6, fs, snap.replay ? "#c27c00" : "#d71f1f", !!phoneMq?.matches && !big);
  } else {
    const stale = snap.takenAt && now - snap.takenAt > ch.refreshMs * 3;
    badge(ctx, stale ? t.stale : t.rec, x + w - pad, y + pad * 0.6, fs, stale ? "#c27c00" : "#d71f1f", !!phoneMq?.matches && !big);
  }
  // Primary language always; the other language too when the cell is wide enough.
  ctx.font = `${fs}px ${OSD}`;
  // Small cells: name and stamp share the bottom line, so the name gets whatever the stamp leaves.
  // Big (focused) view: name line above, stamp line below.
  // Recording slots: when it aired, not now.
  const recorded = ch.kind === "yt" && snap.replay && snap.title && snap.takenAt;
  const stamp = ch.kind === "yt" && !recorded ? hkStamp(now) : snap.takenAt ? hkStamp(snap.takenAt) : "----/--/-- --:--:--";
  const showStamp = big || w > 260;
  const stampW = showStamp && !big ? ctx.measureText(stamp).width + pad : 0;
  const room = w - pad * 2 - stampW - (big ? w * 0.3 : 0);
  // Primary language always; the other language too when it fits.
  const primary = snap.title ?? chName(ch, lang);
  const both = `${primary}  ${snap.title ? chName(ch, lang) : chAltName(ch, lang)}`;
  let label = ctx.measureText(both).width <= room ? both : primary;
  const full = label;
  while (label.length > 2 && ctx.measureText(label + "…").width > room) label = label.slice(0, -1);
  if (label !== full) label += "…";
  caption(ctx, label, x + pad, y + h - fs - pad * 0.6 - (big ? fs * 1.25 : 0), fs);
  if (showStamp) caption(ctx, stamp, big ? x + pad : x + w - pad, y + h - fs - pad * 0.6, fs, big ? "left" : "right");
}

// The CRT map flies between pinned locations like the sidebar map (state kept across frames).
let mapFlight: { from: MapView; to: MapView; t0: number } | null = null;
let mapShown: MapView | null = null;

function drawMap(ctx: CanvasRenderingContext2D, lat: number, lon: number, approx: boolean, x: number, y: number, w: number, h: number, now: number, label = true) {
  const target = viewOf(lat, lon, approx ? 14 : 16);
  const same = (p: MapView | null) => !!p && p.x === target.x && p.y === target.y && p.z === target.z;
  if (!same(mapFlight?.to ?? null)) mapFlight = { from: mapShown && !reducedMotion() ? mapShown : target, to: target, t0: now };
  const f = mapFlight!;
  const view = now - f.t0 >= FLIGHT_MS ? target : flyView(f.from, target, (now - f.t0) / FLIGHT_MS, w);
  mapShown = view;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(x, y, w, h);
  ctx.filter = DARKEN;
  for (const tl of tilesForView(view, w, h)) {
    const img = tileImage(tl.url);
    if (img) ctx.drawImage(img, x + tl.left, y + tl.top, tl.size, tl.size);
  }
  ctx.filter = "none";
  // Reticle stays centred; the pin rides with the map until the flight lands.
  const pin = pointIn(view, target, w, h);
  const rx = x + w / 2;
  const ry = y + h / 2;
  const cx = x + pin.x;
  const cy = y + pin.y;
  ctx.strokeStyle = "rgba(255,210,0,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, ry);
  ctx.lineTo(x + w, ry);
  ctx.moveTo(rx, y);
  ctx.lineTo(rx, y + h);
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
  if (!label) return; // folded box: map + pin only
  const fs = Math.max(12, Math.min(16, h * 0.08));
  text(ctx, `${fmtLatLon(lat, lon, 4)}${approx ? " ≈" : ""}`, x + 6, y + h - fs - 4, fs, "#ffd60a");
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

// Same geometry as the DOM .pin-controls / .icon-btn: 28×26 buttons, right 8px, bottom 34px; 4px after the pin
// toggle, 2px between the pinned-size buttons.
const BTN_W = 28;
const BTN_H = 26;
const pathCache = new Map<string, Path2D>();
const path2d = (d: string) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

function drawPinUi(ctx: CanvasRenderingContext2D, r: CellRect, ui: NonNullable<ScreenView["pinUi"]>, k: number) {
  if (ui.opacity <= 0) return;
  const gaps: number[] = ui.buttons.map((_, i) => (i === 0 ? 0 : i === 1 ? 4 : 2));
  const total = ui.buttons.length * BTN_W + gaps.reduce((a, b) => a + b, 0);
  let x = r.x + r.w - (8 + total) * k;
  const y = r.y + r.h - (34 + BTN_H) * k;
  ctx.save();
  ctx.globalAlpha = ui.opacity;
  ui.buttons.forEach((b, i) => {
    x += gaps[i] * k;
    // Button body
    const rr = 4 * k;
    ctx.beginPath();
    ctx.roundRect(x, y, BTN_W * k, BTN_H * k, rr);
    ctx.fillStyle = b.on ? "#ffd60a" : "rgba(24,28,34,0.9)";
    ctx.fill();
    ctx.lineWidth = 1 * k;
    ctx.strokeStyle = b.on ? "#ffd60a" : "#303642";
    ctx.stroke();
    // Icon (24-unit path data, drawn at 16px like the DOM buttons)
    const s = (16 * k) / 24;
    ctx.save();
    ctx.translate(x + (BTN_W * k - 24 * s) / 2, y + (BTN_H * k - 24 * s) / 2);
    ctx.scale(s, s);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = b.on ? "#000" : "#e4e8ee";
    for (const d of ICON_PATHS[b.icon]) ctx.stroke(path2d(d));
    ctx.restore();
    x += BTN_W * k;
  });
  ctx.restore();
}

// ---- News ticker band (CRT): same content and order as the DOM ticker, crawled on the canvas ----
const TICKER_SPEED = 70; // CSS px per second
let tickerCache: { items: NewsItem[]; lang: string; fs: number; runs: { tag?: string; tagBg?: string; tagFg?: string; icon?: number; text: string; color: string; tagW: number; textW: number; w: number }[]; total: number } | null = null;

function drawTicker(ctx: CanvasRenderingContext2D, items: NewsItem[], lang: Lang, x: number, y: number, w: number, h: number, scale: number, now: number) {
  const d = DICTS[lang];
  // VT323 reads small for Latin text: English gets a larger size than the CJK pixel font needs.
  const fs = Math.round(h * (lang === "en" ? 0.98 : 0.7));
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.fillRect(x, y, w, h);
  // Label block.
  ctx.font = `${fs}px ${OSD}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left"; // other OSD text leaves right / centre alignment behind
  const label = d.newsLabel;
  const lw = ctx.measureText(label).width + fs * 0.9;
  ctx.fillStyle = "#d71f1f";
  ctx.fillRect(x, y, lw, h);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + fs * 0.45, y + h / 2 + 1);
  const vx = x + lw + fs * 0.4;
  const vw = w - (vx - x);
  ctx.beginPath();
  ctx.rect(vx, y, vw, h);
  ctx.clip();
  if (!items.length) {
    ctx.restore();
    return;
  }
  if (!tickerCache || tickerCache.items !== items || tickerCache.lang !== lang || tickerCache.fs !== fs) {
    const gap = fs * 2.2;
    const runs = items.map((it) => {
      const tag = it.kind === "warn" ? d.newsWarn : it.kind === "traffic" ? d.newsTraffic : it.kind === "weather" ? d.newsWeather : undefined;
      const iconW = it.icon !== undefined ? fs * 1.25 : 0;
      const time = it.kind !== "traffic" && it.time ? new Date(it.time).toLocaleTimeString("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit" }) + "  " : "";
      const text = time + it.text;
      const tagW = tag ? ctx.measureText(tag).width + fs * 0.7 : 0;
      const textW = ctx.measureText(text).width;
      const tagBg = it.kind === "warn" ? "#d71f1f" : it.kind === "weather" ? "#1f6fb8" : "#c27c00";
      const tagFg = it.kind === "traffic" ? "#000" : "#fff";
      const color = it.kind === "warn" ? "#ff8a80" : it.kind === "weather" ? "#bfe1ff" : "#f2f2f2";
      return { tag, tagBg, tagFg, icon: it.icon, text, color, tagW, textW, w: (tag ? tagW + fs * 0.5 : 0) + (iconW ? iconW + fs * 0.35 : 0) + textW + gap };
    });
    tickerCache = { items, lang, fs, runs, total: runs.reduce((a, r) => a + r.w, 0) };
  }
  const { runs, total } = tickerCache;
  const offset = ((now / 1000) * TICKER_SPEED * scale) % total;
  let cx = vx - offset;
  while (cx < vx + vw) {
    for (const r of runs) {
      if (cx > vx + vw) break;
      if (cx + r.w > vx) {
        let px = cx;
        if (r.tag) {
          ctx.fillStyle = r.tagBg!;
          ctx.fillRect(px, y + h * 0.14, r.tagW, h * 0.72);
          ctx.fillStyle = r.tagFg!;
          ctx.fillText(r.tag, px + fs * 0.35, y + h / 2 + 1);
          px += r.tagW + fs * 0.5;
        }
        if (r.icon !== undefined) {
          const s = fs * 1.25;
          const img = wxIconImage(r.icon);
          if (img) ctx.drawImage(img, px, y + (h - s) / 2, s, s);
          px += s + fs * 0.35;
        }
        ctx.fillStyle = r.color;
        ctx.fillText(r.text, px, y + h / 2 + 1);
        ctx.fillStyle = "#666";
        ctx.fillText("◆", px + r.textW + fs * 0.8, y + h / 2 + 1);
      }
      cx += r.w;
    }
  }
  ctx.restore();
}

/** Where the map inset was last drawn (CSS px of the tube), so a click on it can fold / unfold it. */
let mapHit: { x: number; y: number; w: number; h: number } | null = null;
export const mapInsetRect = () => mapHit;
if (import.meta.env.DEV) (globalThis as unknown as { __crtMapRect: typeof mapInsetRect }).__crtMapRect = mapInsetRect; // dev / test aid

/** Draws the screen and returns each visible cell's rectangle (by cell index) in canvas pixels. */
/**
 * Draws the screen into `ctx` (which goes through the shader). `over` is an optional flat canvas layered above the
 * YouTube players: OSD belonging to a live YouTube cell is drawn there so the player can't cover it.
 */
export function drawScreen(ctx: CanvasRenderingContext2D, w: number, h: number, v: ScreenView, now: number, over?: CanvasRenderingContext2D): Map<number, CellRect> {
  const rects = new Map<number, CellRect>();
  if (over) over.clearRect(0, 0, w, h);
  // Flat cells (YouTube) draw on the overlay, above the players; everything else goes into the warped picture.
  const flat = new Set(v.flatCells ?? v.videoCells);
  const osdFor = (ci: number) => (over && flat.has(ci) ? over : ctx);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const gap = v.single ? 0 : 3 * v.scale;
  // Same arrangement as the DOM wall, inside the tube's safe area.
  const mx = w * v.inset;
  const band = v.news ? (v.newsH ?? 0) * v.scale : 0;
  const my = h * v.inset;
  // Curved (drawn through the shader) unless a YouTube player — which can't be warped — sits right under it; then the
  // band is left empty and CrtScreen lays a flat ticker over it so the two straight edges line up.
  if (v.news && !v.flatTicker) drawTicker(ctx, v.news, v.lang, mx, my, w - mx * 2, band - 3 * v.scale, v.scale, now);
  const layout = arrange({ w: w - mx * 2, h: h - my * 2 - band, previewW: v.previewW * v.scale, pinned: v.pinned, pinMode: v.pinMode, solo: v.single, gap, count: v.count, aspect: v.aspect, pinAspect: v.pinAspect });
  const indices = v.single ? [v.selected] : v.cells.map((_, i) => i).slice(0, layout.rects.length);

  indices.forEach((ci, slot) => {
    const q = layout.rects[slot];
    const r = { x: q.x + mx, y: q.y + my + band, w: q.w, h: q.h };
    rects.set(ci, r);
    const big = v.single || (v.pinned && ci === 0);
    const highlight = !v.single && ci === v.selected && !big;
    const live = v.videoCells.includes(ci);
    if (over && flat.has(ci) && !live) {
      // Off-air / loading YouTube tile: the whole tile (no-signal screen + OSD) is flat, like the player it replaces.
      ctx.fillStyle = "#000";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      drawCell(over, v.cells[ci], r.x, r.y, r.w, r.h, now, big, false, v.lang, v.scale, highlight, over);
    } else drawCell(ctx, v.cells[ci], r.x, r.y, r.w, r.h, now, big, live, v.lang, v.scale, highlight, osdFor(ci));
    if (highlight) drawSelection(osdFor(ci), r, v.scale);
  });
  // Channel-change static drawn on the canvas (not by the shader):
  // - previews paged under a pinned video (switchedCell -2): every preview, the pinned video untouched;
  // - flat (YouTube) tiles, which sit above the shader on the overlay so its static can't show through them: the
  //   retuned tile, or all of them on a whole-wall change (-1).
  // Dev aid: window.__crtPageSw = true holds the -2 burst on (for inspection).
  const holdPage = import.meta.env.DEV && (globalThis as unknown as { __crtPageSw?: boolean }).__crtPageSw;
  const swSince = holdPage ? 60 : now - v.switchedAt;
  if (swSince < 260) {
    const amt = 0.9 * (1 - swSince / 260);
    const paged = v.switchedCell === -2 || holdPage;
    rects.forEach((r, ci) => {
      const isPinned = v.pinned && ci === 0;
      const hit = paged ? !isPinned : flat.has(ci) && (v.switchedCell === -1 || v.switchedCell === ci);
      if (!hit) return;
      const c = osdFor(ci);
      const pat = c.createPattern(noiseTile(), "repeat")!;
      pat.setTransform(new DOMMatrix().translate((Math.random() * 64) | 0, (Math.random() * 64) | 0)); // move the grain each frame
      c.save();
      c.globalAlpha = amt;
      c.fillStyle = pat;
      c.fillRect(r.x, r.y, r.w, r.h);
      c.restore();
    });
  }

  if (v.pinUi) {
    const r = rects.get(v.pinUi.cell);
    if (r) drawPinUi(osdFor(v.pinUi.cell), r, v.pinUi, v.scale);
  }

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
    text(v.single ? ctx : osdFor(v.selected), `CH ${v.entry.padEnd(4, "-")}`, p.x, p.y, big * 1.2, "#7CFF6B", "right");
  } else if (now - v.switchedAt < 2500) {
    // -2 (previews paged): no channel number — several tiles changed, the pinned one didn't.
    const cellCh = v.switchedCell >= 0 ? CHANNEL_BY_KEY.get(v.cells[v.switchedCell]) : v.switchedCell === -1 ? active : undefined;
    if (cellCh) {
      const p = osdAt(v.switchedCell);
      text(v.single || v.switchedCell < 0 ? ctx : osdFor(v.switchedCell), `CH ${fmtNum(cellCh.num)}`, p.x, p.y, big * 1.2, "#7CFF6B", "right");
    }
  }
  if (now - v.presetAt < 2500) text(ctx, v.presetLabel.toUpperCase(), w / 2, h - my - big * 1.8, big * 0.8, "#7CFF6B", "center");
  if (v.patrol) text(ctx, DICTS[v.lang].seq, mx + big * 0.5, h - my - big * 1.3, big * 0.7, "#7CFF6B");

  // Map inset on the pinned video (solo, or the big slot of a pinned layout): top-left under the channel label —
  // or bottom-right on a YouTube video (flat), where it stays clear of the player's own title / controls at the top.
  const pinnedRect = v.single ? rects.get(v.selected) : v.pinned ? rects.get(0) : undefined;
  const pinnedCh = v.single ? active : v.pinned ? CHANNEL_BY_KEY.get(v.cells[0]) : undefined;
  mapHit = null;
  if (pinnedRect && v.showMap && pinnedCh?.geo) {
    const { x: cellX, y: cellY, w: cellW, h: cellH } = pinnedRect;
    const mw = Math.round(v.mapMini ? Math.min(80 * v.scale, cellW * 0.18) : cellW * 0.18);
    const mh = Math.round(mw * 0.66);
    const fsCap = 18 * v.scale;
    const pinCell = v.single ? v.selected : 0;
    const mc = osdFor(pinCell);
    const onVideo = pinnedCh.kind === "yt"; // same spot through the power-on / page veil too
    mc.save();
    mc.globalAlpha = 0.65;
    // Top-left: channel label's left edge at cellX + pad (pad = 0.45·fs), bottom ≈ top + 1.8·fs.
    // Bottom-right (video): right-aligned with the pin / watch-mode buttons and just above their row (see drawPinUi:
    // the row's top is 34 + BTN_H above the cell's bottom), so it never covers them.
    const k = v.scale;
    const mx0 = onVideo ? cellX + cellW - mw - 8 * k : cellX + fsCap * 0.45;
    const my0 = onVideo ? cellY + cellH - mh - (34 + BTN_H + 6) * k : cellY + fsCap * 2.2;
    drawMap(mc, pinnedCh.geo.lat, pinnedCh.geo.lon, pinnedCh.geo.approx, mx0, my0, mw, mh, now, !v.mapMini);
    mc.restore();
    mapHit = { x: mx0 / v.scale, y: my0 / v.scale, w: mw / v.scale, h: mh / v.scale };
  }
  return rects;
}
