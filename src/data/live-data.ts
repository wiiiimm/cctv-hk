// "Live data" feeds: pictures that are data, not camera views.
// - HKO weather radar (64 / 128 / 256 km, a new image every 6 minutes) and the satellite image (hourly; HKO's "asia" path serves a global composite). Their
//   URLs carry the image time, and HKO sends no CORS headers, so /api/snap resolves the newest one and relays it.
// - Himawari-9 satellite (global open sources): JMA true colour (map tiles, CORS open, credit JMA) and NASA GIBS
//   infrared / air mass (WMS, CORS open, no key) — see lib/satellite.ts.
// - TD speed-map panels (the roadside "journey time" boards, every 2 minutes), loaded directly (CORS open), in the
//   viewer's language ({lang} = tc / en).
export interface JmaTiles {
  /** Product path, e.g. "REP/ETC" (true colour), "B13/TBB" (infrared). */
  band: string;
  z: number;
  /** Top-left tile and how many across / down. */
  x: number;
  y: number;
  nx: number;
  ny: number;
}

export interface DataFeed {
  num: number;
  kind: "hko" | "td";
  code: string;
  name: string;
  nameZh: string;
  /** Direct image URL (TD panels, NASA GIBS); HKO ones go through /api/snap?hko=<code>. Placeholders: {lang} (tc / en),
   * {gibsTime} (the newest Himawari time GIBS reliably has). */
  src?: string;
  /** JMA Himawari map tiles stitched into one picture (see lib/satellite.ts). */
  jma?: JmaTiles;
  /** Publisher shown as the tile's "district" (default: Observatory / Transport Department). */
  by?: string;
  byZh?: string;
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

/** NASA GIBS WMS picture of one Himawari layer with coastlines, bbox = [minLat, minLon, maxLat, maxLon] (16:9). */
const gibs = (num: number, code: string, name: string, nameZh: string, layer: string, bbox: [number, number, number, number]): DataFeed => ({
  num,
  kind: "hko",
  code,
  name,
  nameZh,
  src: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer},Coastlines_15m&CRS=EPSG:4326&BBOX=${bbox.join(",")}&WIDTH=960&HEIGHT=540&FORMAT=image/jpeg&TIME={gibsTime}`,
  by: "NASA GIBS",
  byZh: "NASA GIBS",
  // New scans every 10 minutes but published ~40 minutes late: 20 here keeps the STALE badge (3× this) for real gaps.
  refreshMs: 20 * 60_000,
});

export const DATA_FEEDS: DataFeed[] = [
  { num: 251, kind: "hko", code: "RAD064", name: "Weather radar (64 km)", nameZh: "天氣雷達（64公里）", lat: 22.3578, lon: 114.2178, refreshMs: 6 * 60_000 },
  { num: 252, kind: "hko", code: "RAD128", name: "Weather radar (128 km)", nameZh: "天氣雷達（128公里）", lat: 22.3578, lon: 114.2178, refreshMs: 6 * 60_000 },
  { num: 253, kind: "hko", code: "RAD256", name: "Weather radar (256 km)", nameZh: "天氣雷達（256公里）", lat: 22.3578, lon: 114.2178, refreshMs: 6 * 60_000 },
  { num: 254, kind: "hko", code: "SATASIA", name: "Satellite image (global)", nameZh: "全球衛星雲圖", refreshMs: 60 * 60_000 },
  // Himawari-9 satellite views of Hong Kong and Asia (global open sources; 16:9 like the other weather pictures).
  { num: 255, kind: "hko", code: "JMA-TC", name: "Himawari true colour: South China (JMA)", nameZh: "向日葵衛星真彩色：華南（日本氣象廳）", jma: { band: "REP/ETC", z: 5, x: 24, y: 12, nx: 4, ny: 3 }, by: "Japan Meteorological Agency", byZh: "日本氣象廳", refreshMs: 10 * 60_000 },
  gibs(256, "GIBS-IR-EA", "Himawari infrared: East Asia (NASA)", "向日葵衛星紅外線：東亞（NASA）", "Himawari_AHI_Band13_Clean_Infrared", [0, 90, 36, 154]),
  gibs(257, "GIBS-IR-SC", "Himawari infrared: South China coast (NASA)", "向日葵衛星紅外線：華南沿岸（NASA）", "Himawari_AHI_Band13_Clean_Infrared", [17.5, 106, 26.5, 122]),
  gibs(258, "GIBS-AM-WP", "Himawari air mass: Western Pacific (NASA)", "向日葵衛星氣團：西北太平洋（NASA）", "Himawari_AHI_Air_Mass", [-4, 100, 32, 164]),
  panel(1, 261, "Tai Po Rd SB nr Sha Tin Racecourse", "大埔道南行近沙田馬場", 22.404797, 114.207348),
  panel(2, 262, "Tate's Cairn Hwy SB nr Shek Mun", "大老山隧道公路南行近石門", 22.389758, 114.210594),
  panel(3, 263, "Tolo Hwy SB nr Science Park", "吐露港公路南行近科學園", 22.426976, 114.206973),
  panel(4, 264, "San Tin Hwy SB nr Fairview Park", "新田公路南行近錦繡花園", 22.464107, 114.053711),
  panel(5, 265, "Tuen Mun Rd SB nr Tseng Choi St", "屯門公路南行近井財街", 22.401076, 113.977227),
];
