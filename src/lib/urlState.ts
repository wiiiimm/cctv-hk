// The current view as a shareable URL. Every control a viewer can set is in the query string, so a link reproduces
// the same wall: group, page, the cameras on the wall, pin / size / full view, selection, preview size, CRT and its
// look, language, sound, sequence (patrol) mode and timing, and the sidebar.
//
//   ?g=featured&pg=2&wall=215,101,1101&pin=101&pm=wide&full=1&sel=1101&sz=160&crt=trinitron&lang=zh
//    &patrol=0&seq=page&dwell=30&sound=1&theatre=1
// Omitted = default: page 1, nothing pinned, console mode, patrol on, rolling, 10s, muted, sidebar shown.
//
// Cameras are written as channel numbers. A custom group or favourites list is carried as its cameras (`gc`) and
// name (`gn`) so it works on someone else's device: the receiver gets it as one of their own groups.
import { CHANNEL_BY_KEY, CHANNEL_BY_NUM, GROUP_BY_ID } from "./channels";
import { PRESETS } from "./crt/presets";
import type { CustomGroup, PatrolMode, State } from "./store";

const nums = (keys: string[]) => keys.map((k) => CHANNEL_BY_KEY.get(k)?.num).filter((n): n is number => n != null).join(",");
const keysOf = (v: string | null) =>
  (v ?? "")
    .split(",")
    .map((n) => CHANNEL_BY_NUM.get(Number(n))?.key)
    .filter((k): k is string => !!k);

/** Query string for the view in `s` (without the leading "?"). */
export function encodeView(s: State): string {
  const q = new URLSearchParams();
  const custom = s.customGroups.find((c) => `custom:${c.id}` === s.groupId);
  if (custom) {
    q.set("g", "custom");
    q.set("gn", custom.name);
    q.set("gc", nums(custom.keys));
  } else if (s.groupId === "favourites") {
    q.set("g", "favourites");
    if (s.favourites.length) q.set("gc", nums(s.favourites));
  } else q.set("g", s.groupId);
  if (s.page) q.set("pg", String(s.page + 1));
  const previews = s.pinned ? s.cells.slice(1) : s.cells;
  if (previews.length) q.set("wall", nums(previews));
  if (s.pinned && s.cells[0]) {
    q.set("pin", nums([s.cells[0]]));
    q.set("pm", s.pinMode);
    if (s.focused) q.set("full", "1");
  }
  const sel = s.cells[s.selected];
  if (s.selected >= 0 && sel && !(s.pinned && s.selected === 0)) q.set("sel", nums([sel]));
  q.set("sz", String(s.previewSize));
  if (s.mode === "crt") q.set("crt", s.crtPreset);
  q.set("lang", s.lang);
  if (!s.patrol) q.set("patrol", "0");
  if (s.patrolMode !== "rolling") q.set("seq", s.patrolMode);
  if (s.patrolSec !== 10) q.set("dwell", String(s.patrolSec));
  if (!s.muted) q.set("sound", "1");
  if (s.theater) q.set("theatre", "1");
  return q.toString().replace(/%2C/g, ",");
}

/**
 * Apply a shared link's parameters on top of the saved state (before the store's own clean-up). Returns the keys of
 * the cameras to select once the wall is built (selection is by camera, not slot).
 */
export function applyView(base: State, search: string): { select?: string } {
  const q = new URLSearchParams(search);
  if (![...q.keys()].length) return {};
  const g = q.get("g");
  if (g === "custom" || g === "favourites") {
    const keys = keysOf(q.get("gc"));
    const same = (c: { keys: string[] }) => c.keys.length === keys.length && c.keys.every((k) => keys.includes(k));
    if (g === "favourites" && (!keys.length || same({ keys: base.favourites }))) base.groupId = "favourites";
    else if (keys.length) {
      // Someone else's group: reuse an identical one, else add it to this device's groups.
      let found = base.customGroups.find(same);
      if (!found) {
        const name = q.get("gn") || (g === "favourites" ? "Shared favourites" : "Shared group");
        found = { id: Date.now().toString(36), name, keys } satisfies CustomGroup;
        base.customGroups = [...base.customGroups, found];
      }
      base.groupId = `custom:${found.id}`;
    }
  } else if (g && GROUP_BY_ID.has(g)) base.groupId = g;

  const pg = Number(q.get("pg"));
  base.page = pg >= 1 ? Math.floor(pg) - 1 : 0;
  const pin = keysOf(q.get("pin"))[0];
  const wall = keysOf(q.get("wall"));
  if (pin || wall.length) base.cells = pin ? [pin, ...wall] : wall;
  base.pinned = !!pin;
  base.focused = !!pin && q.get("full") === "1";
  const pm = q.get("pm");
  if (pm === "wide" || pm === "side") base.pinMode = pm;
  const sz = Number(q.get("sz"));
  if (sz > 0) base.previewSize = sz;
  const crt = q.get("crt");
  base.mode = crt != null ? "crt" : "console";
  if (crt && PRESETS.some((p) => p.id === crt)) base.crtPreset = crt;
  const lang = q.get("lang");
  if (lang === "en" || lang === "zh") base.lang = lang;
  base.patrol = q.get("patrol") !== "0";
  const seq = q.get("seq") ?? "rolling";
  if (["rolling", "page", "pinned"].includes(seq)) base.patrolMode = seq as PatrolMode;
  const dwell = Number(q.get("dwell") ?? 10);
  if ([5, 10, 15, 30, 60].includes(dwell)) base.patrolSec = dwell;
  base.muted = q.get("sound") !== "1";
  base.theater = q.get("theatre") === "1";
  return { select: keysOf(q.get("sel"))[0] };
}

let timer: ReturnType<typeof setTimeout> | undefined;
let last = "";
/** Keep the address bar in step with the view (replaceState: no history entry per click). */
export function syncUrl(s: State) {
  if (typeof window === "undefined") return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const qs = encodeView(s);
    if (qs === last) return;
    last = qs;
    history.replaceState(history.state, "", `${location.pathname}?${qs}${location.hash}`);
  }, 150);
}

/** Link to the current view. */
export function viewLink(s: State): string {
  return `${location.origin}${location.pathname}?${encodeView(s)}`;
}
