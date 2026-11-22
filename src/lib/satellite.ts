// JMA Himawari-9 imagery (https://www.jma.go.jp/bosai/himawari/): web-mercator map tiles for every 10-minute scan,
// CORS open. A satellite channel is a block of tiles, stitched here into one 16:9 picture (cropped top and bottom).
// Credit: Japan Meteorological Agency (shown as the channel's publisher).
import type { JmaTiles } from "../data/live-data";

const BASE = "https://www.jma.go.jp/bosai/himawari/data/satimg";
const TILE = 256;

let times: { at: number; base: string } | null = null;
/** Newest full-disk scan time ("YYYYMMDDhhmmss", UTC), cached for a minute. */
async function latestTime(): Promise<string> {
  if (times && Date.now() - times.at < 60_000) return times.base;
  const list = (await (await fetch(`${BASE}/targetTimes_fd.json`)).json()) as { basetime: string; validtime: string }[];
  const last = list[list.length - 1];
  if (!last) throw new Error("no Himawari times");
  times = { at: Date.now(), base: last.basetime };
  return last.basetime;
}

const utc = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));

/** The stitched picture and its scan time. */
export async function jmaPicture(spec: JmaTiles): Promise<{ blob: Blob; takenAt: number }> {
  const t = await latestTime();
  const w = spec.nx * TILE;
  const full = spec.ny * TILE;
  const h = Math.min(full, Math.round((w * 9) / 16));
  const top = Math.round((full - h) / 2);
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const jobs: Promise<void>[] = [];
  for (let j = 0; j < spec.ny; j++)
    for (let i = 0; i < spec.nx; i++)
      jobs.push(
        (async () => {
          const res = await fetch(`${BASE}/${t}/fd/${t}/${spec.band}/${spec.z}/${spec.x + i}/${spec.y + j}.jpg`);
          if (!res.ok) throw new Error(`tile ${res.status}`);
          const bmp = await createImageBitmap(await res.blob());
          ctx.drawImage(bmp, i * TILE, j * TILE - top);
          bmp.close();
        })(),
      );
  await Promise.all(jobs);
  const blob = canvas instanceof HTMLCanvasElement ? await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), "image/jpeg", 0.9)) : await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  return { blob, takenAt: utc(t) };
}
