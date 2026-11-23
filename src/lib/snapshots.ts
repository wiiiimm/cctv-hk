// Shared snapshot service. Every visible tile (DOM wall or CRT compositor) subscribes by channel key;
// one poller per key fetches the picture as a blob so the DOM can show an object URL and the CRT
// renderer can upload an ImageBitmap to WebGL without tainting the canvas.
import { useEffect, useSyncExternalStore } from "react";
import { CHANNEL_BY_KEY, EPISODE_FOLLOWS, gibsTime, setEpisodes, snapshotUrl, type Channel } from "./channels";
import { store } from "./store";
import { jmaPicture } from "./satellite";

export type SnapStatus = "loading" | "ok" | "error" | "offline";

export interface Snap {
  status: SnapStatus;
  url?: string;
  bitmap?: ImageBitmap;
  width?: number;
  height?: number;
  /** When the source says the picture was taken (Last-Modified), else when we fetched it. */
  takenAt?: number;
  fetchedAt?: number;
  /** YouTube only: whether the stream is currently live. */
  live?: boolean;
  /** YouTube only: the video to play — the channel's code, or for a followed channel its current live video. */
  videoId?: string;
  /** Followed channel with nothing live: playing its latest uploads (`playlist`) instead — badge REPLAY, not LIVE. */
  replay?: boolean;
  playlist?: string[];
  /** Recording slots: the recording's own title (and `takenAt` = when it was published). */
  title?: string;
  /**
   * YouTube only, when not playable: "offair" = not broadcasting; "blocked" = broadcasting, but the owner doesn't
   * let it play here (embedding / website / region limits).
   */
  reason?: "offair" | "blocked";
}

interface Entry {
  snap: Snap;
  listeners: Set<() => void>;
  refs: number;
  timer?: ReturnType<typeof setTimeout>;
  hd: boolean;
}

const entries = new Map<string, Entry>();
const EMPTY: Snap = { status: "loading" };
const POLL_MS = { td: 60_000, hko: 120_000, yt: 90_000 } as const;
const RETRY_MS = 20_000;

function set(key: string, patch: Partial<Snap>) {
  const e = entries.get(key);
  if (!e) return;
  e.snap = { ...e.snap, ...patch };
  e.listeners.forEach((l) => l());
}

function bust(url: string): string {
  const t = Math.floor(Date.now() / 30_000);
  return url + (url.includes("?") ? "&" : "?") + "t=" + t;
}

function probeLive(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 6000);
    img.onload = () => {
      clearTimeout(timer);
      // YouTube serves a 120x90 grey placeholder for missing thumbnails.
      resolve(img.naturalWidth > 120);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg?t=${Math.floor(Date.now() / 60_000)}`;
  });
}

/**
 * Whether YouTube will actually play this video in an embed. oEmbed answers 401/403/404/400 for videos that
 * are removed, private, or have embedding disabled ("Video unavailable"). Network failures count as playable
 * so a flaky connection never takes a stream off air.
 */
async function embeddable(id: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
    return ![400, 401, 403, 404].includes(res.status);
  } catch {
    return true;
  }
}

/** Streams the player itself reported as unavailable, kept off air for a while even if the thumbnail is live. */
const unavailableUntil = new Map<string, number>();
// A refused player is remembered for a few minutes (refusals can be momentary, e.g. too many players at once).
const UNAVAILABLE_MS = 3 * 60_000;

/** Called when an embedded player reports "Video unavailable" (error 100 / 101 / 150 …). */
export function markUnavailable(key: string) {
  unavailableUntil.set(key, Date.now() + UNAVAILABLE_MS);
  const e = entries.get(key);
  // A followed channel whose live stream is blocked here can fall back to its replays: re-check now, not next poll.
  if (CHANNEL_BY_KEY.get(key)?.follow && e && !e.snap.replay) {
    clearTimeout(e.timer);
    load(key);
    return;
  }
  set(key, { live: false, status: "offline", reason: "blocked" });
}

async function load(key: string) {
  const e = entries.get(key);
  const ch = CHANNEL_BY_KEY.get(key);
  if (!e || !ch) return;
  const src = snapshotUrl(ch, e.hd, store.get().lang);
  // Followed channels (bulletins / replays) are re-checked every minute so a stream starting / ending shows promptly.
  let next: number = ch.follow ? 60_000 : POLL_MS[ch.kind];
  try {
    if (ch.kind === "yt") {
      // Followed channel (bulletins, a new video each time): ask the server which video is live right now.
      let vid = ch.code;
      if (ch.follow && ch.recIndex !== undefined) {
        // Recording slot: the channel's Nth most recent recording (the same news / last-48h list as its replays).
        const r = (await (await fetch(`/api/ytlive?ch=${encodeURIComponent(ch.follow)}`)).json()) as { recent?: RecentVideo[] };
        if (ch.episode && r.recent) setEpisodes(ch.follow, episodesOf(r.recent));
        const item = recItem(ch, r.recent);
        if (!item) {
          set(key, { live: false, replay: false, status: "offline", reason: "offair", videoId: undefined, title: undefined });
        } else {
          if (item.id !== e.snap.videoId) set(key, { url: undefined, bitmap: undefined });
          const ok = await embeddable(item.id);
          await fetchInto(key, `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`).catch(() => {});
          set(key, { live: ok, replay: true, videoId: item.id, playlist: undefined, title: item.title, takenAt: item.published ? Date.parse(item.published) : undefined, status: ok ? "ok" : "offline", reason: ok ? undefined : "blocked" });
        }
        const still = entries.get(key);
        if (still && still.refs > 0) still.timer = setTimeout(() => load(key), next);
        return;
      }
      if (ch.follow) {
        const r = (await (await fetch(`/api/ytlive?ch=${encodeURIComponent(ch.follow)}`)).json()) as {
          videoId: string | null;
          live: boolean;
          recent?: { id: string }[];
        };
        const replayIds = (r.recent ?? []).map((v) => v.id);
        // Live, but the owner blocks it here (e.g. a 24/7 stream restricted to approved sites): replay instead.
        const liveBlocked = !!r.live && !!r.videoId && ((unavailableUntil.get(key) ?? 0) > Date.now() || !(await embeddable(r.videoId)));
        if (!r.live || !r.videoId || (liveBlocked && replayIds.length)) {
          // Nothing (playable) live: replay the latest uploads (newest first, looping) — or OFF AIR if there are none.
          const ids = replayIds;
          if (!ids.length) {
            set(key, { live: false, replay: false, status: "offline", reason: "offair", videoId: undefined, playlist: undefined });
          } else {
            if (ids[0] !== e.snap.videoId) set(key, { url: undefined, bitmap: undefined });
            const ok = await embeddable(ids[0]);
            await fetchInto(key, `https://i.ytimg.com/vi/${ids[0]}/hqdefault.jpg`).catch(() => {});
            const playable = ok;
            set(key, { live: playable, replay: true, videoId: ids[0], playlist: ids.slice(1), status: playable ? "ok" : "offline", reason: playable ? undefined : "blocked" });
          }
          const still = entries.get(key);
          if (still && still.refs > 0) still.timer = setTimeout(() => load(key), next);
          return;
        }
        if (r.videoId !== e.snap.videoId) set(key, { url: undefined, bitmap: undefined });
        vid = r.videoId;
      }
      const thumb = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
      // Off air = not broadcasting (no live thumbnail), or YouTube won't play it here ("Video unavailable").
      // The still is refreshed on every check: previews show it when AUTOPLAY is off.
      const [onAir, canEmbed] = await Promise.all([probeLive(vid), embeddable(vid), fetchInto(key, entries.get(key)?.snap.url ? bust(thumb) : thumb).catch(() => {})]);
      const blocked = (unavailableUntil.get(key) ?? 0) > Date.now();
      const live = onAir && canEmbed && !blocked;
      set(key, { live, replay: false, playlist: undefined, videoId: vid, status: live ? "ok" : "offline", reason: live ? undefined : !onAir ? "offair" : "blocked" });
    } else if (ch.src?.includes("{gibsTime}")) {
      // NASA GIBS: a missing slot answers with an XML error (or an empty picture): step back 10 minutes at a time.
      let done = false;
      for (let back = 0; back < 6 && !done; back++) {
        const at = gibsTime(back);
        const res = await fetch(ch.src.replace("{gibsTime}", at));
        const blob = res.ok ? await res.blob() : null;
        if (blob && blob.type.startsWith("image/") && !(await mostlyBlack(blob))) {
          await setPicture(key, blob, Date.parse(at));
          done = true;
        }
      }
      if (!done) throw new Error("no recent GIBS image");
    } else if (ch.jma) {
      const pic = await jmaPicture(ch.jma);
      await setPicture(key, pic.blob, pic.takenAt);
    } else {
      await fetchInto(key, bust(src!));
    }
  } catch {
    // Keep showing the last good picture; only go to NO SIGNAL if we never had one.
    set(key, { status: e.snap.url ? "ok" : "error" });
    next = RETRY_MS;
  }
  const still = entries.get(key);
  if (still && still.refs > 0) still.timer = setTimeout(() => load(key), next);
}

async function fetchInto(key: string, src: string) {
  const res = await fetch(src, { mode: "cors" });
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("not an image");
  const lm = res.headers.get("last-modified");
  await setPicture(key, blob, lm ? Date.parse(lm) : Date.now());
}

/** Show a new picture for `key` (object URL for the DOM, ImageBitmap for the CRT). */
async function setPicture(key: string, blob: Blob, takenAt: number) {
  const bitmap = await createImageBitmap(blob);
  const e = entries.get(key);
  if (!e) {
    bitmap.close();
    return;
  }
  const prev = e.snap;
  set(key, {
    status: "ok",
    url: URL.createObjectURL(blob),
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    takenAt: Number.isFinite(takenAt) ? takenAt : Date.now(),
    fetchedAt: Date.now(),
  });
  // Release the previous picture after the new one has been painted.
  setTimeout(() => {
    if (prev.url) URL.revokeObjectURL(prev.url);
    prev.bitmap?.close();
  }, 1000);
}

export function retain(key: string, hd = false): () => void {
  let e = entries.get(key);
  if (!e) {
    e = { snap: EMPTY, listeners: new Set(), refs: 0, hd };
    entries.set(key, e);
  }
  e.refs++;
  if (hd && !e.hd) {
    e.hd = true;
    clearTimeout(e.timer);
    e.timer = undefined;
  }
  if (!e.timer) load(key);
  return () => {
    const cur = entries.get(key);
    if (!cur) return;
    cur.refs--;
    if (cur.refs <= 0) {
      clearTimeout(cur.timer);
      // Keep the last picture briefly so quick channel flips back are instant.
      cur.timer = setTimeout(() => {
        if (cur.refs > 0) return;
        if (cur.snap.url) URL.revokeObjectURL(cur.snap.url);
        cur.snap.bitmap?.close();
        entries.delete(key);
      }, 30_000);
    }
  };
}

export function getSnap(key: string): Snap {
  return entries.get(key)?.snap ?? EMPTY;
}

function subscribe(key: string, cb: () => void) {
  const e = entries.get(key);
  if (!e) return () => {};
  e.listeners.add(cb);
  return () => e.listeners.delete(cb);
}

type RecentVideo = { id: string; title: string; published?: string; ep?: number };

/** The video a recording slot plays: the Nth most recent, or for an episode slot the video titled with its number. */
function recItem(ch: Channel, recent: RecentVideo[] | undefined): RecentVideo | undefined {
  if (!recent || ch.recIndex === undefined) return undefined;
  return ch.episode ? recent.find((v) => v.ep === ch.episode) : recent[ch.recIndex];
}
const episodesOf = (recent: RecentVideo[]) => recent.flatMap((v) => (v.ep ? [v.ep] : []));

// ---- Status for lists (channel guide): never starts polling a channel by itself ----

/** Followed channels' live / replay state from /api/ytlive (server-cached), shared by every row that asks. */
interface FollowState {
  live: boolean;
  replay: boolean;
  count: number;
  /** The live video (if live) and the replay list (videos with titles), for list rows' links. */
  liveId?: string;
  liveTitle?: string;
  recent: RecentVideo[];
  at: number;
}
const followState = new Map<string, FollowState>();
const followListeners = new Set<() => void>();
const followPending = new Set<string>();
async function refreshFollow(channelId: string) {
  if (followPending.has(channelId)) return;
  followPending.add(channelId);
  try {
    const r = (await (await fetch(`/api/ytlive?ch=${encodeURIComponent(channelId)}`)).json()) as {
      live: boolean;
      videoId?: string | null;
      title?: string | null;
      recent?: RecentVideo[];
    };
    const recent = r.recent ?? [];
    if (EPISODE_FOLLOWS.includes(channelId)) setEpisodes(channelId, episodesOf(recent));
    followState.set(channelId, {
      live: !!r.live,
      replay: !r.live && !!recent.length,
      count: recent.length,
      liveId: r.live ? (r.videoId ?? undefined) : undefined,
      liveTitle: r.live ? (r.title ?? undefined) : undefined,
      recent,
      at: Date.now(),
    });
    followListeners.forEach((l) => l());
  } catch {
    /* keep what we had */
  } finally {
    followPending.delete(channelId);
  }
}

export type ListStatus = "live" | "replay" | "offair" | "blocked" | "unknown";

/**
 * The YouTube video a followed channel / recording slot is showing now, with its title — for the channel list's line
 * and ↗ link. Uses the wall's snapshot if it has one, else the shared (cached) lookup. Undefined for fixed streams.
 */
export function useListVideo(ch: Channel): { id: string; title?: string } | undefined {
  const snap = useSyncExternalStore(
    (cb) => subscribe(ch.key, cb),
    () => getSnap(ch.key),
    () => EMPTY,
  );
  const follow = useSyncExternalStore(
    (cb) => {
      followListeners.add(cb);
      return () => followListeners.delete(cb);
    },
    () => (ch.follow ? followState.get(ch.follow) : undefined),
    () => undefined,
  );
  if (!ch.follow) return undefined;
  if (ch.recIndex !== undefined) {
    const item = recItem(ch, follow?.recent);
    if (snap.videoId && snap.title) return { id: snap.videoId, title: snap.title };
    return item ? { id: item.id, title: item.title } : undefined;
  }
  if (follow?.live && follow.liveId) return { id: follow.liveId, title: follow.liveTitle };
  const first = follow?.recent[0];
  if (snap.videoId) return { id: snap.videoId, title: first && first.id === snap.videoId ? first.title : undefined };
  return first ? { id: first.id, title: first.title } : undefined;
}

/**
 * A YouTube channel's status for a list row, without polling it: what the wall already knows if it is on screen; for a
 * followed channel, its (cached) server lookup; else a fixed 24/7 stream is assumed live.
 */
export function useListStatus(ch: Channel): ListStatus {
  const key = ch.key;
  const snap = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => getSnap(key),
    () => EMPTY,
  );
  const follow = useSyncExternalStore(
    (cb) => {
      followListeners.add(cb);
      return () => followListeners.delete(cb);
    },
    () => (ch.follow ? followState.get(ch.follow) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (!ch.follow) return;
    const f = followState.get(ch.follow);
    if (!f || Date.now() - f.at > 60_000) refreshFollow(ch.follow);
  }, [ch.follow]);
  if (ch.kind !== "yt") return "unknown";
  if (entries.has(key) && snap.status !== "loading") {
    if (snap.live) return snap.replay ? "replay" : "live";
    return snap.reason === "blocked" ? "blocked" : "offair";
  }
  if (ch.follow && ch.recIndex !== undefined) return follow ? (recItem(ch, follow.recent) ? "replay" : "offair") : "unknown";
  if (ch.follow) return follow ? (follow.live ? "live" : follow.replay ? "replay" : "offair") : "unknown";
  return "live";
}

/** Subscribe a component to a channel's picture; keeps it polling while mounted. */
export function useSnap(ch: Channel | undefined, hd = false): Snap {
  const key = ch?.key ?? "";
  useEffect(() => (key ? retain(key, hd) : undefined), [key, hd]);
  return useSyncExternalStore(
    (cb) => (key ? subscribe(key, cb) : () => {}),
    () => (key ? getSnap(key) : EMPTY),
    () => EMPTY,
  );
}

// Language switch: bilingual pictures (speed-map panels) on screen reload now in the new language, not at their next poll.
if (typeof window !== "undefined") {
  let lastLang = store.get().lang;
  store.subscribe(() => {
    const lang = store.get().lang;
    if (lang === lastLang) return;
    lastLang = lang;
    for (const [key, e] of entries) {
      if (!CHANNEL_BY_KEY.get(key)?.src?.includes("{lang}")) continue;
      clearTimeout(e.timer);
      load(key);
    }
  });
}

/** A GIBS slot that isn't published yet comes back as coastlines on black: treat < 15% lit pixels as empty. */
async function mostlyBlack(blob: Blob): Promise<boolean> {
  const bmp = await createImageBitmap(blob, { resizeWidth: 64, resizeHeight: 36 });
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(64, 36) : Object.assign(document.createElement("canvas"), { width: 64, height: 36 });
  const ctx = c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const d = ctx.getImageData(0, 0, 64, 36).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
  return lit < 64 * 36 * 0.15;
}

// Shows numbered by episode: read their playlists once at start so groups list only the episodes released so far.
if (typeof window !== "undefined") EPISODE_FOLLOWS.forEach((id) => refreshFollow(id));
