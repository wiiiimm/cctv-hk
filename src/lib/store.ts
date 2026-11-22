// App state for the viewing engine. The console UI and the CRT shell both read and drive this one store.
import { useSyncExternalStore } from "react";
import { CHANNELS, CHANNEL_BY_KEY, CHANNEL_BY_NUM, GROUPS, GROUP_BY_ID, feedAspect } from "./channels";
import { applyView, syncUrl } from "./urlState";
import { PREVIEW_DEFAULT, PREVIEW_MAX, PREVIEW_MIN, PREVIEW_STEP, liveGeometry, neighbour, type PinMode } from "./arrange";

export type Mode = "console" | "crt";
export type Lang = "en" | "zh";

export type PatrolMode = "rolling" | "page" | "pinned";

export interface CustomGroup {
  id: string;
  name: string;
  keys: string[];
}

export interface State {
  /** Width (CSS px) the user wants each preview (non-pinned video) to be. The wall fills the screen with as many as fit. */
  previewSize: number;
  /**
   * Pin levels: wall of previews → pinned (cell 0 is shown large beside / above the previews)
   * → solo (`focused`: only the pinned video). `focused` implies `pinned`.
   */
  pinned: boolean;
  /** Where the pinned video sat among the previews, so unpinning puts it back. */
  pinFrom: number;
  /** Pinned size: "wide" (full width, previews below) or "side" (previews right and below). Full = `focused`. */
  pinMode: PinMode;
  /** Hide the guide and info panel so the wall uses the full width. */
  theater: boolean;
  cells: string[];
  /** Selected cell, or -1 when nothing is selected (click empty wall / Esc). */
  selected: number;
  focused: boolean;
  groupId: string;
  page: number;
  patrol: boolean;
  patrolSec: number;
  /**
   * How the sequence (patrol) advances each tick: "rolling" swaps one preview at a time for the next camera not on
   * screen; "page" flips all previews to the next page; "pinned" moves the next camera into the pinned slot and
   * refills the previews with the cameras after it (an up-next queue).
   */
  patrolMode: PatrolMode;
  mode: Mode;
  crtPreset: string;
  lang: Lang;
  favourites: string[];
  /** User-made groups; a feed can be in any number of them. Selected as groupId "custom:<id>". */
  customGroups: CustomGroup[];
  showMap: boolean;
  muted: boolean;
  /** News ticker bar (HKO warnings, TD traffic news, RTHK headlines). */
  news: boolean;
  /** CRT barrel distortion (the CURVE toggle). Off keeps every other CRT effect, with a flat picture. */
  crtCurve: boolean;
  /** Live YouTube previews play (muted). Off: they show a still; the pinned / full-view video always plays. */
  autoplay: boolean;
  /** Timestamp of the last channel change, used for static bursts and the channel OSD. */
  switchedAt: number;
  /** Which cell the last change hit (-1 = the whole screen), so the CRT only disturbs that frame. */
  switchedCell: number;
  /** Digits typed so far for direct channel entry. */
  entry: string;
}

const STORAGE_KEY = "cctv-hk:v1";
const PERSIST: (keyof State)[] = ["previewSize", "pinMode", "pinned", "pinFrom", "focused", "theater", "cells", "groupId", "page", "mode", "crtPreset", "lang", "favourites", "customGroups", "patrolSec", "patrolMode", "muted", "news", "crtCurve", "autoplay"];

function groupKeys(s: Pick<State, "groupId" | "favourites" | "customGroups">): string[] {
  if (s.groupId === "favourites") return s.favourites.length ? s.favourites : GROUP_BY_ID.get("featured")!.keys;
  if (s.groupId.startsWith("custom:")) return s.customGroups.find((g) => `custom:${g.id}` === s.groupId)?.keys ?? [];
  return GROUP_BY_ID.get(s.groupId)?.keys ?? GROUP_BY_ID.get("featured")!.keys;
}

/** One page of the group: n channels from page·n, wrapping round, but never showing a channel twice. */
function pageCells(keys: string[], page: number, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.min(n, keys.length); i++) out.push(keys[(page * n + i) % keys.length]);
  return out;
}

function initial(): State {
  const base: State = {
    // Small screens start with smaller previews; landscape screens pin "side", portrait ones "wide".
    previewSize: smallScreen() ? 160 : PREVIEW_DEFAULT,
    pinned: false,
    pinFrom: 0,
    pinMode: typeof window !== "undefined" && window.innerWidth < window.innerHeight ? "wide" : "side",
    theater: false,
    cells: [],
    selected: 0,
    focused: false,
    groupId: "featured",
    page: 0,
    // Patrol runs by default: rolling, one preview swapped every 10s.
    patrol: true,
    patrolSec: 10,
    patrolMode: "rolling",
    mode: "console",
    crtPreset: "trinitron",
    lang: typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en",
    favourites: [],
    customGroups: [],
    showMap: true,
    muted: true,
    news: true,
    crtCurve: true,
    autoplay: true,
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
  // A shared link wins over what this device saved (then goes through the same clean-up below).
  const shared = typeof window !== "undefined" ? applyView(base, window.location.search) : {};
  const fromLink = typeof window !== "undefined" && window.location.search.length > 1;
  base.favourites = base.favourites.filter((k) => CHANNEL_BY_KEY.has(k));
  base.customGroups = (Array.isArray(base.customGroups) ? base.customGroups : [])
    .filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
    .map((g) => ({ id: g.id, name: g.name, keys: [...new Set((g.keys ?? []).filter((k) => CHANNEL_BY_KEY.has(k)))] }));
  if (base.groupId.startsWith("custom:") && !base.customGroups.some((g) => `custom:${g.id}` === base.groupId)) base.groupId = "featured";
  if (!base.pinned) base.focused = false;
  base.previewSize = clampPreview(Number(base.previewSize) || PREVIEW_DEFAULT);
  if (!["rolling", "page", "pinned"].includes(base.patrolMode)) base.patrolMode = "rolling";
  if (base.pinMode !== "wide" && base.pinMode !== "side") base.pinMode = "side";
  // Restore the saved wall, but only channels that belong to the current group (no duplicates). A saved pin that
  // isn't in the group is released — the same rule as switching group.
  const groupSet = new Set(groupKeys(base));
  const saved = base.cells.filter((k) => CHANNEL_BY_KEY.has(k));
  const pinnedKey = base.pinned && groupSet.has(saved[0]) ? saved[0] : undefined;
  const previews = [...new Set(saved.slice(base.pinned ? 1 : 0))].filter((k) => groupSet.has(k) && k !== pinnedKey);
  base.cells = pinnedKey ? [pinnedKey, ...previews] : previews;
  if (!pinnedKey) base.pinned = base.focused = false;
  // Until the wall reports how many previews fit, start with a screenful's worth from the group.
  if (base.cells.length < 2) base.cells = [...base.cells, ...pageCells(groupKeys(base), base.page, 12).filter((k) => k !== pinnedKey)];
  // Selection from a link is by camera; without one, a link means "nothing selected" (or the pinned video).
  if (fromLink) base.selected = shared.select ? base.cells.indexOf(shared.select) : base.pinned ? 0 : -1;
  return base;
}

let state: State | null = null;
const listeners = new Set<() => void>();

function get(): State {
  if (!state) {
    state = initial();
    syncUrl(state);
  }
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
  syncUrl(state);
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

/** Preview cell shape: 16:9 when every feed in the group is 16:9 (weather, live video), else 4:3. */
export function wallAspect(s: State): number {
  const keys = groupKeys(s);
  return keys.length && keys.every((k) => feedAspect(CHANNEL_BY_KEY.get(k)) > 1.5) ? 16 / 9 : 4 / 3;
}

/** Shape of the big picture: the pinned video, or the one shown full. */
export function bigAspect(s: State): number {
  return feedAspect(CHANNEL_BY_KEY.get(s.cells[s.focused ? Math.max(0, s.selected) : 0]));
}

/** Distinct feeds the wall can show for the current group (the pinned one counted once, even if from elsewhere). */
export function feedCount(s: State): number {
  const keys = groupKeys(s);
  return keys.length + (s.pinned && s.cells[0] && !keys.includes(s.cells[0]) ? 1 : 0);
}

/**
 * Resize the cell list to `n`: keep what is on screen, then continue through the group. A channel is never
 * shown twice; if the group runs out, the remaining slots stay empty.
 */
/**
 * Put `key` into cell `at`. If that channel is already showing in another cell, the two cells swap (the other cell
 * takes what `at` was showing), so the wall never shows a channel twice.
 */
function placeKey(cells: string[], at: number, key: string): string[] {
  const out = [...cells];
  const already = out.indexOf(key);
  if (already >= 0 && already !== at) out[already] = out[at];
  out[at] = key;
  return out;
}

function fillCells(s: State, cells: string[], n: number): string[] {
  const keys = groupKeys(s);
  const out = [...new Set(cells)].slice(0, n);
  let i = Math.max(0, keys.indexOf(out[out.length - 1]) + 1);
  for (let tries = 0; out.length < n && tries < keys.length; tries++) {
    const k = keys[i++ % keys.length];
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

function stepIn(keys: string[], key: string, dir: number): string {
  if (!keys.length) return key;
  let i = keys.indexOf(key);
  if (i < 0) {
    // Not in the current group: step through all channels by number instead.
    const all = CHANNELS.map((c) => c.key);
    i = all.indexOf(key);
    return all[(i + dir + all.length) % all.length];
  }
  return keys[(i + dir + keys.length) % keys.length];
}

const smallScreen = () => typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 600;
const clampPreview = (px: number) => Math.max(PREVIEW_MIN, Math.min(PREVIEW_MAX, Math.round(px / PREVIEW_STEP) * PREVIEW_STEP));

/**
 * How many cells the wall on screen can show (pinned video included), as last reported by the wall. Group
 * changes size the new wall from this — not from the old group's cell count, which may be smaller.
 */
let wallCapacity = 0;
const capacityOr = (fallback: number) => (wallCapacity > 0 ? wallCapacity : fallback);

// Sequence (patrol) bookkeeping: rolling cursor through the group, next slot to replace, and the time of the last
// automatic change (so manual changes can restart the dwell timer).
let rollCursor = 0;
let rollSlot = 0;
let lastTick = 0;
/** When the last automatic sequence change happened (to tell it apart from manual changes). */
export const lastSequenceTick = () => lastTick;

/** The cell an action applies to: the selection, else the pinned video, else the first tile. */
const target = (s: State) => (s.selected >= 0 ? s.selected : 0);

/** Typed channel numbers auto-tune after this pause. */
export const ENTRY_TIMEOUT_MS = 1800;
let entryTimer: ReturnType<typeof setTimeout> | undefined;

export const actions = {
  /** Preview size (px of tile width). The wall re-fills the screen and reports its new capacity. */
  setPreviewSize(px: number) {
    update({ previewSize: clampPreview(px) });
  },
  resizePreviews(dir: number) {
    actions.setPreviewSize(get().previewSize + dir * PREVIEW_STEP * 2);
  },
  /**
   * The on-screen wall reports how many cells it can show (pinned video included). Keep what is on screen,
   * continue through the group for new slots, and drop the overflow.
   */
  setCapacity(n: number) {
    if (n >= 1) wallCapacity = n;
    const s = get();
    if (n < 1 || n === s.cells.length) return;
    // A small group can't fill every slot; don't keep re-asking for more than it has.
    if (n > s.cells.length && fillCells(s, s.cells, n).length === s.cells.length) return;
    update((st) => {
      const cells = fillCells(st, st.cells, n);
      return { cells, selected: Math.min(st.selected, n - 1) };
    });
  },
  /** Pin cell `i`: it is shown large, and the previews re-fill around it. */
  pin(i?: number) {
    update((s) => {
      const at = i ?? s.selected; // nothing selected → nothing to pin
      if (at < 0 || at >= s.cells.length) return {};
      const cells = [...s.cells];
      if (s.pinned) {
        // Already pinned: pin a different video by swapping it into the pinned slot.
        if (at === 0) return {};
        [cells[0], cells[at]] = [cells[at], cells[0]];
        return { cells, selected: 0, switchedAt: Date.now(), switchedCell: 0 };
      }
      const [picked] = cells.splice(at, 1);
      return { pinned: true, pinFrom: at, cells: [picked, ...cells], selected: 0, focused: false, switchedCell: 0, switchedAt: Date.now() };
    });
  },
  /**
   * Back to a wall of previews. The pinned video returns to where it came from — but only if it belongs to the
   * group now on screen and isn't already showing; otherwise it is dropped and the wall refills from the group.
   */
  unpin() {
    update((s) => {
      if (!s.pinned) return {};
      const [was, ...rest] = s.cells;
      const belongs = groupKeys(s).includes(was) && !rest.includes(was);
      const back = Math.min(s.pinFrom, rest.length);
      if (belongs) rest.splice(back, 0, was);
      const cells = fillCells(s, rest, capacityOr(s.cells.length));
      return { pinned: false, cells, selected: belongs ? back : 0, focused: false, switchedCell: -1 };
    });
  },
  /** Choose how the pinned video is shown: "wide", "side", or "full" (only the pinned video). Pins the selection if needed. */
  setPinMode(mode: PinMode | "full") {
    const s = get();
    if (!s.pinned) actions.pin();
    if (mode === "full") actions.focus(0);
    else update({ pinMode: mode, focused: false });
  },
  togglePin() {
    const s = get();
    if (!s.pinned) actions.pin();
    else if (s.selected > 0 && !s.focused) actions.pin(s.selected);
    else actions.unpin();
  },
  /**
   * Switch camera group. A pinned video stays pinned only if it is part of the new group (previews refill around
   * it without repeating it); otherwise the pin is released and the wall shows the group's first page.
   */
  /** Previous / next camera group, in the picker's order (favourites, my groups, topics, types, news, YouTube, regions). */
  groupStep(dir: number) {
    const s = get();
    const order = [
      "favourites",
      ...s.customGroups.map((g) => `custom:${g.id}`),
      ...(["topic", "type", "news", "youtube"] as const).flatMap((sec) => GROUPS.filter((g) => g.section === sec).map((g) => g.id)),
      ...GROUPS.filter((g) => g.section === "region" || g.section === "district").map((g) => g.id),
    ];
    const i = order.indexOf(s.groupId);
    actions.loadGroup(order[(i + dir + order.length) % order.length]);
  },
  loadGroup(groupId: string) {
    update((s) => {
      const keys = groupKeys({ ...s, groupId });
      const pinnedKey = s.pinned ? s.cells[0] : undefined;
      const n = capacityOr(s.cells.length);
      if (pinnedKey && keys.includes(pinnedKey)) {
        const previews = pageCells(keys.filter((k) => k !== pinnedKey), 0, Math.max(1, n - 1));
        return { groupId, page: 0, cells: [pinnedKey, ...previews], selected: 0, switchedAt: Date.now(), switchedCell: -1 };
      }
      return {
        groupId,
        page: 0,
        pinned: false,
        focused: false,
        cells: pageCells(keys, 0, n),
        selected: 0,
        switchedAt: Date.now(),
        switchedCell: -1,
      };
    });
  },
  pageStep(dir: number) {
    update((s) => {
      if (s.focused || s.cells.length === 1) {
        const cells = [...s.cells];
        const at = target(s);
        cells[at] = stepIn(groupKeys(s), cells[at], dir);
        return { cells, switchedAt: Date.now(), switchedCell: at };
      }
      const keys = groupKeys(s);
      const fixed = s.pinned ? 1 : 0; // the pinned video stays; only previews page
      const n = Math.max(1, capacityOr(s.cells.length) - fixed);
      const pool = fixed ? keys.filter((k) => k !== s.cells[0]) : keys; // never repeat the pinned video
      const pages2 = Math.max(1, Math.ceil(pool.length / n));
      const page2 = (s.page + dir + pages2) % pages2;
      const cells = [...s.cells.slice(0, fixed), ...pageCells(pool, page2, n)];
      // Pinned: only the previews changed (-2 = "all previews", leaving the pinned video alone); else the whole wall.
      return { page: page2, cells, switchedAt: Date.now(), switchedCell: fixed ? -2 : -1 };
    });
  },
  channelStep(dir: number) {
    update((s) => {
      const at = target(s);
      const cells = placeKey(s.cells, at, stepIn(groupKeys(s), s.cells[at], dir));
      return { cells, selected: at, switchedAt: Date.now(), switchedCell: at };
    });
  },
  assign(index: number, key: string) {
    update((s) => {
      const cells = placeKey(s.cells, index, key);
      return { cells, selected: index, switchedAt: Date.now(), switchedCell: index };
    });
  },
  tune(num: number) {
    clearTimeout(entryTimer);
    const ch = CHANNEL_BY_NUM.get(num);
    if (ch) actions.assign(target(get()), ch.key);
    update({ entry: "" });
    return !!ch;
  },
  /** Direct channel entry (keyboard digits and the remote's number pad). Auto-tunes after a pause. */
  typeDigit(d: string) {
    update((s) => ({ entry: (s.entry + d).slice(-4) }));
    clearTimeout(entryTimer);
    entryTimer = setTimeout(actions.commitEntry, ENTRY_TIMEOUT_MS);
  },
  /** Tune to the typed number now (Enter / OK). Returns false if nothing was being typed. */
  commitEntry() {
    const entry = get().entry;
    if (!entry) return false;
    actions.tune(Number(entry));
    return true;
  },
  clearEntry() {
    clearTimeout(entryTimer);
    update({ entry: "" });
  },
  /**
   * A tap / click on tile i. Mouse: select (or, while pinned, pin it). Touch adds a second step so one finger can do
   * everything: tapping the selected preview pins it, tapping the pinned video shows it full.
   */
  tap(i: number, touch = false) {
    const s = get();
    if (s.focused) return;
    if (s.pinned) {
      if (touch && i === 0) actions.focus(0);
      else actions.pin(i);
    } else if (touch && s.selected === i) actions.pin(i);
    else actions.select(i);
  },
  select(i: number) {
    update((s) => ({ selected: Math.max(0, Math.min(s.cells.length - 1, i)) }));
  },
  /** Move the selection to the visually adjacent tile in the arrangement currently on screen. */
  moveSelection(dx: number, dy: number) {
    update((s) => {
      // Navigate across the tiles actually showing (a small group may not fill every slot).
      const geo = liveGeometry().slice(0, s.cells.length);
      if (!geo.length) return {};
      if (s.selected < 0 || s.selected >= geo.length) return { selected: 0 }; // start again from the first tile
      const next = neighbour(geo, s.selected, dx, dy);
      return next >= 0 ? { selected: next } : {};
    });
  },
  toggleTheater() {
    update((s) => ({ theater: !s.theater }));
  },
  /** Solo pin: show only video `i` (pinning it first if needed). */
  focus(i?: number) {
    const s = get();
    const at = i ?? target(s);
    if (!s.pinned || at > 0) actions.pin(at);
    update({ focused: true, selected: 0, switchedCell: -1 });
  },
  /** Solo → pinned. */
  unfocus() {
    update({ focused: false });
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
    if (at < 0) return;
    if (!s.pinned) actions.pin(at);
    else if (s.focused) return;
    else if (at > 0) actions.pin(at);
    else actions.focus(0);
  },
  /** One pin level down: solo → pinned → grid → nothing selected. */
  deescalate() {
    const s = get();
    if (s.focused) actions.unfocus();
    else if (s.pinned) actions.unpin();
    else actions.deselect();
  },
  /** Clear the selection (click on an empty part of the wall). */
  deselect() {
    update({ selected: -1 });
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
  /** Create a group (optionally starting with one feed) and switch to it. Returns its id. */
  createGroup(name: string, firstKey?: string) {
    const id = Date.now().toString(36);
    const group: CustomGroup = { id, name: name.trim() || "Untitled", keys: firstKey && CHANNEL_BY_KEY.has(firstKey) ? [firstKey] : [] };
    update((s) => ({ customGroups: [...s.customGroups, group] }));
    return id;
  },
  renameGroup(id: string, name: string) {
    update((s) => ({ customGroups: s.customGroups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)) }));
  },
  deleteGroup(id: string) {
    const wasCurrent = get().groupId === `custom:${id}`;
    update((s) => ({ customGroups: s.customGroups.filter((g) => g.id !== id) }));
    if (wasCurrent) actions.loadGroup("featured");
  },
  /** Add / remove a feed in one of the user's groups. */
  toggleInGroup(id: string, key: string) {
    update((s) => ({
      customGroups: s.customGroups.map((g) =>
        g.id !== id ? g : { ...g, keys: g.keys.includes(key) ? g.keys.filter((k) => k !== key) : [...g.keys, key] },
      ),
    }));
  },
  setPatrolMode(patrolMode: PatrolMode) {
    update({ patrolMode });
  },
  /** One sequence (patrol) step, per the current mode. Does nothing when the whole group is already on screen. */
  /** One step of the sequence (patrol). Rolling swaps `swaps` previews (see the timer in useControls). */
  sequenceTick(swaps = 1) {
    const s = get();
    const keys = groupKeys(s);
    const fixed = s.pinned ? 1 : 0;
    const slots = Math.max(0, capacityOr(s.cells.length) - fixed);
    if (s.patrolMode === "pinned") {
      if (keys.length < 2) return;
      if (!s.pinned) actions.pin(target(s));
      update((st) => {
        const i = keys.indexOf(st.cells[0]);
        const next = keys[(i + 1 + keys.length) % keys.length];
        const queue: string[] = [];
        for (let k = 1; k < keys.length && queue.length < slots; k++) {
          const key = keys[(keys.indexOf(next) + k) % keys.length];
          if (key !== next) queue.push(key);
        }
        return { cells: [next, ...queue], selected: 0, switchedAt: (lastTick = Date.now()), switchedCell: 0 };
      });
      return;
    }
    // Rolling / page only make sense when the group has more cameras than the preview slots.
    const pool = fixed ? keys.filter((k) => k !== s.cells[0]) : keys;
    if (pool.length <= slots) return;
    if (s.patrolMode === "page") {
      lastTick = Date.now();
      actions.pageStep(1);
      update({ switchedAt: lastTick });
      return;
    }
    // Rolling: replace the next preview slot (round-robin) with the next camera that isn't on screen.
    update((st) => {
      const cells = [...st.cells];
      const onScreen = new Set(cells);
      let lastSlot = -1;
      for (let n = 0; n < Math.min(swaps, cells.length - fixed); n++) {
        const slot = fixed + (rollSlot++ % Math.max(1, cells.length - fixed));
        let pick: string | undefined;
        for (let k = 0; k < pool.length && !pick; k++) {
          const key = pool[(rollCursor + k) % pool.length];
          if (!onScreen.has(key)) {
            pick = key;
            rollCursor = (rollCursor + k + 1) % pool.length;
          }
        }
        if (!pick || slot >= cells.length) break;
        onScreen.delete(cells[slot]);
        onScreen.add(pick);
        cells[slot] = pick;
        lastSlot = slot;
      }
      if (lastSlot < 0) return {};
      // Static stays confined to a frame (never the whole tube) even when several swap at once.
      return { cells, switchedAt: (lastTick = Date.now()), switchedCell: lastSlot };
    });
  },
  toggleAutoplay() {
    update((s) => ({ autoplay: !s.autoplay }));
  },
  toggleCurve() {
    update((s) => ({ crtCurve: !s.crtCurve }));
  },
  toggleNews() {
    update((s) => ({ news: !s.news }));
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

/** The channel shown in the sidebar panel: the selected tile, else the pinned video (else none). */
export function activeKey(s: State): string | undefined {
  if (s.selected >= 0) return s.cells[s.selected];
  return s.pinned ? s.cells[0] : undefined;
}

/** The cell actions apply to when nothing is selected (exported for the guide, map and remote). */
export const actionTarget = target;
