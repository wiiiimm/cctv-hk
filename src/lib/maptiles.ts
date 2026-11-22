// Slippy-map tile math and a small tile image cache (OpenStreetMap standard tiles, darkened client-side).
export const TILE = 256;
export const ATTRIBUTION = "© OpenStreetMap contributors";
/** Turns the light OSM style into a dark control-room map. */
export const DARKEN = "invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.5)";

export function project(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  };
}

/** Inverse of `project`: world tile coordinates at zoom z → lat/lon. */
export function unproject(x: number, y: number, z: number) {
  const n = 2 ** z;
  return { lon: (x / n) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI };
}

export function tileUrl(z: number, x: number, y: number) {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export interface PlacedTile {
  key: string;
  url: string;
  left: number;
  top: number;
}

/** Tiles needed to cover a w×h viewport centred on lat/lon. */
export function tilesFor(lat: number, lon: number, z: number, w: number, h: number): PlacedTile[] {
  const c = project(lat, lon, z);
  const px = c.x * TILE - w / 2;
  const py = c.y * TILE - h / 2;
  const x0 = Math.floor(px / TILE);
  const y0 = Math.floor(py / TILE);
  const x1 = Math.floor((px + w) / TILE);
  const y1 = Math.floor((py + h) / TILE);
  const n = 2 ** z;
  const out: PlacedTile[] = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      const wx = ((x % n) + n) % n;
      out.push({ key: `${z}/${wx}/${y}`, url: tileUrl(z, wx, y), left: x * TILE - px, top: y * TILE - py });
    }
  return out;
}

// Decoded tiles for the canvas compositor (OSM serves CORS headers, so the canvas stays clean).
const cache = new Map<string, HTMLImageElement>();
export function tileImage(url: string): HTMLImageElement | null {
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    cache.set(url, img);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// ---- Animated map views (sidebar mini-map and the CRT map inset share this) ----

/** A map view: centre in normalised world coordinates (0..1) and a fractional zoom. */
export interface MapView {
  x: number;
  y: number;
  z: number;
}

export function viewOf(lat: number, lon: number, z: number): MapView {
  const c = project(lat, lon, 0);
  return { x: c.x, y: c.y, z };
}

export const FLIGHT_MS = 900;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * View at progress t (0..1) of a flight from `a` to `b` in a viewport `w` px wide. Short hops pan; longer ones
 * zoom out far enough to keep both points in view, pan, then zoom back in.
 */
export function flyView(a: MapView, b: MapView, t: number, w: number): MapView {
  const e = ease(Math.min(1, Math.max(0, t)));
  const zEnd = Math.min(a.z, b.z);
  const dist = Math.hypot(b.x - a.x, b.y - a.y) * 2 ** zEnd * TILE; // px at the lower of the two zooms
  const zMid = dist > w * 0.6 ? Math.max(9, zEnd - Math.log2(dist / (w * 0.6))) : (a.z + b.z) / 2;
  const dip = Math.max(0, (a.z + b.z) / 2 - zMid);
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
    z: a.z + (b.z - a.z) * e - dip * 4 * e * (1 - e),
  };
}

export interface ViewTile {
  key: string;
  url: string;
  left: number;
  top: number;
  size: number;
}

/** Tiles (positioned and sized in viewport px) covering a w×h viewport at a fractional-zoom view. */
export function tilesForView(v: MapView, w: number, h: number): ViewTile[] {
  const zi = Math.max(0, Math.min(19, Math.floor(v.z)));
  const s = 2 ** (v.z - zi);
  const n = 2 ** zi;
  const px = v.x * n * TILE - w / s / 2;
  const py = v.y * n * TILE - h / s / 2;
  const out: ViewTile[] = [];
  for (let x = Math.floor(px / TILE); x <= Math.floor((px + w / s) / TILE); x++)
    for (let y = Math.floor(py / TILE); y <= Math.floor((py + h / s) / TILE); y++) {
      if (y < 0 || y >= n) continue;
      const wx = ((x % n) + n) % n;
      out.push({ key: `${zi}/${wx}/${y}`, url: tileUrl(zi, wx, y), left: (x * TILE - px) * s, top: (y * TILE - py) * s, size: TILE * s });
    }
  return out;
}

/** Where world point `p` sits in a w×h viewport showing view `v`. */
export function pointIn(v: MapView, p: { x: number; y: number }, w: number, h: number) {
  const k = 2 ** v.z * TILE;
  return { x: w / 2 + (p.x - v.x) * k, y: h / 2 + (p.y - v.y) * k };
}

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
