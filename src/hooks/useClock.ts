import { useSyncExternalStore } from "react";

let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer)
    timer = setInterval(() => {
      now = Date.now();
      subs.forEach((s) => s());
    }, 1000);
  return () => {
    subs.delete(cb);
    if (!subs.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Wall clock that ticks once a second, shared by every subscriber. */
export function useClock(): number {
  return useSyncExternalStore(subscribe, () => now, () => now);
}

const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" });
const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export const hkDate = (t: number) => fmtDate.format(t);
export const hkTime = (t: number) => fmtTime.format(t);
export const hkStamp = (t: number) => `${hkDate(t)} ${hkTime(t)}`;

export function ago(t: number | undefined, now: number): string {
  if (!t) return "--";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m${String(s % 60).padStart(2, "0")}s` : `${Math.floor(m / 60)}h${m % 60}m`;
}
