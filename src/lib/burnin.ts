// "Burned-in" readings on a feed: the live road speed at a traffic camera, and the temperature / rain where any Hong
// Kong feed is — drawn under the channel label (one line on previews, more on the pinned view) and listed in the
// sidebar under the map. Data: lib/news.ts (`roadWeather`), from the same relay poll as the ticker.
import type { Channel } from "./channels";
import type { Lang } from "./store";
import { DICTS } from "./i18n";
import { distanceM } from "./geo";
import { roadWeather } from "./news";
import { DISTRICTS, STATIONS, findPlace } from "./wxPlaces";

export interface BurnPart {
  text: string;
  color: string;
}
export type BurnLine = BurnPart[];

const WHITE = "#f2f2f2";
const DIM = "#c9d1dc";
/** Speed colours as on TD's speed map: red congested, amber slow, green moving. */
export const speedColor = (kmh: number) => (kmh < 20 ? "#ff5a4f" : kmh < 40 ? "#ffb000" : "#7CFF6B");
const tempColor = (c: number) => (c >= 32 ? "#ff7a59" : c >= 28 ? "#ffb000" : c <= 12 ? "#7cc4ff" : "#bfe1ff");
/** Nearest station / district only counts within this distance (feeds outside Hong Kong get no local weather). */
const LOCAL_M = 15_000;
/** Pinned view: congestion within this distance is mentioned. */
const JAM_NEAR_M = 1500;

const fmtKm = (m: number) => (m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

export function burnIn(ch: Channel, lang: Lang, detail: boolean): BurnLine[] {
  const data = roadWeather();
  if (!data) return [];
  const t = DICTS[lang];
  const zh = lang === "zh";
  const lines: BurnLine[] = [];
  const road = ch.kind === "td" ? data.camRoads[ch.code] : undefined;
  let weather: BurnPart[] = [];
  if (ch.geo && data.places) {
    const near = data.places.temps
      .map((r) => ({ ...r, at: findPlace(STATIONS, r.place) }))
      .filter((r) => r.at)
      .map((r) => ({ ...r, d: distanceM(ch.geo!, r.at!) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d < LOCAL_M) {
      weather.push({ text: `${near.value}°C`, color: tempColor(near.value) });
      if (detail) weather.push({ text: near.place, color: DIM });
      const district = data.places.rain
        .map((r) => ({ ...r, at: findPlace(DISTRICTS, r.place) }))
        .filter((r) => r.at)
        .map((r) => ({ ...r, d: distanceM(ch.geo!, r.at!) }))
        .sort((a, b) => a.d - b.d)[0];
      if (district && district.mm > 0)
        weather.push({ text: detail ? `${district.place} ${t.rainHour} ${district.mm} mm` : `☂ ${district.mm} mm`, color: "#4fb3ff" });
    }
  }
  if (road) {
    const [en, zhName, kmh] = road;
    const state = kmh < 20 ? t.congested : kmh < 40 ? t.slowTraffic : t.freeFlow;
    const roadPart: BurnPart[] = [
      { text: zh ? zhName : en, color: WHITE },
      { text: `${kmh} km/h`, color: speedColor(kmh) },
    ];
    if (detail) roadPart.push({ text: state, color: speedColor(kmh) });
    if (detail) {
      lines.push(roadPart);
    } else {
      // Previews: one line — road speed, then the temperature.
      lines.push([...roadPart, ...weather.slice(0, 1)]);
      weather = [];
    }
  }
  if (weather.length) lines.push(weather);
  if (detail && ch.geo) {
    const jam = data.jams
      .map((j) => ({ j, d: distanceM(ch.geo!, j) }))
      .filter((x) => x.d < JAM_NEAR_M && !(road && x.j.en === road[0] && x.d < 300))
      .sort((a, b) => a.d - b.d)[0];
    if (jam)
      lines.push([
        { text: t.jamNearby, color: "#ff5a4f" },
        { text: `${zh ? jam.j.zh : jam.j.en} ${jam.j.kmh} km/h · ${zh ? `${jam.j.km} 公里` : `${jam.j.km} km`}`, color: WHITE },
        { text: zh ? `${fmtKm(jam.d)}${t.awayWord}` : `${fmtKm(jam.d)} ${t.awayWord}`, color: DIM },
      ]);
  }
  return lines;
}
