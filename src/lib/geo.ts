// "Near me": the viewer's location (asked for only when they choose the Near me group, or silently when the browser
// already granted it). Kept in memory only — never persisted, never put in the URL or sent anywhere; the nearest
// cameras and weather station are worked out on this device.
import { CHANNELS } from "./channels";

export interface Here {
  lat: number;
  lon: number;
  /** Accuracy radius in metres. */
  acc: number;
  at: number;
}

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export const fmtDistance = (m: number) => (m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : m < 9500 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 1000)} km`);

/** How many channels the Near me group holds: nearest first, feeds with an exact position before approximate ones nearby. */
export const NEARBY_MAX = 60;

let cacheFor = "";
let cacheKeys: string[] = [];
/** Channels nearest to `here` (exact positions only within the first few km, so a "Hong Kong" placeholder for a whole
 * broadcaster doesn't outrank the camera across the street). */
export function nearbyKeys(here: Here): string[] {
  const id = `${here.lat.toFixed(4)},${here.lon.toFixed(4)}`;
  if (id === cacheFor) return cacheKeys;
  const ranked = CHANNELS.filter((c) => c.geo)
    .map((c) => ({ key: c.key, d: distanceM(here, c.geo!) + (c.geo!.approx ? 3000 : 0) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, NEARBY_MAX)
    .map((x) => x.key);
  cacheFor = id;
  cacheKeys = ranked;
  return ranked;
}

export type LocateResult = "ok" | "denied" | "unavailable";

/** Ask the browser for the current position (prompts the first time). */
export function getPosition(): Promise<{ ok: true; here: Here } | { ok: false; why: LocateResult }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ ok: false, why: "unavailable" });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, here: { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() } }),
      (e) => resolve({ ok: false, why: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 15_000 },
    );
  });
}

/** True when the browser already allows location for this site (so asking won't show a prompt). */
export async function locationGranted(): Promise<boolean> {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state === "granted";
  } catch {
    return false;
  }
}
