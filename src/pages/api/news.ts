import type { APIRoute } from "astro";
import { iconForText } from "../../lib/wxIcons";
import ROADS from "../../data/road-segments.json";
import TD_CAMERAS from "../../data/td-cameras.json";

export const prerender = false;

// Text feeds for the news ticker, in the viewer's language. Fixed upstream URLs only (no parameters are forwarded),
// so this cannot be used as an open proxy. RTHK sends no CORS headers, hence the relay; the other two are bundled
// here so the ticker makes one request.
//
// - HKO weather warnings in force (JSON)            → kind "warn"
// - HKO current weather + local forecast (JSON)     → kind "weather" (with an HKO icon code)
// - TD special traffic news (XML, not RSS)          → kind "traffic"
// - TD road-segment speeds (irnAvgSpeed XML)         → `jams`: congested stretches (the device picks which to show)
// - RTHK local news (RSS)                           → kind "news"

export interface NewsItem {
  kind: "warn" | "weather" | "traffic" | "jam" | "news";
  /** HKO weather icon code (kind "weather"); see lib/wxIcons. */
  icon?: number;
  text: string;
  /** ISO time, when the source gives one. */
  time?: string;
  link?: string;
}

const SOURCES = {
  en: {
    warn: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en",
    traffic: "https://resource.data.one.gov.hk/td/en/specialtrafficnews.xml",
    news: "https://rthk9.rthk.hk/rthk/news/rss/e_expressnews_elocal.xml",
    warnLink: "https://www.hko.gov.hk/en/wxinfo/dailywx/warning.htm",
    now: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en",
    flw: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en",
    wxLink: "https://www.hko.gov.hk/en/wxinfo/currwx/current.htm",
    fcLink: "https://www.hko.gov.hk/en/wxinfo/currwx/flw.htm",
  },
  zh: {
    warn: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc",
    traffic: "https://resource.data.one.gov.hk/td/tc/specialtrafficnews.xml",
    news: "https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml",
    warnLink: "https://www.hko.gov.hk/tc/wxinfo/dailywx/warning.htm",
    now: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc",
    flw: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=tc",
    wxLink: "https://www.hko.gov.hk/tc/wxinfo/currwx/current.htm",
    fcLink: "https://www.hko.gov.hk/tc/wxinfo/currwx/flw.htm",
  },
} as const;

const UA = { "user-agent": "hk-monitor/0.1 (open data viewer)" };

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};

const isoOrUndef = (s: string) => {
  const d = new Date(s);
  return s && !isNaN(+d) ? d.toISOString() : undefined;
};

/** TD dates look like "2026/11/22 上午 10:04:31" (上午 = AM, 下午 = PM), Hong Kong time. */
function tdDate(s: string): string | undefined {
  const m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s*(上午|下午|AM|PM)?\s*(\d{1,2}):(\d{2}):(\d{2})/i);
  if (!m) return undefined;
  let hour = +m[5];
  const pm = m[4] === "下午" || m[4]?.toUpperCase() === "PM";
  const am = m[4] === "上午" || m[4]?.toUpperCase() === "AM";
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  const pad = (n: number | string) => String(n).padStart(2, "0");
  return isoOrUndef(`${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(hour)}:${m[6]}:${m[7]}+08:00`);
}

async function warnings(lang: "en" | "zh"): Promise<NewsItem[]> {
  const json = JSON.parse(await get(SOURCES[lang].warn)) as Record<string, { name?: string; type?: string; actionCode?: string; updateTime?: string; issueTime?: string }>;
  return Object.values(json)
    .filter((w) => w && w.name && w.actionCode !== "CANCEL")
    .map((w) => ({
      kind: "warn" as const,
      text: w.type ? `${w.name} (${w.type})` : w.name!,
      time: isoOrUndef(w.updateTime ?? w.issueTime ?? ""),
      link: SOURCES[lang].warnLink,
    }));
}

/** Readings per place, for the viewer's device to pick the nearest (location never comes here). */
export interface WeatherPlaces {
  /** HKO's current weather icon. */
  icon?: number;
  /** Temperature at each station (°C), names in the viewer's language. */
  temps: { place: string; value: number }[];
  /** Maximum rainfall in the past hour per district (mm). */
  rain: { place: string; mm: number }[];
  time?: string;
}

const places: Record<"en" | "zh", WeatherPlaces | undefined> = { en: undefined, zh: undefined };

/** A congested stretch: one road in one area (segments of the same road within ~2 km), slowest first. */
export interface Jam {
  en: string;
  zh: string;
  /** Length-weighted average speed of the congested segments (km/h). */
  kmh: number;
  /** Their total length (km). */
  km: number;
  lat: number;
  lon: number;
}

const IRN = "https://resource.data.one.gov.hk/td/traffic-detectors/irnAvgSpeed-all.xml";
/** Below this a segment counts as congested (TD's speed map shows red below about 20 km/h on most roads). */
const JAM_KMH = 20;
const roads = ROADS as unknown as Record<string, [string, string, number, number, number]>;

/** Road speed at a traffic camera: the nearest speed segment within CAM_ROAD_M of it. */
export type CamRoad = [en: string, zh: string, kmh: number];
const CAM_ROAD_M = 180;
let camSegCache: Map<string, string> | null = null;
/** Each TD camera's speed segment, worked out once per server instance: the nearest segment of the road the camera is
 * named after (within NAMED_ROAD_M), else the nearest segment of any road (within CAM_ROAD_M). By segment midpoint. */
const NAMED_ROAD_M = 400;
function camSegments(): Map<string, string> {
  if (camSegCache) return camSegCache;
  const m = new Map<string, string>();
  const segs = Object.entries(roads);
  for (const c of TD_CAMERAS as { id: string; name: string; lat: number; lon: number }[]) {
    const camName = c.name.toLowerCase();
    let named = "";
    let namedD = NAMED_ROAD_M;
    let any = "";
    let anyD = CAM_ROAD_M;
    const kx = 111_320 * Math.cos((c.lat * Math.PI) / 180);
    for (const [id, r] of segs) {
      const dy = (r[3] - c.lat) * 110_540;
      if (Math.abs(dy) > NAMED_ROAD_M) continue;
      const d = Math.hypot(dy, (r[4] - c.lon) * kx);
      if (d < namedD && camName.includes(r[0].toLowerCase())) {
        namedD = d;
        named = id;
      }
      if (d < anyD) {
        anyD = d;
        any = id;
      }
    }
    if (named || any) m.set(c.id, named || any);
  }
  return (camSegCache = m);
}

async function congestion(): Promise<{ jams: Jam[]; cams: Record<string, CamRoad> }> {
  const xml = await get(IRN);
  const speedOf = new Map<string, number>();
  const groups = new Map<string, { en: string; zh: string; len: number; speedLen: number; lat: number; lon: number }>();
  for (const [, id, speed, valid] of xml.matchAll(/<segment_id>(\d+)<\/segment_id><speed>([\d.]+)<\/speed><valid>(\w)<\/valid>/g)) {
    const v = Number(speed);
    if (valid === "Y") speedOf.set(id, v);
    const r = roads[id];
    if (valid !== "Y" || !r || !(v < JAM_KMH)) continue;
    const [en, zh, len, lat, lon] = r;
    // Same road, same ~2 km cell: one stretch (a long road jammed in two places reads as two items).
    const key = `${en}|${Math.round(lat / 0.02)}|${Math.round(lon / 0.02)}`;
    const g = groups.get(key) ?? { en, zh, len: 0, speedLen: 0, lat: 0, lon: 0 };
    g.len += len;
    g.speedLen += v * len;
    g.lat += lat * len;
    g.lon += lon * len;
    groups.set(key, g);
  }
  const cams: Record<string, CamRoad> = {};
  for (const [cam, seg] of camSegments()) {
    const v = speedOf.get(seg);
    if (v !== undefined) cams[cam] = [roads[seg][0], roads[seg][1], Math.round(v)];
  }
  const jams = [...groups.values()]
    .filter((g) => g.len >= 250)
    .map((g) => ({ en: g.en, zh: g.zh, kmh: Math.round(g.speedLen / g.len), km: Math.round(g.len / 100) / 10, lat: +(g.lat / g.len).toFixed(5), lon: +(g.lon / g.len).toFixed(5) }))
    // Worst first: long and slow.
    .sort((a, b) => b.km * (JAM_KMH + 2 - b.kmh) - a.km * (JAM_KMH + 2 - a.kmh))
    .slice(0, 40);
  return { jams, cams };
}

interface Rhrread {
  icon?: number[];
  updateTime?: string;
  temperature?: { data?: { place: string; value: number }[] };
  humidity?: { data?: { place: string; value: number }[] };
  uvindex?: { data?: { value: number; desc: string }[] } | "";
  tcmessage?: string | string[];
  rainfall?: { data?: { place: string; max?: number }[] };
}
interface Flw { forecastDesc?: string; outlook?: string; tcInfo?: string; updateTime?: string }

/** Current weather at the Observatory (with HKO's icon), the local forecast and the outlook. */
async function weather(lang: "en" | "zh"): Promise<NewsItem[]> {
  const zh = lang === "zh";
  const [nowRes, flwRes] = await Promise.allSettled([get(SOURCES[lang].now), get(SOURCES[lang].flw)]);
  const out: NewsItem[] = [];
  if (nowRes.status === "fulfilled") {
    const d = JSON.parse(nowRes.value) as Rhrread;
    places[lang] = {
      icon: d.icon?.[0],
      temps: (d.temperature?.data ?? []).filter((x) => typeof x.value === "number").map((x) => ({ place: x.place, value: x.value })),
      rain: (d.rainfall?.data ?? []).map((x) => ({ place: x.place, mm: Number(x.max) || 0 })),
      time: isoOrUndef(d.updateTime ?? ""),
    };
    const at = (list?: { place: string; value: number }[]) => (list?.find((x) => /Observatory|天文台/.test(x.place)) ?? list?.[0])?.value;
    const temp = at(d.temperature?.data);
    const rh = at(d.humidity?.data);
    const uv = d.uvindex && d.uvindex.data?.[0];
    const parts = zh
      ? [temp !== undefined && `氣溫 ${temp}°C`, rh !== undefined && `相對濕度 ${rh}%`, uv && `紫外線指數 ${uv.value}（${uv.desc}）`]
      : [temp !== undefined && `${temp}°C`, rh !== undefined && `humidity ${rh}%`, uv && `UV index ${uv.value} (${uv.desc})`];
    const text = parts.filter(Boolean).join(zh ? "，" : ", ");
    if (text)
      out.push({ kind: "weather", icon: d.icon?.[0] ?? 60, text: zh ? `香港天文台現時${text}` : `Hong Kong Observatory now: ${text}`, time: isoOrUndef(d.updateTime ?? ""), link: SOURCES[lang].wxLink });
    const tc = Array.isArray(d.tcmessage) ? d.tcmessage.join(" ") : d.tcmessage;
    if (tc) out.push({ kind: "weather", icon: 80, text: tc, link: SOURCES[lang].warnLink });
  }
  if (flwRes.status === "fulfilled") {
    const f = JSON.parse(flwRes.value) as Flw;
    const time = isoOrUndef(f.updateTime ?? "");
    if (f.tcInfo) out.push({ kind: "weather", icon: 80, text: f.tcInfo, time, link: SOURCES[lang].fcLink });
    if (f.forecastDesc) out.push({ kind: "weather", icon: iconForText(f.forecastDesc), text: (zh ? "天氣預測：" : "Forecast: ") + f.forecastDesc, time, link: SOURCES[lang].fcLink });
    if (f.outlook) out.push({ kind: "weather", icon: iconForText(f.outlook), text: (zh ? "展望：" : "Outlook: ") + f.outlook, link: SOURCES[lang].fcLink });
  }
  if (!out.length) throw new Error("no weather");
  return out;
}

async function traffic(lang: "en" | "zh"): Promise<NewsItem[]> {
  const xml = await get(SOURCES[lang].traffic);
  const short = lang === "zh" ? "ChinShort" : "EngShort";
  const long = lang === "zh" ? "ChinText" : "EngText";
  return [...xml.matchAll(/<message>([\s\S]*?)<\/message>/g)]
    .map(([, m]) => ({ kind: "traffic" as const, text: tag(m, short) || tag(m, long), time: tdDate(tag(m, "ReferenceDate")) }))
    .filter((i) => i.text);
}

async function news(lang: "en" | "zh"): Promise<NewsItem[]> {
  const xml = await get(SOURCES[lang].news);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, m]) => ({ kind: "news" as const, text: tag(m, "title"), link: tag(m, "link") || undefined, time: isoOrUndef(tag(m, "pubDate")) }))
    .filter((i) => i.text)
    .slice(0, 15);
}

// Small in-process cache on top of the CDN cache, so a busy instance doesn't hammer the publishers.
const cache = new Map<string, { at: number; body: string }>();

export const GET: APIRoute = async ({ url }) => {
  const lang = url.searchParams.get("lang") === "zh" ? "zh" : "en";
  const hit = cache.get(lang);
  if (hit && Date.now() - hit.at < 60_000) return json(hit.body);
  // Each source fails on its own: one publisher being down doesn't blank the ticker.
  const [roadsNow, ...parts] = await Promise.allSettled([congestion(), warnings(lang), weather(lang), traffic(lang), news(lang)]);
  const items = parts.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
  const failed = parts.filter((p) => p.status === "rejected").length;
  const body = JSON.stringify({ items, places: places[lang] ?? null, jams: roadsNow.status === "fulfilled" ? roadsNow.value.jams : [], camRoads: roadsNow.status === "fulfilled" ? roadsNow.value.cams : {}, failed, at: new Date().toISOString() });
  if (failed < parts.length) cache.set(lang, { at: Date.now(), body });
  return json(body);
};

const json = (body: string) =>
  new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
    },
  });
