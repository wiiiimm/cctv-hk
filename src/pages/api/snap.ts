import type { APIRoute } from "astro";
import { HKO_STATIONS } from "../../data/hko-stations";

export const prerender = false;

// Same-origin relay for HKO weather photos, which are served without CORS headers.
// Only known station codes are accepted, so this cannot be used as an open proxy.
const CODES = new Set(HKO_STATIONS.map((s) => s.code));

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get("hko") ?? "";
  if (!CODES.has(code)) return new Response("unknown station", { status: 400 });
  const hd = url.searchParams.get("hd") === "1";
  const upstream = `https://www.hko.gov.hk/wxinfo/aws/hko_mica/${code.toLowerCase()}/latest_${hd ? "HD_" : ""}${code}.jpg`;

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
