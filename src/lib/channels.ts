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

export const CHANNELS: Channel[] = build();
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

function buildGroups(): ChannelGroup[] {
  const groups: ChannelGroup[] = [
    { id: "featured", label: "Featured", labelZh: "精選", keys: featured() },
    { id: "all", label: "All channels", labelZh: "所有頻道", keys: CHANNELS.map((c) => c.key) },
    { id: "kind:yt", label: "Live video", labelZh: "直播影像", keys: CHANNELS.filter((c) => c.kind === "yt").map((c) => c.key) },
    { id: "kind:hko", label: "HKO weather", labelZh: "天文台天氣", keys: CHANNELS.filter((c) => c.kind === "hko").map((c) => c.key) },
  ];
  for (const region of REGION_ORDER) {
    const inRegion = CHANNELS.filter((c) => c.kind === "td" && c.region === region);
    groups.push({
      id: `region:${region}`,
      label: `${region} traffic`,
      labelZh: `${inRegion[0]?.regionZh ?? region}交通`,
      keys: inRegion.map((c) => c.key),
    });
    const districts = [...new Set(inRegion.map((c) => c.district))].sort();
    for (const d of districts) {
      const inDistrict = inRegion.filter((c) => c.district === d);
      groups.push({
        id: `district:${d}`,
        label: d,
        labelZh: inDistrict[0].districtZh,
        keys: inRegion.filter((c) => c.district === d).map((c) => c.key),
      });
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
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
}

export const fmtNum = (n: number) => String(n).padStart(4, "0");
