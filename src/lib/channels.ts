import tdCameras from "../data/td-cameras.json";
import { HKO_STATIONS } from "../data/hko-stations";
import { LIVE_STREAMS } from "../data/streams";

export type FeedKind = "td" | "hko" | "yt";

export interface Channel {
  /** Stable key, e.g. "td:H429F", "hko:HKO", "yt:jmwM1hA3JE0". */
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
  /** How often the source publishes a new picture. */
  refreshMs: number;
}

export interface ChannelGroup {
  id: string;
  label: string;
  labelZh: string;
  /** Where it is listed in the group picker. */
  section: "type" | "topic" | "region" | "district" | "custom";
  keys: string[];
}

const REGION_ORDER = ["Hong Kong Island", "Kowloon", "New Territories"];

function build(): Channel[] {
  const out: Channel[] = [];
  // Bank 1xx: live video. Bank 2xx: HKO weather. Bank 1000+: traffic, region then district.
  LIVE_STREAMS.forEach((s, i) =>
    out.push({
      key: `yt:${s.id}`,
      num: 101 + i,
      kind: "yt",
      code: s.id,
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
  return out;
}

/**
 * Weather cameras and located live streams take the district / region of the nearest traffic camera, so they join
 * the location groups (TD cameras cover all 18 districts). Feeds without a location keep their own labels.
 */
function locate(channels: Channel[]): Channel[] {
  const td = channels.filter((c) => c.kind === "td" && c.geo);
  return channels.map((c) => {
    if (c.kind === "td" || !c.geo) return c;
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

const FEATURED_HINTS = [
  "hko:HK2",
  "yt:jmwM1hA3JE0",
  "hko:VPB",
  "td:Cross Harbour Tunnel",
  "td:Gloucester Road",
  "hko:CP1",
  "td:Nathan Road",
  "td:Tsing Ma",
  "hko:IC1",
  "td:Lion Rock Tunnel",
  "hko:CWB",
  "td:Airport",
  "yt:TIYZVyzOk4k",
  "td:Western Harbour",
  "hko:LAM",
  "td:Tolo Highway",
];

function featured(): string[] {
  const used = new Set<string>();
  for (const hint of FEATURED_HINTS) {
    const direct = CHANNEL_BY_KEY.get(hint);
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
    keys: ["hko:HK2", "hko:HKO", "hko:IC1", "hko:IC2", "hko:CP1", "hko:HMM", "hko:DNL", "hko:SWH", "yt:XN-ArdUrqtc", "yt:6YYmUo2TgJ0", "yt:jmwM1hA3JE0", "yt:Fwr8lBTaBtE"],
    match: /Cross Harbour|Western Harbour|Eastern Harbour|Harbour Road|Gloucester Road|Connaught Road/,
  },
  {
    id: "peak",
    label: "Peak & skyline",
    labelZh: "山頂及天際線",
    keys: ["hko:VPA", "hko:VPB", "hko:GSI", "hko:HK2", "hko:IC1", "hko:IC2", "hko:KLT", "yt:TIYZVyzOk4k", "yt:WkcmApaOvWc", "yt:O1oQhMlBiOA", "yt:6YYmUo2TgJ0"],
  },
  {
    id: "airport",
    label: "Airport & HZMB",
    labelZh: "機場及港珠澳大橋",
    keys: ["yt:ygC5wni2DMQ", "yt:JPREngCARsA"],
    match: /HZMB|TM-CLK/,
  },
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

function buildGroups(): ChannelGroup[] {
  const keysOf = (list: Channel[]) => list.map((c) => c.key);
  const groups: ChannelGroup[] = [
    { id: "featured", section: "type", label: "Featured", labelZh: "精選", keys: featured() },
    { id: "all", section: "type", label: "All channels", labelZh: "所有頻道", keys: keysOf(CHANNELS) },
    { id: "kind:yt", section: "type", label: "Live video", labelZh: "直播影像", keys: keysOf(CHANNELS.filter((c) => c.kind === "yt")) },
    { id: "kind:hko", section: "type", label: "HKO weather", labelZh: "天文台天氣", keys: keysOf(CHANNELS.filter((c) => c.kind === "hko")) },
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

/** Raw snapshot URL for a still-image feed. HKO goes through the same-origin relay (no CORS upstream). */
export function snapshotUrl(ch: Channel, hd = false): string | null {
  switch (ch.kind) {
    case "td":
      return `https://tdcctv.data.one.gov.hk/${ch.code}.JPG`;
    case "hko":
      return `/api/snap?hko=${ch.code}${hd ? "&hd=1" : ""}`;
    case "yt":
      return `https://i.ytimg.com/vi/${ch.code}/hqdefault.jpg`;
  }
}

export function youtubeEmbed(id: string, muted: boolean): string {
  const q = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    playsinline: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    // Lets the page hear the player's error events (see useYouTubeErrors).
    enablejsapi: "1",
    origin: typeof location !== "undefined" ? location.origin : "",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
}

export const fmtNum = (n: number) => String(n).padStart(4, "0");
