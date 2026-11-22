import type { APIRoute } from "astro";

export const prerender = false;

// Text feeds for the news ticker, in the viewer's language. Fixed upstream URLs only (no parameters are forwarded),
// so this cannot be used as an open proxy. RTHK sends no CORS headers, hence the relay; the other two are bundled
// here so the ticker makes one request.
//
// - HKO weather warnings in force (JSON)            → kind "warn"
// - TD special traffic news (XML, not RSS)          → kind "traffic"
// - RTHK local news (RSS)                           → kind "news"

export interface NewsItem {
  kind: "warn" | "traffic" | "news";
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
  },
  zh: {
    warn: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc",
    traffic: "https://resource.data.one.gov.hk/td/tc/specialtrafficnews.xml",
    news: "https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml",
    warnLink: "https://www.hko.gov.hk/tc/wxinfo/dailywx/warning.htm",
  },
} as const;

const UA = { "user-agent": "cctv-hk/0.1 (open data viewer)" };

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
  const parts = await Promise.allSettled([warnings(lang), traffic(lang), news(lang)]);
  const items = parts.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
  const failed = parts.filter((p) => p.status === "rejected").length;
  const body = JSON.stringify({ items, failed, at: new Date().toISOString() });
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
