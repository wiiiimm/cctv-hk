// News for the ticker, shared by the DOM ticker and the CRT (which draws it inside the tube). One poller per
// language while anything is listening.
import { useSyncExternalStore } from "react";
import type { NewsItem, WeatherPlaces } from "../pages/api/news";
import { store, type Lang } from "./store";
import { DICTS } from "./i18n";
import { distanceM, type Here } from "./geo";
import { DISTRICTS, STATIONS, findPlace } from "./wxPlaces";

export type { NewsItem };

const REFRESH_MS = 3 * 60_000;
/** Height (CSS px) of the ticker band the CRT reserves at the top of the tube. */
export const CRT_NEWS_H = 26;

let items: NewsItem[] | null = null;
/** What the relay sent, before mixing in local weather and shuffling. */
let raw: { items: NewsItem[]; places: WeatherPlaces | null } | null = null;
let composedFor: Here | null = null;
let lang = "";
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

async function load(l: string) {
  try {
    const d = (await (await fetch(`/api/news?lang=${l}`)).json()) as { items: NewsItem[]; places?: WeatherPlaces | null };
    if (l === lang) {
      raw = { items: d.items, places: d.places ?? null };
      items = compose(raw, l as Lang, store.get().here);
    }
  } catch {
    if (l === lang) items = items ?? [];
  }
  listeners.forEach((f) => f());
}

function want(l: string) {
  if (l === lang && timer) return;
  if (l !== lang) {
    items = null; // only a language change discards what we have
    raw = null;
  }
  lang = l;
  clearInterval(timer);
  if (!items) load(l);
  timer = setInterval(() => load(lang), REFRESH_MS);
}

export function newsItems(): NewsItem[] | null {
  return items;
}

// One subscribe function per language, so React doesn't resubscribe (and refetch) on every render.
const subscribers = new Map<string, (cb: () => void) => () => void>();
function subscribeFor(l: string) {
  let sub = subscribers.get(l);
  if (!sub) {
    sub = (cb) => {
      want(l);
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
        if (!listeners.size) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    };
    subscribers.set(l, sub);
  }
  return sub;
}
const none = () => () => {};

/** Current news in `l` (null while loading; pass null to not listen); starts / switches the poller. */
export function useNews(l: string | null): NewsItem[] | null {
  return useSyncExternalStore(
    l === null ? none : subscribeFor(l),
    () => (l !== null && l === lang ? items : null),
    () => null,
  );
}

// ---- mixing: local weather first and often, other places at random, everything else shuffled ----

/** Fixed for this page load: the ticker order differs on every visit but doesn't jump about between refreshes. */
const SEED = Math.floor(Math.random() * 2 ** 31);
function hash(s: string): number {
  let h = SEED ^ 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pickRandom = <T,>(list: T[], n: number) => [...list].sort(() => Math.random() - 0.5).slice(0, n);
/** Show the local reading again after every this many items. */
const LOCAL_EVERY = 6;
/** Beyond this the "nearest" station isn't near (the viewer is outside Hong Kong). */
const LOCAL_MAX_M = 25_000;

const tempIcon = (c: number, fallback: number) => (c >= 32 ? 90 : c >= 28 ? 91 : c <= 12 ? 93 : c <= 16 ? 92 : fallback);
const hkoLink = (l: Lang) => `https://www.hko.gov.hk/${l === "zh" ? "tc" : "en"}/wxinfo/ts/index.htm`;

function compose(src: { items: NewsItem[]; places: WeatherPlaces | null }, l: Lang, here: Here | null): NewsItem[] {
  composedFor = here;
  const t = DICTS[l];
  const zh = l === "zh";
  const warns = src.items.filter((i) => i.kind === "warn");
  const rest = src.items.filter((i) => i.kind !== "warn");
  const p = src.places;
  let local: NewsItem | undefined;
  const extra: NewsItem[] = [];
  if (p) {
    const icon = p.icon ?? 60;
    const located = p.temps.map((r) => ({ ...r, at: findPlace(STATIONS, r.place) }));
    let nearestPlace: string | undefined;
    if (here) {
      const near = located.filter((r) => r.at).map((r) => ({ ...r, d: distanceM(here, r.at!) })).sort((a, b) => a.d - b.d)[0];
      if (near && near.d < LOCAL_MAX_M) {
        nearestPlace = near.place;
        const district = p.rain.map((r) => ({ ...r, at: findPlace(DISTRICTS, r.place) })).filter((r) => r.at).map((r) => ({ ...r, d: distanceM(here, r.at!) })).sort((a, b) => a.d - b.d)[0];
        const rain = district && district.mm > 0 ? (zh ? `，${district.place}${t.rainPastHour} ${district.mm} 毫米` : `, ${t.rainPastHour} in ${district.place} ${district.mm} mm`) : "";
        local = { kind: "weather", icon, text: `${t.nearYou} · ${near.place}${zh ? "：" : ": "}${near.value}°C${rain}`, time: p.time, link: hkoLink(l) };
      }
    }
    // A few other places, picked afresh on every refresh.
    for (const r of pickRandom(p.temps.filter((r) => r.place !== nearestPlace), 4))
      extra.push({ kind: "weather", icon: tempIcon(r.value, icon), text: `${r.place}${zh ? " " : " "}${r.value}°C`, link: hkoLink(l) });
    const wet = p.rain.filter((r) => r.mm > 0).sort((a, b) => b.mm - a.mm).slice(0, 5);
    if (wet.length) extra.push({ kind: "weather", icon: 63, text: `${t.rainNow}${zh ? "：" : ": "}${wet.map((r) => `${r.place} ${r.mm}${zh ? " 毫米" : " mm"}`).join(zh ? "，" : ", ")}`, link: hkoLink(l) });
  }
  const mixed = [...rest, ...extra].sort((a, b) => hash(a.text) - hash(b.text));
  if (!local) return [...warns, ...mixed];
  const out: NewsItem[] = [...warns, local];
  mixed.forEach((it, i) => {
    out.push(it);
    if ((i + 1) % LOCAL_EVERY === 0 && i < mixed.length - 1) out.push(local!);
  });
  return out;
}

// The viewer's location arriving (or moving) re-mixes the ticker around it.
if (typeof window !== "undefined")
  store.subscribe(() => {
    const here = store.get().here;
    if (here === composedFor || !raw || !lang) return;
    items = compose(raw, lang as Lang, here);
    listeners.forEach((f) => f());
  });
