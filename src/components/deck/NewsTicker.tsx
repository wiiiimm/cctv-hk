import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../../lib/store";
import { useT } from "../../lib/i18n";
import { useNews } from "../../lib/news";
import { wxIconSvg } from "../../lib/wxIcons";

const SPEED = 70; // px per second
/** Start somewhere along the loop (per page load), not always at the first headline. */
const START = Math.random();

export const hhmm = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit" }) : "";

/**
 * Crawling news bar above the bottom bar: HKO warnings in force (red), HKO weather now / forecast (blue, with a weather
 * icon), TD special traffic news (amber), then RTHK
 * local headlines — in the viewer's language. Hover (or focus) pauses it; each item links to its source.
 */
export function NewsTicker({ crt = false, style }: { crt?: boolean; style?: React.CSSProperties } = {}) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const items = useNews(lang);
  const track = useRef<HTMLDivElement>(null);
  const [dur, setDur] = useState(60);

  // Constant reading speed whatever the amount of text: duration = half the track (it is doubled for the loop) / speed.
  useLayoutEffect(() => {
    if (track.current) setDur(Math.max(20, track.current.scrollWidth / 2 / SPEED));
  }, [items]);

  const list = items ?? [];
  const row = (copy: number) =>
    list.map((it, i) => {
      const body = (
        <>
          {it.kind === "warn" && <b className="nt-tag warn">{t.newsWarn}</b>}
          {it.kind === "traffic" && <b className="nt-tag traffic">{t.newsTraffic}</b>}
          {it.kind === "weather" && <b className="nt-tag weather">{t.newsWeather}</b>}
          {it.kind === "jam" && <b className="nt-tag jam">{t.newsJam}</b>}
          {it.icon !== undefined && <span className="nt-icon" aria-hidden dangerouslySetInnerHTML={{ __html: wxIconSvg(it.icon) }} />}
          {it.kind !== "traffic" && it.kind !== "jam" && it.time && <span className="nt-time">{hhmm(it.time)}</span>}
          <span className="nt-text">{it.text}</span>
        </>
      );
      return (
        <span className={`nt-item ${it.kind}`} key={`${copy}-${i}`} aria-hidden={copy > 0 || undefined}>
          {it.link ? (
            <a href={it.link} target="_blank" rel="noopener noreferrer" tabIndex={copy > 0 ? -1 : 0}>
              {body}
            </a>
          ) : (
            body
          )}
        </span>
      );
    });

  return (
    <div
      className={`news-ticker${crt ? " crt" : ""}`}
      style={style}
      role="region"
      aria-label={t.newsTitle}
      title={t.newsSource}
      // Inside the CRT tube: don't let ticker clicks fall through to the tube's tile selection.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <span className="nt-label">{t.newsLabel}</span>
      <div className="nt-viewport">
        {items === null ? (
          <span className="nt-status">{t.newsLoading}</span>
        ) : list.length ? (
          <div className="nt-track" ref={track} style={{ animationDuration: `${dur}s`, animationDelay: `${-START * dur}s` }}>
            {row(0)}
            {row(1)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
