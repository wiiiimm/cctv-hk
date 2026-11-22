// "Live data" feeds: pictures that are data, not camera views.
// - HKO weather radar (64 / 128 / 256 km, a new image every 6 minutes) and the satellite image (hourly; HKO's "asia" path serves a global composite). Their
//   URLs carry the image time, and HKO sends no CORS headers, so /api/snap resolves the newest one and relays it.
// - TD speed-map panels (the roadside "journey time" boards, every 2 minutes), loaded directly (CORS open), in the
//   viewer's language ({lang} = tc / en).
export interface DataFeed {
  num: number;
  kind: "hko" | "td";
  code: string;
  name: string;
  nameZh: string;
  /** Direct image URL for TD panels; HKO ones go through /api/snap?hko=<code>. */
  src?: string;
  lat?: number;
  lon?: number;
  refreshMs: number;
}

const panel = (n: number, num: number, name: string, nameZh: string, lat: number, lon: number): DataFeed => ({
  num,
  kind: "td",
  code: `SJ${n}`,
  name: `Speed map: ${name}`,
  nameZh: `行車速度圖：${nameZh}`,
  src: `https://resource.data.one.gov.hk/td/jss/sj${n}.{lang}.png`,
  lat,
  lon,
  refreshMs: 2 * 60_000,
});

export const DATA_FEEDS: DataFeed[] = [
  { num: 251, kind: "hko", code: "RAD064", name: "Weather radar (64 km)", nameZh: "天氣雷達（64公里）", lat: 22.3578, lon: 114.2178, refreshMs: 6 * 60_000 },
  { num: 252, kind: "hko", code: "RAD128", name: "Weather radar (128 km)", nameZh: "天氣雷達（128公里）", lat: 22.3578, lon: 114.2178, refreshMs: 6 * 60_000 },
  { num: 253, kind: "hko", code: "RAD256", name: "Weather radar (256 km)", nameZh: "天氣雷達（256公里）", lat: 22.3578, lon: 114.2178, refreshMs: 6 * 60_000 },
  { num: 254, kind: "hko", code: "SATASIA", name: "Satellite image (global)", nameZh: "全球衛星雲圖", refreshMs: 60 * 60_000 },
  panel(1, 261, "Tai Po Rd SB nr Sha Tin Racecourse", "大埔道南行近沙田馬場", 22.404797, 114.207348),
  panel(2, 262, "Tate's Cairn Hwy SB nr Shek Mun", "大老山隧道公路南行近石門", 22.389758, 114.210594),
  panel(3, 263, "Tolo Hwy SB nr Science Park", "吐露港公路南行近科學園", 22.426976, 114.206973),
  panel(4, 264, "San Tin Hwy SB nr Fairview Park", "新田公路南行近錦繡花園", 22.464107, 114.053711),
  panel(5, 265, "Tuen Mun Rd SB nr Tseng Choi St", "屯門公路南行近井財街", 22.401076, 113.977227),
];
