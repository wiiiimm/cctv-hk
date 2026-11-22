import { useEffect, useState } from "react";
import { CHANNEL_BY_KEY, fmtNum } from "../../lib/channels";
import { actions, activeKey, useStore } from "../../lib/store";
import { useT } from "../../lib/i18n";

/** Physical keys that correspond to a remote button, so keyboard presses light up the remote too. */
const KEY_TO_BTN: Record<string, string> = {
  Enter: "ok",
  " ": "ok",
  Backspace: "clr",
  Escape: "clr",
  PageUp: "ch+",
  PageDown: "ch-",
  "]": "pg+",
  "[": "pg-",
};

/** A TV-style remote: channel display, number pad (shares direct entry with the keyboard), CH and page rockers. */
export function Remote() {
  const t = useT();
  const entry = useStore((s) => s.entry);
  const key = useStore(activeKey);
  const ch = key ? CHANNEL_BY_KEY.get(key) : undefined;
  const [lit, setLit] = useState<string | null>(null);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("cctv-hk:remote") !== "0";
    } catch {
      return true;
    }
  });

  // Mirror keyboard presses on the remote.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
      const id = /^[0-9]$/.test(e.key) ? e.key : KEY_TO_BTN[e.key];
      if (!id) return;
      setLit(id);
      clearTimeout(timer);
      timer = setTimeout(() => setLit(null), 160);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("cctv-hk:remote", open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const display = entry ? entry.padEnd(4, "-") : ch ? fmtNum(ch.num) : "----";
  const b = (id: string, label: React.ReactNode, onPress: () => void, cls = "", aria?: string) => (
    <button key={id} type="button" className={`rm-key ${cls}${lit === id ? " lit" : ""}`} onClick={onPress} aria-label={aria ?? (typeof label === "string" ? label : id)}>
      {label}
    </button>
  );

  return (
    <section className={`remote${open ? "" : " closed"}`} aria-label={t.remote}>
      <button type="button" className="rm-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="rm-ir" aria-hidden />
        <span>{t.remote}</span>
        <span className={`rm-display${entry ? " typing" : ""}`} aria-live="polite">
          CH {display}
        </span>
        <span className="rm-caret" aria-hidden>
          {open ? "▾" : "▴"}
        </span>
      </button>
      {open && (
        <div className="rm-body">
          <div className="rm-rocker" role="group" aria-label={t.chUp}>
            {b("ch+", "▲", () => actions.channelStep(1), "", t.chUp)}
            <span className="rm-rocker-label">CH</span>
            {b("ch-", "▼", () => actions.channelStep(-1), "", t.chDown)}
          </div>
          <div className="rm-pad" role="group" aria-label={t.tune}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => b(d, d, () => actions.typeDigit(d), "digit"))}
            {b("clr", t.clr, actions.clearEntry, "fn", t.clr)}
            {b("0", "0", () => actions.typeDigit("0"), "digit")}
            {b("ok", "OK", () => actions.commitEntry(), "ok", "OK")}
          </div>
          <div className="rm-rocker" role="group" aria-label={t.page}>
            {b("pg+", "▶", () => actions.pageStep(1), "", `${t.page} +`)}
            <span className="rm-rocker-label">{t.pg}</span>
            {b("pg-", "◀", () => actions.pageStep(-1), "", `${t.page} −`)}
          </div>
        </div>
      )}
    </section>
  );
}
