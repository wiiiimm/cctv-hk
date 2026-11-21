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
