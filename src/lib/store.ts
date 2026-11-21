// App state for the viewing engine. The console UI and the CRT shell both read and drive this one store.
import { useSyncExternalStore } from "react";
import { CHANNELS, CHANNEL_BY_KEY, CHANNEL_BY_NUM, GROUP_BY_ID } from "./channels";
import { slotCount, slots } from "./layout";

export type Mode = "console" | "crt";
export type Lang = "en" | "zh";

export interface State {
  /** The grid the user chose (top-bar layout). */
  gridCols: number;
  gridRows: number;
  /**
   * Pin levels: plain grid → pinned (cell 0 takes the big slot of the grid's pinned variant, see `pinnedLayout`)
   * → solo (`focused`: only the pinned video is shown). `focused` implies `pinned`.
   */
  pinned: boolean;
  /** Where the pinned video sat in the plain grid, so unpinning puts it back. */
  pinFrom: number;
  /** Effective layout on screen, derived from the grid and the pin. */
  cols: number;
  rows: number;
  /** Size of the pinned slot in grid units (0 = plain grid). */
  span: number;
  /** Hide the guide and info panel so the wall uses the full width. */
  theater: boolean;
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
  /** Which cell the last change hit (-1 = the whole screen), so the CRT only disturbs that frame. */
  switchedCell: number;
  /** Digits typed so far for direct channel entry. */
  entry: string;
}

/** Grids offered in the top bar (1×1 is not a grid: it is the solo pin). Pinning turns a grid into its pinned variant. */
export const LAYOUTS: [number, number][] = [
  [2, 2],
  [3, 2],
  [3, 3],
  [4, 3],
  [4, 4],
  [5, 4],
  [6, 6],
];

/** Grids with fewer than 3 rows or columns (2×2, 3×2) have no big+small variant: pinning there goes straight to solo. */
export const hasPinnedVariant = (cols: number, rows: number) => Math.min(cols, rows) >= 3;

/**
 * The pinned variant of a cols×rows grid: one big slot (span×span units, top-left) plus small tiles.
 * 3×3 → 1+5, 4×3 → 1+8, 4×4 → 1+7, 5×4 → 1+11, 6×6 → 1+11. Small grids keep their shape (shown solo).
 */
export function pinnedLayout(cols: number, rows: number): [number, number, number] {
  if (!hasPinnedVariant(cols, rows)) return [cols, rows, 0];
  const span = Math.min(cols, rows) - 1;
  return [cols, rows, span];
}

const STORAGE_KEY = "cctv-hk:v1";
const PERSIST: (keyof State)[] = ["gridCols", "gridRows", "pinned", "pinFrom", "focused", "theater", "cells", "groupId", "page", "mode", "crtPreset", "lang", "favourites", "patrolSec", "showMap", "muted"];

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
    gridCols: 4,
    gridRows: 3,
    pinned: false,
    pinFrom: 0,
    cols: 4,
    rows: 3,
    span: 0,
    theater: false,
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
    switchedCell: -1,
    entry: "",
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    for (const k of PERSIST) if (k in saved) (base as any)[k] = saved[k];
  } catch {
    /* storage unavailable: use defaults */
  }
  base.favourites = base.favourites.filter((k) => CHANNEL_BY_KEY.has(k));
  if (!base.pinned) base.focused = false;
  if (base.pinned && !hasPinnedVariant(base.gridCols, base.gridRows)) base.focused = true;
  if (base.gridCols * base.gridRows > 1 && !LAYOUTS.some(([c, r]) => c === base.gridCols && r === base.gridRows)) {
    // Custom n×m grids are no longer offered: fall back to the default grid.
    base.gridCols = 4;
    base.gridRows = 3;
  }
  if (base.gridCols * base.gridRows <= 1) {
    // Older saves used a 1×1 grid for single view; that is now the solo pin.
    base.gridCols = 4;
    base.gridRows = 3;
    base.pinned = true;
    base.focused = true;
  }
  [base.cols, base.rows, base.span] = base.pinned ? pinnedLayout(base.gridCols, base.gridRows) : [base.gridCols, base.gridRows, 0];
  const n = slotCount(base.cols, base.rows, base.span);
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

/** Resize the cell list to `n`: keep what is on screen, then continue through the group. */
function fillCells(s: State, cells: string[], n: number): string[] {
  const keys = groupKeys(s);
  const out = cells.slice(0, n);
  let i = Math.max(0, keys.indexOf(out[out.length - 1]) + 1);
  while (out.length < n) {
    const k = keys[i++ % keys.length];
    // Avoid repeating a camera already on the wall when the group is big enough.
    if (!out.includes(k) || keys.length <= n || i > keys.length * 2) out.push(k);
  }
  return out;
}

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
  /** Choose the grid. A pinned video stays pinned, in the new grid's pinned variant. */
  setLayout(gridCols: number, gridRows: number) {
    update((s) => {
      const pinned = s.pinned && gridCols * gridRows > 1;
      const [cols, rows, span] = pinned ? pinnedLayout(gridCols, gridRows) : [gridCols, gridRows, 0];
      const n = slotCount(cols, rows, span);
      const cells = fillCells(s, s.cells, n);
      return {
        gridCols,
        gridRows,
        pinned,
        pinFrom: Math.min(s.pinFrom, gridCols * gridRows - 1),
        cols,
        rows,
        span,
        cells,
        selected: pinned ? 0 : Math.min(s.selected, n - 1),
        focused: pinned && !hasPinnedVariant(gridCols, gridRows),
      };
    });
  },
  cycleLayout(dir: number) {
    const s = get();
    let i = LAYOUTS.findIndex(([c, r]) => c === s.gridCols && r === s.gridRows);
    if (i < 0) i = 3;
    const [c, r] = LAYOUTS[(i + dir + LAYOUTS.length) % LAYOUTS.length];
    actions.setLayout(c, r);
  },
  /** Pin cell `i`: switch to the grid's pinned variant with that video in the big slot. */
  pin(i?: number) {
    update((s) => {
      const at = i ?? s.selected;
      if (at < 0 || at >= s.cells.length) return {};
      if (s.pinned) {
        // Already pinned: pin a different video by swapping it into the big slot.
        if (at === 0) return {};
        const cells = [...s.cells];
        [cells[0], cells[at]] = [cells[at], cells[0]];
        return { cells, selected: 0, switchedAt: Date.now(), switchedCell: 0 };
      }
      const [cols, rows, span] = pinnedLayout(s.gridCols, s.gridRows);
      const rest = s.cells.filter((_, k) => k !== at);
      const cells = fillCells(s, [s.cells[at], ...rest], slotCount(cols, rows, span));
      const solo = !hasPinnedVariant(s.gridCols, s.gridRows);
      return { pinned: true, pinFrom: at, cols, rows, span, cells, selected: 0, focused: solo, switchedCell: solo ? -1 : 0, switchedAt: Date.now() };
    });
  },
  /** Back to the plain grid, with the pinned video returned to where it came from. */
  unpin() {
    update((s) => {
      if (!s.pinned) return {};
      const n = s.gridCols * s.gridRows;
      const back = Math.min(s.pinFrom, n - 1);
      const rest = s.cells.slice(1);
      rest.splice(back, 0, s.cells[0]);
      return { pinned: false, cols: s.gridCols, rows: s.gridRows, span: 0, cells: fillCells(s, rest, n), selected: back, focused: false, switchedCell: -1 };
    });
  },
  togglePin() {
    const s = get();
    if (!s.pinned) actions.pin();
    else if (s.selected > 0 && !s.focused) actions.pin(s.selected);
    else actions.unpin();
  },
  loadGroup(groupId: string) {
    update((s) => {
      const keys = groupKeys({ ...s, groupId });
      return { groupId, page: 0, cells: pageCells(keys, 0, s.cells.length), switchedAt: Date.now(), switchedCell: -1 };
    });
  },
  pageStep(dir: number) {
    update((s) => {
      if (s.focused || s.cells.length === 1) {
        const cells = [...s.cells];
        cells[s.selected] = stepIn(groupKeys(s), cells[s.selected], dir);
        return { cells, switchedAt: Date.now(), switchedCell: s.selected };
      }
      const keys = groupKeys(s);
      const n = s.cells.length;
      const pages = Math.max(1, Math.ceil(keys.length / n));
      const page = (s.page + dir + pages) % pages;
      return { page, cells: pageCells(keys, page, n), switchedAt: Date.now(), switchedCell: -1 };
    });
  },
  channelStep(dir: number) {
    update((s) => {
      const cells = [...s.cells];
      cells[s.selected] = stepIn(groupKeys(s), cells[s.selected], dir);
      return { cells, switchedAt: Date.now(), switchedCell: s.selected };
    });
  },
  assign(index: number, key: string) {
    update((s) => {
      const cells = [...s.cells];
      cells[index] = key;
      return { cells, selected: index, switchedAt: Date.now(), switchedCell: index };
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
      if (s.span <= 1) {
        const x = (s.selected % s.cols + dx + s.cols) % s.cols;
        const y = (Math.floor(s.selected / s.cols) + dy + s.rows) % s.rows;
        return { selected: y * s.cols + x };
      }
      // Spotlight layouts: step to the nearest slot whose centre lies in that direction.
      const all = slots(s.cols, s.rows, s.span).map((p) => ({ x: p.col + p.span / 2, y: p.row + p.span / 2 }));
      const from = all[s.selected];
      let best = -1;
      let bestD = Infinity;
      all.forEach((p, i) => {
        const along = (p.x - from.x) * dx + (p.y - from.y) * dy;
        if (i === s.selected || along <= 0) return;
        const across = Math.abs((p.x - from.x) * dy) + Math.abs((p.y - from.y) * dx);
        const d = along + across * 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best >= 0 ? { selected: best } : {};
    });
  },
  toggleTheater() {
    update((s) => ({ theater: !s.theater }));
  },
  /** Solo pin: show only video `i` (pinning it first if needed). */
  focus(i?: number) {
    const s = get();
    const at = i ?? s.selected;
    if (!s.pinned || at > 0) actions.pin(at);
    update({ focused: true, selected: 0, switchedCell: -1 });
  },
  /** Solo → pinned grid (or straight back to the plain grid when the grid has no pinned variant). */
  unfocus() {
    const s = get();
    if (s.pinned && !hasPinnedVariant(s.gridCols, s.gridRows)) actions.unpin();
    else update({ focused: false });
  },
  toggleFocus() {
    const s = get();
    if (s.focused) actions.unfocus();
    else actions.focus();
  },
  /** One pin level up for video `i`: grid → pinned → solo. Picking another video while pinned pins that one. */
  escalate(i?: number) {
    const s = get();
    const at = i ?? s.selected;
    if (!s.pinned) actions.pin(at);
    else if (s.focused) return;
    else if (at > 0) actions.pin(at);
    else actions.focus(0);
  },
  /** One pin level down: solo → pinned → grid. */
  deescalate() {
    const s = get();
    if (s.focused) actions.unfocus();
    else if (s.pinned) actions.unpin();
  },
  setMode(mode: Mode) {
    update({ mode, switchedAt: Date.now(), switchedCell: -1 });
  },
  toggleMode() {
    actions.setMode(get().mode === "crt" ? "console" : "crt");
  },
  /** Choosing a picture mode also switches the CRT effect on. */
  setPreset(crtPreset: string) {
    update({ crtPreset, mode: "crt", switchedAt: Date.now(), switchedCell: -1 });
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
