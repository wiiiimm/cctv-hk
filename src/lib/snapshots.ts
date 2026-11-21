// Shared snapshot service. Every visible tile (DOM wall or CRT compositor) subscribes by channel key;
// one poller per key fetches the picture as a blob so the DOM can show an object URL and the CRT
// renderer can upload an ImageBitmap to WebGL without tainting the canvas.
import { useEffect, useSyncExternalStore } from "react";
import { CHANNEL_BY_KEY, snapshotUrl, type Channel } from "./channels";

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

async function load(key: string) {
  const e = entries.get(key);
  const ch = CHANNEL_BY_KEY.get(key);
  if (!e || !ch) return;
  const src = snapshotUrl(ch, e.hd);
  let next: number = POLL_MS[ch.kind];
  try {
    if (ch.kind === "yt") {
      const [live] = await Promise.all([probeLive(ch.code), e.snap.url ? Promise.resolve() : fetchInto(key, src!)]);
      set(key, { live, status: live ? "ok" : "offline" });
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
  const bitmap = await createImageBitmap(blob);
  const e = entries.get(key);
  if (!e) {
    bitmap.close();
    return;
  }
  const prev = e.snap;
  const lm = res.headers.get("last-modified");
  const takenAt = lm ? Date.parse(lm) : Date.now();
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
