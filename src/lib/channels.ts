import tdCameras from "../data/td-cameras.json";
import { HKO_STATIONS } from "../data/hko-stations";
import { DATA_FEEDS, type JmaTiles } from "../data/live-data";
import { LIVE_STREAMS, NEWS_STREAMS, RECORDING_SOURCES, SPACE_STREAMS, WORLD_STREAMS } from "../data/streams";

export type FeedKind = "td" | "hko" | "yt";

export interface Channel {
  /** Stable key, e.g. "td:H429F", "hko:HKO". */
  key: string;
  /** Channel number shown on the OSD, unique across all feeds. */
  num: number;
  kind: FeedKind;
  code: string;
  name: string;
  nameZh: string;
  region: string;
  regionZh: string;
  district: string;
  districtZh: string;
  geo?: { lat: number; lon: number; approx: boolean };
  /** YouTube channel id to follow (its current live video is resolved at runtime); `code` is then a placeholder. */
  follow?: string;
  /** Recording slot: play the followed channel's Nth (0-based) most recent recording rather than its live stream. */
  recIndex?: number;
  /** Owner blocks playback on other sites: show the still + "YouTube ↗", never a player. */
  noEmbed?: boolean;
  /** Direct image URL overriding the kind's usual one ({lang} → tc / en), e.g. TD speed-map panels. */
  src?: string;
  /** JMA Himawari tiles to stitch (satellite feeds). */
  jma?: JmaTiles;
  /** How often the source publishes a new picture. */
  refreshMs: number;
}

export interface ChannelGroup {
  id: string;
  label: string;
  labelZh: string;
  /** Where it is listed in the group picker. */
  section: "type" | "topic" | "news" | "youtube" | "region" | "district" | "custom";
  keys: string[];
}

const REGION_ORDER = ["Hong Kong Island", "Kowloon", "New Territories"];

function build(): Channel[] {
  const out: Channel[] = [];
  // Bank 1xx: HK live video. 2xx: HKO weather. 3xx: world live video. 4xx: news & finance. 5xx: space. 1000+: traffic.
  // Bank 6xx: recorded-news slots (see RECORDING_SOURCES).
  for (const r of RECORDING_SOURCES) {
    if (r.live)
      out.push({
        key: `yt:rec-${r.slug}-live`,
        num: r.base,
        kind: "yt",
        code: `rec-${r.slug}-live`,
        follow: r.follow, // a followed channel: live when on air, else its latest videos
        name: `${r.name} live`,
        nameZh: `${r.nameZh} 直播`,
        region: r.group ? r.group.label : r.film ? "Movies" : r.crime ? "Crime & mystery" : r.tech ? "Tech" : r.entertainment ? "Entertainment" : "Recorded",
        regionZh: r.group ? r.group.labelZh : r.film ? "電影" : r.crime ? "罪案及懸疑" : r.tech ? "科技" : r.entertainment ? "娛樂" : "重溫",
        district: r.name,
        districtZh: r.nameZh,
        refreshMs: 0,
      });
    for (let k = 0; k < r.slots; k++)
      out.push({
        key: `yt:rec-${r.slug}-${k + 1}`,
        num: r.base + (r.live ? 1 : 0) + k,
        kind: "yt",
        code: `rec-${r.slug}-${k + 1}`,
        follow: r.follow,
        recIndex: k,
        noEmbed: r.noEmbed,
        // News: "RTHK News recording 3 / 香港電台新聞 重溫 3"; a channel group: "Mill MILK video 3 / Mill MILK 影片 3".
        name: r.group || r.tech || r.entertainment || r.crime || r.film ? `${r.name} ${k + 1}` : `${r.name} recording ${k + 1}`,
        nameZh: r.group || r.tech || r.entertainment || r.crime || r.film ? `${r.nameZh} ${k + 1}` : `${r.nameZh} 重溫 ${k + 1}`,
        // News recordings share the "Recorded" region (their group); a source with its own group uses its name.
        region: r.group ? r.group.label : r.film ? "Movies" : r.crime ? "Crime & mystery" : r.tech ? "Tech" : r.entertainment ? "Entertainment" : "Recorded",
        regionZh: r.group ? r.group.labelZh : r.film ? "電影" : r.crime ? "罪案及懸疑" : r.tech ? "科技" : r.entertainment ? "娛樂" : "重溫",
        district: r.name,
        districtZh: r.nameZh,
        geo: r.lat != null && r.lon != null ? { lat: r.lat, lon: r.lon, approx: true } : undefined,
        refreshMs: 0,
      });
  }
  SPACE_STREAMS.forEach((s) =>
    out.push({
      key: `yt:${s.id}`,
      num: s.num,
      kind: "yt",
      code: s.id,
      name: s.name,
      nameZh: s.nameZh,
      region: "Space",
      regionZh: "太空",
      district: s.place,
      districtZh: s.placeZh,
      geo: s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon, approx: true } : undefined,
      refreshMs: 0,
    }),
  );
  NEWS_STREAMS.forEach((s) =>
    out.push({
      key: `yt:${s.id}`,
      num: s.num,
      kind: "yt",
      code: s.id,
      follow: s.follow,
      noEmbed: s.noEmbed,
      name: s.name,
      nameZh: s.nameZh,
      region: s.racing ? "Racing" : "News",
      regionZh: s.racing ? "賽馬" : "新聞",
      district: s.country,
      districtZh: s.countryZh,
      geo: s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon, approx: true } : undefined,
      refreshMs: 0,
    }),
  );
  LIVE_STREAMS.forEach((s) =>
    out.push({
      key: `yt:${s.id}`,
      num: s.num,
      kind: "yt",
      code: s.id,
      follow: s.follow,
      name: s.name,
      nameZh: s.nameZh,
      region: "Live video",
      regionZh: "直播影像",
      district: s.channel,
      districtZh: s.channel,
      geo: s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon, approx: true } : undefined,
      refreshMs: 0,
    }),
  );
  WORLD_STREAMS.forEach((s) =>
    out.push({
      key: `yt:${s.id}`,
      num: s.num,
      kind: "yt",
      code: s.id,
      name: s.name,
      nameZh: s.nameZh,
      region: "World",
      regionZh: "世界",
      district: s.country,
      districtZh: s.countryZh,
      geo: s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon, approx: true } : undefined,
      refreshMs: 0,
    }),
  );

  // Live data (radar, satellite, speed-map panels): see data/live-data.ts.
  for (const d of DATA_FEEDS)
    out.push({
      key: `${d.kind}:${d.code}`,
      num: d.num,
      kind: d.kind,
      code: d.code,
      src: d.src,
      jma: d.jma,
      name: d.name,
      nameZh: d.nameZh,
      region: "Live data",
      regionZh: "實時數據",
      district: d.by ?? (d.kind === "hko" ? "Observatory" : "Transport Department"),
      districtZh: d.byZh ?? (d.kind === "hko" ? "天文台" : "運輸署"),
      geo: d.lat != null && d.lon != null ? { lat: d.lat, lon: d.lon, approx: false } : undefined,
      refreshMs: d.refreshMs,
    });
  HKO_STATIONS.forEach((s, i) =>
    out.push({
      key: `hko:${s.code}`,
      num: 201 + i,
      kind: "hko",
      code: s.code,
      name: s.name,
      nameZh: s.nameZh,
      region: "HKO weather",
      regionZh: "天文台天氣",
      district: "Observatory",
      districtZh: "天文台",
      geo: { lat: s.lat, lon: s.lon, approx: s.approx },
      refreshMs: 5 * 60_000,
    }),
  );
  const td = [...tdCameras].sort(
    (a, b) =>
      REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region) ||
      a.district.localeCompare(b.district) ||
      a.name.localeCompare(b.name),
  );
  td.forEach((c, i) =>
    out.push({
      key: `td:${c.id}`,
      num: 1001 + i,
      kind: "td",
      code: c.id,
      name: c.name,
      nameZh: c.nameZh,
      region: c.region,
      regionZh: c.regionZh,
      district: c.district,
      districtZh: c.districtZh,
      geo: { lat: c.lat, lon: c.lon, approx: false },
      refreshMs: 2 * 60_000,
    }),
  );
  // Channel-number order everywhere (1xx HK live, 2xx weather, 3xx world, then traffic).
  return out.sort((a, b) => a.num - b.num);
}

/**
 * Weather cameras and located live streams take the district / region of the nearest traffic camera, so they join
 * the location groups (TD cameras cover all 18 districts). Feeds without a location keep their own labels.
 */
function locate(channels: Channel[]): Channel[] {
  const td = channels.filter((c) => c.kind === "td" && c.geo && c.region !== "Live data"); // real cameras only
  return channels.map((c) => {
    // Only Hong Kong feeds take the nearest HK district; world / news / space keep their own country / place.
    // Traffic cameras already have their district. Live data: the speed-map panels (fixed roadside spots) take their
    // district too; radar / satellite cover all of HK or wider, so they stay out of the location groups.
    const panel = c.region === "Live data" && c.kind === "td";
    if ((c.kind === "td" && !panel) || !c.geo || (c.region === "Live data" && !panel) || c.code.startsWith("rec-") || ["World", "News", "Space", "Racing", "Recorded"].includes(c.region)) return c;
    let best = td[0];
    let bestD = Infinity;
    for (const t of td) {
      const d = (t.geo!.lat - c.geo.lat) ** 2 + ((t.geo!.lon - c.geo.lon) * Math.cos((c.geo.lat * Math.PI) / 180)) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return { ...c, region: best.region, regionZh: best.regionZh, district: best.district, districtZh: best.districtZh };
  });
}

export const CHANNELS: Channel[] = locate(build());
export const CHANNEL_BY_KEY = new Map(CHANNELS.map((c) => [c.key, c]));
export const CHANNEL_BY_NUM = new Map(CHANNELS.map((c) => [c.num, c]));

// The starting line-up (about 30): a mix of every kind of feed, in the order it fills the wall. Entries are a channel
// key, "#<channel number>", or "td:<text>" = the first traffic camera whose English name contains it.
const FEATURED_HINTS = [
  "hko:HK2", // Tsim Sha Tsui & ICC
  "yt:Z8NTLkEFZjg", // TST live
  "td:Cross Harbour Tunnel",
  "#251", // weather radar 64 km
  "hko:VPB", // Victoria Peak
  "td:Gloucester Road",
  "#262", // speed map: Tate's Cairn / Lion Rock
  "hko:CP1", // Central Pier
  "yt:XN-ArdUrqtc", // harbour, East Kowloon
  "td:Nathan Road",
  "hko:IC1",
  "td:Tsing Ma",
  "yt:follow-hoy78cablenews", // Cable News (live or latest bulletin)
  "td:Lion Rock Tunnel",
  "hko:CWB", // Clear Water Bay
  "hko:WGL", // Waglan Island
  "yt:ZbUAX0ZvTZI", // Tung Chung, HZMB port & airport
  "hko:TM2", // Tai Mo Shan
  "td:Western Harbour",
  "#254", // satellite image
  "hko:LAM", // Lamma
  "td:Eastern Corridor",
  "yt:follow-shunshunlee", // Victoria Harbour East
  "td:Tuen Mun Road",
  "hko:KLT", // Kowloon City
  "td:Tolo Highway",
  "#264", // speed map
  "hko:CCE", // Cheung Chau
  "td:Canal Road",
  "yt:follow-hkairportlivecam",
];

function featured(): string[] {
  const used = new Set<string>();
  for (const hint of FEATURED_HINTS) {
    const direct = hint.startsWith("#") ? CHANNELS.find((c) => c.num === Number(hint.slice(1))) : CHANNEL_BY_KEY.get(hint);
    if (direct) {
      used.add(direct.key);
      continue;
    }
    const needle = hint.slice(3).toLowerCase();
    const hit = CHANNELS.find((c) => c.kind === "td" && !used.has(c.key) && c.name.toLowerCase().includes(needle));
    if (hit) used.add(hit.key);
  }
  return [...used];
}

/** Built-in themes that mix traffic, weather and live feeds. `match` hits English TD camera names. */
const TOPICS: { id: string; label: string; labelZh: string; keys: string[]; match?: RegExp; where?: (c: Channel) => boolean }[] = [
  {
    // The islands themselves: Peng Chau, Cheung Chau, Lamma and south / west Lantau. No North Lantau road cameras.
    id: "islands",
    label: "Islands Watch",
    labelZh: "離島觀察",
    keys: ["hko:PE2", "hko:DNL", "hko:CCH", "hko:CCE", "hko:LAM", "hko:SLW", "hko:CS1", "hko:CS2"],
  },
  {
    // Lantau: south / west weather cameras plus the North Lantau roads, Lantau Link and Sunny Bay.
    id: "lantau",
    label: "Lantau",
    labelZh: "大嶼山",
    keys: ["hko:SLW", "hko:CS1", "hko:CS2"],
    match: /Lantau Link|Sunny Bay/,
    where: (c) => c.kind === "td" && c.district === "Islands" && !/HZMB/.test(c.name),
  },
  {
    id: "harbour",
    label: "Victoria Harbour",
    labelZh: "維多利亞港",
    keys: ["hko:HK2", "hko:HKO", "hko:IC1", "hko:IC2", "hko:CP1", "hko:HMM", "hko:DNL", "hko:SWH", "yt:XN-ArdUrqtc", "yt:Z8NTLkEFZjg", "yt:follow-shunshunlee"],
    match: /Cross Harbour|Western Harbour|Eastern Harbour|Harbour Road|Gloucester Road|Connaught Road/,
  },
  {
    id: "peak",
    label: "Peak & skyline",
    labelZh: "山頂及天際線",
    keys: ["hko:VPA", "hko:VPB", "hko:GSI", "hko:HK2", "hko:IC1", "hko:IC2", "hko:KLT"],
  },
  {
    // Airport trackers, the HZMB port, the TM-CLK tunnel's southern portal (which lands at it; the Tuen Mun end is
    // left out), and the North Lantau Highway only at
    // its Tung Chung end, where it feeds the airport / HZMB link roads. The rest of the corridor (Tai Ho Wan,
    // Siu Ho Wan, Pak Mong, Sunny Bay, Lantau Link) stays in the Lantau group.
    id: "airport",
    label: "Airport & HZMB",
    labelZh: "機場及港珠澳大橋",
    keys: ["yt:ygC5wni2DMQ", "yt:ZbUAX0ZvTZI", "yt:follow-hkairportlivecam"],
    match: /HZMB|TM-CLK Tunnel Southern Portal|Tung Wing Road|North Lantau Highway near (Tung Chung|Caribbean Coast|Ying Tung)/,
  },
  // Live dashcams of Hong Kong taxis on shift (followed channels: live when driving, else a recent drive).
  { id: "taxi", label: "Taxi cams", labelZh: "的士直播", keys: ["yt:follow-dicgor", "yt:follow-hktaxico", "yt:follow-captainlam"] },
  { id: "tunnels", label: "Tunnels", labelZh: "隧道", keys: [], match: /Tunnel/ },
  { id: "bridges", label: "Bridges", labelZh: "橋樑", keys: [], match: /Bridge|Tsing Ma|Ting Kau|Stonecutters|Kap Shui Mun|Lantau Link/ },
  { id: "border", label: "Border crossings", labelZh: "邊境口岸", keys: [], match: /Shenzhen Bay|Heung Yuen Wai|HZMB|Man Kam To|Lok Ma Chau|Lo Wu|San Tin/ },
  {
    id: "coast",
    label: "Islands & coast",
    labelZh: "離島及海岸",
    keys: ["hko:CCH", "hko:CCE", "hko:LAM", "hko:PE2", "hko:DNL", "hko:WGL", "hko:WL2", "hko:CS1", "hko:CS2", "hko:SLW", "hko:LFS", "hko:WLP", "hko:KS2", "hko:SKG", "hko:SK2", "hko:CWB", "hko:CWA", "hko:TPK"],
  },
];

// Horse racing lives in its own group only, never in the news groups.
const newsKeys = (f: (s: (typeof NEWS_STREAMS)[number]) => boolean) =>
  NEWS_STREAMS.filter((s) => !s.racing && f(s))
    .sort((a, b) => a.num - b.num)
    .map((s) => `yt:${s.id}`);
function newsGroups(): ChannelGroup[] {
  return [
    { id: "news:hk", section: "news", label: "Hong Kong news", labelZh: "香港新聞", keys: newsKeys((s) => s.country === "Hong Kong") },
    { id: "news:rec", section: "news", label: "Hong Kong news recordings", labelZh: "香港新聞重溫", keys: CHANNELS.filter((c) => c.region === "Recorded").map((c) => c.key) },
    { id: "news", section: "news", label: "All news", labelZh: "所有新聞", keys: newsKeys(() => true) },
    { id: "news:zh", section: "news", label: "Chinese-language news", labelZh: "中文新聞", keys: newsKeys((s) => s.lang === "cmn" || s.lang === "yue") },
    { id: "news:en", section: "news", label: "English news", labelZh: "英語新聞", keys: newsKeys((s) => s.lang === "en") },
    { id: "news:tw", section: "news", label: "Taiwan news", labelZh: "台灣新聞", keys: newsKeys((s) => s.country === "Taiwan") },
    { id: "news:apac", section: "news", label: "Asia-Pacific news", labelZh: "亞太新聞", keys: newsKeys((s) => !!s.apac) },
    { id: "news:intl", section: "news", label: "International news", labelZh: "國際新聞", keys: newsKeys((s) => !s.apac && !s.finance) },
    { id: "finance", section: "news", label: "Finance & markets", labelZh: "財經及股市", keys: newsKeys((s) => !!s.finance) },
  ];
}

function buildGroups(): ChannelGroup[] {
  const keysOf = (list: Channel[]) => list.map((c) => c.key);
  const groups: ChannelGroup[] = [
    { id: "featured", section: "type", label: "Featured", labelZh: "精選", keys: featured() },
    { id: "all", section: "type", label: "All channels", labelZh: "所有頻道", keys: keysOf(CHANNELS) },
    { id: "kind:yt", section: "type", label: "Live video", labelZh: "直播影像", keys: keysOf(CHANNELS.filter((c) => c.kind === "yt" && !c.code.startsWith("rec-") && !["World", "News", "Space", "Racing", "Recorded"].includes(c.region))) },
    { id: "live-data", section: "type", label: "Live data", labelZh: "實時數據", keys: DATA_FEEDS.map((d) => `${d.kind}:${d.code}`) },
    { id: "world", section: "type", label: "World live", labelZh: "世界直播", keys: keysOf(CHANNELS.filter((c) => c.region === "World")) },
    { id: "space", section: "type", label: "Space", labelZh: "太空直播", keys: keysOf(CHANNELS.filter((c) => c.region === "Space")) },
    // News & finance (bank 4xx), by audience.
    ...newsGroups(),
    // Hong Kong entertainment: HOY TV programmes plus every entertainment channel with its own group (Mill MILK,
    // Pomato, 香城映画, JFFLive…), then each of those on its own.
    {
      id: "hk-entertainment",
      section: "youtube" as const,
      label: "Hong Kong entertainment",
      labelZh: "香港娛樂",
      keys: [
        "yt:follow-hkhoy",
        ...RECORDING_SOURCES.filter((r) => r.entertainment).flatMap((r) => CHANNELS.filter((c) => c.code.startsWith(`rec-${r.slug}-`)).map((c) => c.key)),
      ].filter((k) => CHANNEL_BY_KEY.has(k)),
    },
    // Hong Kong tech reviewers' latest videos.
    {
      id: "hk-tech",
      section: "youtube" as const,
      label: "Hong Kong tech",
      labelZh: "香港科技",
      keys: RECORDING_SOURCES.filter((r) => r.tech).flatMap((r) => CHANNELS.filter((c) => c.code.startsWith(`rec-${r.slug}-`)).map((c) => c.key)),
    },
    // Cantonese true crime, case files and ghost stories.
    {
      id: "crime",
      section: "youtube" as const,
      label: "Crime & mystery",
      labelZh: "罪案及懸疑",
      keys: RECORDING_SOURCES.filter((r) => r.crime).flatMap((r) => CHANNELS.filter((c) => c.code.startsWith(`rec-${r.slug}-`)).map((c) => c.key)),
    },
    // Film releases: distributors' latest videos and the studios' trailers.
    {
      id: "movies",
      section: "youtube" as const,
      label: "Movies",
      labelZh: "電影",
      keys: RECORDING_SOURCES.filter((r) => r.film).flatMap((r) => CHANNELS.filter((c) => c.code.startsWith(`rec-${r.slug}-`)).map((c) => c.key)),
    },
    // Recording sources with their own group (e.g. Mill MILK), listed with the topics.
    ...RECORDING_SOURCES.filter((r) => r.group).map((r) => ({
      id: r.group!.id,
      section: "youtube" as const,
      label: r.group!.label,
      labelZh: r.group!.labelZh,
      keys: CHANNELS.filter((c) => c.code.startsWith(`rec-${r.slug}-`)).map((c) => c.key),
    })),
    // Horse racing (bank 4xx too, but not news): its own group, listed with the topics.
    {
      id: "racing",
      section: "topic",
      label: "Horse racing",
      labelZh: "賽馬",
      keys: NEWS_STREAMS.filter((s) => s.racing).sort((a, b) => a.num - b.num).map((s) => `yt:${s.id}`),
    },
    { id: "kind:hko", section: "type", label: "Hong Kong weather", labelZh: "香港天氣", keys: keysOf(CHANNELS.filter((c) => c.kind === "hko")) },
    { id: "kind:td", section: "type", label: "Traffic", labelZh: "交通", keys: keysOf(CHANNELS.filter((c) => c.kind === "td")) },
  ];
  for (const t of TOPICS) {
    const matched = CHANNELS.filter((c) => (t.match && c.kind === "td" && t.match.test(c.name)) || t.where?.(c)).map((c) => c.key);
    const keys = [...new Set([...t.keys.filter((k) => CHANNEL_BY_KEY.has(k)), ...matched])];
    if (keys.length) groups.push({ id: `topic:${t.id}`, section: "topic", label: t.label, labelZh: t.labelZh, keys });
  }
  // Location groups hold every located feed (traffic, weather and live) in that region / district.
  for (const region of REGION_ORDER) {
    const inRegion = CHANNELS.filter((c) => c.region === region);
    groups.push({ id: `region:${region}`, section: "region", label: region, labelZh: inRegion.find((c) => c.kind === "td")?.regionZh ?? region, keys: keysOf(inRegion) });
    const districts = [...new Set(inRegion.map((c) => c.district))].sort();
    for (const d of districts) {
      const inDistrict = inRegion.filter((c) => c.district === d);
      groups.push({ id: `district:${d}`, section: "district", label: d, labelZh: inDistrict[0].districtZh, keys: keysOf(inDistrict) });
    }
  }
  return groups;
}

export const GROUPS: ChannelGroup[] = buildGroups();
export const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));

/** NASA GIBS publishes Himawari every 10 minutes, ~40 minutes behind (a slot is now and then missing): the slot
 * `back` steps (of 10 minutes) before the newest one it usually has. */
export function gibsTime(back = 0): string {
  const t = Math.floor((Date.now() - 40 * 60_000) / 600_000) * 600_000 - back * 600_000;
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Raw snapshot URL for a still-image feed. HKO goes through the same-origin relay (no CORS upstream). */
export function snapshotUrl(ch: Channel, hd = false, lang: "en" | "zh" = "en"): string | null {
  // Bilingual sources (TD speed-map panels) come in the viewer's language.
  if (ch.src) return ch.src.replace("{lang}", lang === "zh" ? "tc" : "en").replace("{gibsTime}", gibsTime());
  switch (ch.kind) {
    case "td":
      return `https://tdcctv.data.one.gov.hk/${ch.code}.JPG`;
    case "hko":
      return `/api/snap?hko=${ch.code}${hd ? "&hd=1" : ""}`;
    case "yt":
      return `https://i.ytimg.com/vi/${ch.code}/hqdefault.jpg`;
  }
}

/** Player URL. `playlist`: play these after `id` and loop (replays of a followed channel's latest uploads). */
export function youtubeEmbed(id: string, muted: boolean, playlist?: string[]): string {
  const q = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    playsinline: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3", // no annotations / cards
    disablekb: "1", // no player keyboard shortcuts (the wall has its own)
    fs: "0", // no fullscreen button
    cc_load_policy: "0",
    // Lets the page hear the player's error events (see useYouTubeErrors).
    enablejsapi: "1",
    origin: typeof location !== "undefined" ? location.origin : "",
  });
  if (playlist?.length) {
    q.set("playlist", playlist.join(","));
    q.set("loop", "1");
  }
  // Standard embed host: some broadcasters' videos (RTHK / TVB uploads) refuse the privacy-enhanced youtube-nocookie.com
  // player but play on www.youtube.com.
  return `https://www.youtube.com/embed/${id}?${q}`;
}

export const fmtNum = (n: number) => String(n).padStart(4, "0");

/** Picture shape of a feed: TD snapshots are 4:3 (320×240); HKO photos (720×405) and YouTube are 16:9. */
export function feedAspect(ch: Channel | undefined): number {
  return !ch || ch.kind === "td" ? 4 / 3 : 16 / 9;
}

/**
 * At most this many YouTube previews play at once (the pinned / full-view and selected videos always play on top).
 * YouTube refuses bursts of simultaneous players — a 30-tile group of streams would otherwise come up as "blocked" —
 * and it is heavy on the machine; the other previews show their still with ▶.
 */
export const MAX_PLAYING_PREVIEWS = 16; // = MAX_PREVIEWS in lib/arrange: every preview on screen may play
