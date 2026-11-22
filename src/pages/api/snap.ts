import type { APIRoute } from "astro";
import { HKO_STATIONS } from "../../data/hko-stations";

export const prerender = false;

// Same-origin relay for HKO weather photos, radar and satellite images, which are served without CORS headers.
// Only known station / image codes are accepted, so this cannot be used as an open proxy.
const CODES = new Set(HKO_STATIONS.map((s) => s.code));
// Radar / satellite images are named by their time: find the newest one that exists (HKO publishes a few minutes late).
const RADAR: Record<string, string> = { RAD064: "064", RAD128: "128", RAD256: "256" };
const found = new Map<string, { url: string; at: number }>();
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;

async function latestData(code: string): Promise<string | null> {
  const hit = found.get(code);
  if (hit && Date.now() - hit.at < 60_000) return hit.url;
  const candidates: string[] = [];
  const hkt = new Date(Date.now() + 8 * 3600_000); // HKT wall clock in UTC fields
  if (RADAR[code]) {
    const r = RADAR[code];
    const t = new Date(hkt);
    t.setUTCSeconds(0, 0);
    t.setUTCMinutes(t.getUTCMinutes() - (t.getUTCMinutes() % 6));
    for (let k = 0; k < 8; k++) {
      const s = new Date(t.getTime() - k * 6 * 60_000);
      candidates.push(`https://www.hko.gov.hk/wxinfo/radars/rad_${r}_png/2d${r}nradar_${stamp(s)}.jpg`);
    }
  } else if (code === "SATASIA") {
    const u = new Date();
    u.setUTCMinutes(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const uu = new Date(u.getTime() - k * 3600_000);
      const hh = new Date(uu.getTime() + 8 * 3600_000);
      const ddhhmm = `${pad(uu.getUTCDate())}${pad(uu.getUTCHours())}${pad(uu.getUTCMinutes())}`;
      candidates.push(`https://www.hko.gov.hk/wxinfo/intersat/satellite/image/asia/${stamp(hh)}+${ddhhmm}GLB__global_150_internet.jpg`);
    }
  } else return null;
  for (const url of candidates) {
    const res = await fetch(url, { method: "HEAD", headers: { "user-agent": "cctv-hk/0.1 (open data viewer)" } }).catch(() => null);
    if (res?.ok) {
      found.set(code, { url, at: Date.now() });
      return url;
    }
  }
  return null;
}

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get("hko") ?? "";
  const data = code in RADAR || code === "SATASIA";
  if (!CODES.has(code) && !data) return new Response("unknown station", { status: 400 });
  const hd = url.searchParams.get("hd") === "1";
  const upstream = data ? await latestData(code) : `https://www.hko.gov.hk/wxinfo/aws/hko_mica/${code.toLowerCase()}/latest_${hd ? "HD_" : ""}${code}.jpg`;
  if (!upstream) return new Response("no recent image", { status: 502 });

  const res = await fetch(upstream, { headers: { "user-agent": "cctv-hk/0.1 (open data viewer)" } });
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
    return new Response("upstream unavailable", { status: 502 });
  }
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type")!,
      "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
      "access-control-allow-origin": "*",
      "last-modified": res.headers.get("last-modified") ?? new Date().toUTCString(),
    },
  });
};
