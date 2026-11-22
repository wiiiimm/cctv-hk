// News for the ticker, shared by the DOM ticker and the CRT (which draws it inside the tube). One poller per
// language while anything is listening.
import { useSyncExternalStore } from "react";
import type { NewsItem } from "../pages/api/news";

export type { NewsItem };

const REFRESH_MS = 3 * 60_000;
/** Height (CSS px) of the ticker band the CRT reserves at the top of the tube. */
export const CRT_NEWS_H = 22;

let items: NewsItem[] | null = null;
let lang = "";
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

async function load(l: string) {
  try {
    const d = (await (await fetch(`/api/news?lang=${l}`)).json()) as { items: NewsItem[] };
    if (l === lang) items = d.items;
  } catch {
    if (l === lang) items = items ?? [];
  }
  listeners.forEach((f) => f());
}

function want(l: string) {
  if (l === lang && timer) return;
  if (l !== lang) items = null; // only a language change discards what we have
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
