// Weather icons for the news ticker, keyed by HKO's icon codes (https://www.hko.gov.hk/textonly/v2/explain/wxicon_e.htm):
// 50–54 sunny → sunny intervals with showers, 60–65 cloudy → thunderstorms, 70–77 night, 80–85 wind / dry / humid /
// fog / mist / haze, 90–93 hot / warm / cool / cold. Drawn as small colour SVGs (32×32) so the same picture serves the
// DOM ticker (inline) and the CRT compositor (as an image drawn into the canvas — no tainting, it's a data URL).

const SUN = "#ffc93c";
const SUN_RAY = "#ffb000";
const CLOUD = "#eef2f7";
const CLOUD_EDGE = "#9aa6b6";
const DARK = "#8d97a6";
const DARK_EDGE = "#5d6675";
const RAIN = "#4fb3ff";
const BOLT = "#ffd400";
const MOON = "#f4e7a8";
const MIST = "#b9c3cf";

const sun = (cx: number, cy: number, r: number) => {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const p = (d: number) => `${(cx + Math.cos(a) * d).toFixed(1)} ${(cy + Math.sin(a) * d).toFixed(1)}`;
    return `M${p(r + 2.2)}L${p(r + 4.6)}`;
  }).join("");
  return `<path d="${rays}" stroke="${SUN_RAY}" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${SUN}"/>`;
};

/** A cloud ~22×13, its top-left at (x, y), scaled by s. */
const cloud = (x: number, y: number, s = 1, dark = false) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M5.5 13h12.5a4.5 4.5 0 0 0 .4-9A6.5 6.5 0 0 0 6 4.6 4.2 4.2 0 0 0 5.5 13z" fill="${dark ? DARK : CLOUD}" stroke="${dark ? DARK_EDGE : CLOUD_EDGE}" stroke-width="${(1.1 / s).toFixed(2)}" stroke-linejoin="round"/>`;

const drops = (n: number, y = 23) =>
  Array.from({ length: n }, (_, i) => {
    const x = 16 - (n - 1) * 2.6 + i * 5.2;
    return `<path d="M${x + 1.2} ${y}l-2 5" stroke="${RAIN}" stroke-width="2.2" stroke-linecap="round"/>`;
  }).join("");

const bolt = `<path d="M17.5 19.5l-4.5 6.5h3.6l-2.2 5.2 6.4-7.6h-3.8l2.4-4.1z" fill="${BOLT}" stroke="#b88a00" stroke-width=".6" stroke-linejoin="round"/>`;
const moon = (cx = 16, cy = 15, r = 9) =>
  `<path d="M${cx + r * 0.35} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.65} ${r * 1.55}A${r * 0.78} ${r * 0.78} 0 0 1 ${cx + r * 0.35} ${cy - r}z" fill="${MOON}"/>`;
const lines = (ys: number[], color = MIST, x0 = 5, x1 = 27) =>
  ys.map((y, i) => `<path d="M${x0 + (i % 2) * 3} ${y}H${x1 - ((i + 1) % 2) * 3}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`).join("");
const wind = `<path d="M4 12h15a3.5 3.5 0 1 0-3.5-3.5M4 17h21a3.5 3.5 0 1 1-3.5 3.5M4 22h11" fill="none" stroke="#cfe3f5" stroke-width="2.2" stroke-linecap="round"/>`;
const thermo = (fill: string, level: number) =>
  `<rect x="13" y="4" width="6" height="18" rx="3" fill="#1b1f26" stroke="#c9d1dc" stroke-width="1.4"/><circle cx="16" cy="24" r="5" fill="${fill}" stroke="#c9d1dc" stroke-width="1.4"/><rect x="14.6" y="${22 - level}" width="2.8" height="${level + 2}" rx="1.4" fill="${fill}"/>`;
const drop = (fill: string, slash = false) =>
  `<path d="M16 4c4.5 6 7.5 10 7.5 14a7.5 7.5 0 0 1-15 0c0-4 3-8 7.5-14z" fill="${fill}" stroke="#2a7fc2" stroke-width="1.2"/>` +
  (slash ? `<path d="M7 27L25 8" stroke="#ff6b5a" stroke-width="2.2" stroke-linecap="round"/>` : "");

function body(code: number): string {
  switch (code) {
    case 50: return sun(16, 16, 7);
    case 51: return sun(12, 12, 6) + cloud(10, 15, 0.85);
    case 52: return sun(19, 10, 6) + cloud(3, 12, 1.15);
    case 53: return sun(11, 9, 5.5) + cloud(8, 10, 0.9) + drops(2, 24);
    case 54: return sun(20, 8, 5) + cloud(3, 8, 1.1) + drops(3, 24);
    case 60: return cloud(3, 7, 1.2);
    case 61: return cloud(9, 4, 0.85, true) + cloud(2, 11, 1.1, true);
    case 62: return cloud(3, 4, 1.2) + drops(2);
    case 63: return cloud(3, 4, 1.2) + drops(3);
    case 64: return cloud(3, 4, 1.2, true) + drops(3) + `<path d="M8 27l-1.5 3.5M25 27l-1.5 3.5" stroke="${RAIN}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 65: return cloud(3, 3, 1.2, true) + bolt + `<path d="M10 23l-2 5M24 23l-2 5" stroke="${RAIN}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 76: return moon(13, 11, 7) + cloud(8, 14, 0.95);
    case 77: return moon(16, 15, 9) + `<circle cx="7" cy="7" r="1.1" fill="${MOON}"/><circle cx="26" cy="23" r=".9" fill="${MOON}"/>`;
    case 80: return wind;
    case 81: return drop("#e8d8b0", true);
    case 82: return drop("#7cc4ff");
    case 83: return cloud(3, 2, 1.1) + lines([20, 24, 28]);
    case 84: return lines([9, 14, 19, 24]);
    case 85: return sun(16, 11, 6) + lines([21, 25, 29], "#c9b38a");
    case 90: return thermo("#ff4b3a", 14);
    case 91: return thermo("#ff9a2e", 10);
    case 92: return thermo("#5ec8ff", 6);
    case 93: return thermo("#3a7bff", 2);
    default:
      if (code >= 70 && code <= 75) return moon(); // moon phases → fine night
      return cloud(3, 7, 1.2);
  }
}

export function wxIconSvg(code: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">${body(code)}</svg>`;
}

const images = new Map<number, HTMLImageElement>();
/** The icon as an image for canvas drawing; null until it has decoded (callers redraw every frame anyway). */
export function wxIconImage(code: number): HTMLImageElement | null {
  let img = images.get(code);
  if (!img) {
    img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(wxIconSvg(code));
    images.set(code, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/** Best-guess icon for a forecast sentence (HKO's text forecasts carry no icon code). */
export function iconForText(text: string): number {
  const s = text.toLowerCase();
  if (/thunder|雷暴/.test(s)) return 65;
  if (/heavy rain|大雨/.test(s)) return 64;
  if (/sunny (periods|intervals).*(shower|rain)|陽光.*(驟雨|雨)/.test(s)) return 54;
  if (/light rain|rain patches|微雨/.test(s)) return 62;
  if (/shower|rain|雨/.test(s)) return 63;
  if (/fog|霧/.test(s)) return 83;
  if (/sunny periods|sunny intervals|短暫時間有陽光|部分時間有陽光/.test(s)) return 51;
  if (/fine|sunny|天晴|陽光充沛/.test(s)) return 50;
  if (/overcast|密雲/.test(s)) return 61;
  if (/cloudy|多雲|大致多雲/.test(s)) return 60;
  if (/hazy|煙霞/.test(s)) return 85;
  if (/windy|strong wind|大風|風勢頗大/.test(s)) return 80;
  return 60;
}
