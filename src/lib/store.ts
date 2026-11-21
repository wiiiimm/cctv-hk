// App state for the viewing engine. The console UI and the CRT shell both read and drive this one store.
import { useSyncExternalStore } from "react";
import { CHANNELS, CHANNEL_BY_KEY, CHANNEL_BY_NUM, GROUP_BY_ID } from "./channels";

export type Mode = "console" | "crt";
export type Lang = "en" | "zh";

export interface State {
  cols: number;
  rows: number;
  cells: string[];
  selected: number;
  focused: boolean;
  groupId: string;
  page: number;
  patrol: boolean;
  patrolSec: number;
  mode: Mode;
  crtPreset: string;
  lang: Lang;
  favourites: string[];
  showMap: boolean;
  muted: boolean;
  /** Timestamp of the last channel change, used for static bursts and the channel OSD. */
  switchedAt: number;
  /** Digits typed so far for direct channel entry. */
  entry: string;
}

export const LAYOUTS: [number, number][] = [
  [1, 1],
  [2, 2],
  [3, 2],
  [3, 3],
  [4, 3],
  [4, 4],
  [5, 4],
  [6, 6],
];

const STORAGE_KEY = "cctv-hk:v1";
const PERSIST: (keyof State)[] = ["cols", "rows", "cells", "groupId", "page", "mode", "crtPreset", "lang", "favourites", "patrolSec", "showMap", "muted"];

function groupKeys(s: Pick<State, "groupId" | "favourites">): string[] {
  if (s.groupId === "favourites") return s.favourites.length ? s.favourites : GROUP_BY_ID.get("featured")!.keys;
  return GROUP_BY_ID.get(s.groupId)?.keys ?? GROUP_BY_ID.get("featured")!.keys;
}

function pageCells(keys: string[], page: number, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(keys[(page * n + i) % keys.length]);
  return out;
}

function initial(): State {
  const base: State = {
    cols: 4,
    rows: 3,
    cells: [],
    selected: 0,
    focused: false,
    groupId: "featured",
    page: 0,
    patrol: false,
    patrolSec: 15,
    mode: "console",
    crtPreset: "trinitron",
    lang: typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en",
    favourites: [],
    showMap: true,
    muted: true,
    switchedAt: 0,
    entry: "",
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    for (const k of PERSIST) if (k in saved) (base as any)[k] = saved[k];
  } catch {
    /* storage unavailable: use defaults */
  }
  base.favourites = base.favourites.filter((k) => CHANNEL_BY_KEY.has(k));
  const n = base.cols * base.rows;
  base.cells = base.cells.filter((k) => CHANNEL_BY_KEY.has(k));
  if (base.cells.length !== n) base.cells = pageCells(groupKeys(base), base.page, n);
  return base;
}

let state: State | null = null;
const listeners = new Set<() => void>();

function get(): State {
  if (!state) state = initial();
  return state;
}

function update(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const s = get();
  state = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
  try {
    const out: Record<string, unknown> = {};
    for (const k of PERSIST) out[k] = state[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const store = {
  get,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useStore<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => pick(get()), () => pick(get()));
}

export const groupKeysOf = groupKeys;

function stepIn(keys: string[], key: string, dir: number): string {
  let i = keys.indexOf(key);
  if (i < 0) {
    // Not in the current group: step through all channels by number instead.
    const all = CHANNELS.map((c) => c.key);
    i = all.indexOf(key);
    return all[(i + dir + all.length) % all.length];
  }
  return keys[(i + dir + keys.length) % keys.length];
}

export const actions = {
  setLayout(cols: number, rows: number) {
    update((s) => {
      const n = cols * rows;
      const keys = groupKeys(s);
      // Keep what is on screen, then continue through the group after the last visible channel.
      const cells = s.cells.slice(0, n);
      let i = Math.max(0, keys.indexOf(cells[cells.length - 1]) + 1);
      while (cells.length < n) cells.push(keys[i++ % keys.length]);
      return { cols, rows, cells, selected: Math.min(s.selected, n - 1), focused: n === 1 ? false : s.focused };
    });
  },
  cycleLayout(dir: number) {
    const s = get();
    let i = LAYOUTS.findIndex(([c, r]) => c === s.cols && r === s.rows);
    if (i < 0) i = 3;
    const [c, r] = LAYOUTS[(i + dir + LAYOUTS.length) % LAYOUTS.length];
    actions.setLayout(c, r);
  },
  loadGroup(groupId: string) {
    update((s) => {
      const keys = groupKeys({ ...s, groupId });
      return { groupId, page: 0, cells: pageCells(keys, 0, s.cols * s.rows), switchedAt: Date.now() };
    });
  },
  pageStep(dir: number) {
    update((s) => {
      if (s.focused || s.cells.length === 1) {
        const cells = [...s.cells];
        cells[s.selected] = stepIn(groupKeys(s), cells[s.selected], dir);
        return { cells, switchedAt: Date.now() };
      }
      const keys = groupKeys(s);
      const n = s.cols * s.rows;
      const pages = Math.max(1, Math.ceil(keys.length / n));
      const page = (s.page + dir + pages) % pages;
      return { page, cells: pageCells(keys, page, n), switchedAt: Date.now() };
    });
  },
  channelStep(dir: number) {
    update((s) => {
      const cells = [...s.cells];
      cells[s.selected] = stepIn(groupKeys(s), cells[s.selected], dir);
      return { cells, switchedAt: Date.now() };
    });
  },
  assign(index: number, key: string) {
    update((s) => {
      const cells = [...s.cells];
      cells[index] = key;
      return { cells, selected: index, switchedAt: Date.now() };
    });
  },
  tune(num: number) {
    const ch = CHANNEL_BY_NUM.get(num);
    if (ch) actions.assign(get().selected, ch.key);
    update({ entry: "" });
    return !!ch;
  },
  typeDigit(d: string) {
    update((s) => ({ entry: (s.entry + d).slice(-4) }));
  },
  clearEntry() {
    update({ entry: "" });
  },
  select(i: number) {
    update((s) => ({ selected: Math.max(0, Math.min(s.cells.length - 1, i)) }));
  },
  moveSelection(dx: number, dy: number) {
    update((s) => {
      const x = (s.selected % s.cols + dx + s.cols) % s.cols;
      const y = (Math.floor(s.selected / s.cols) + dy + s.rows) % s.rows;
      return { selected: y * s.cols + x };
    });
  },
  focus(i?: number) {
    update((s) => ({ focused: s.cells.length > 1, selected: i ?? s.selected }));
  },
  unfocus() {
    update({ focused: false });
  },
  toggleFocus() {
    const s = get();
    if (s.focused) actions.unfocus();
    else actions.focus();
  },
  setMode(mode: Mode) {
    update({ mode, switchedAt: Date.now() });
  },
  toggleMode() {
    actions.setMode(get().mode === "crt" ? "console" : "crt");
  },
  /** Choosing a picture mode also switches the CRT effect on. */
  setPreset(crtPreset: string) {
    update({ crtPreset, mode: "crt", switchedAt: Date.now() });
  },
  toggleLang() {
    update((s) => ({ lang: s.lang === "en" ? "zh" : "en" }));
  },
  toggleFavourite(key: string) {
    update((s) => ({
      favourites: s.favourites.includes(key) ? s.favourites.filter((k) => k !== key) : [...s.favourites, key],
    }));
  },
  togglePatrol() {
    update((s) => ({ patrol: !s.patrol }));
  },
  setPatrolSec(patrolSec: number) {
    update({ patrolSec });
  },
  toggleMap() {
    update((s) => ({ showMap: !s.showMap }));
  },
  toggleMute() {
    update((s) => ({ muted: !s.muted }));
  },
};

/** The channel currently driving the "focused" context: the full-screen feed, or the selected tile. */
export function activeKey(s: State): string {
  return s.cells[s.selected];
}
