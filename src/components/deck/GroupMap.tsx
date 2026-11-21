import { useEffect, useMemo, useRef, useState } from "react";
import { CHANNEL_BY_KEY, fmtNum, type Channel } from "../../lib/channels";
import { ATTRIBUTION, TILE, project, tilesFor, unproject } from "../../lib/maptiles";
import { actions, store, useStore } from "../../lib/store";
import { chName, useT } from "../../lib/i18n";

const MIN_Z = 9;
const MAX_Z = 17;
const HK = { lat: 22.35, lon: 114.15 };

/** Centre and zoom that frame every located channel in `list` inside w×h. */
function fit(list: Channel[], w: number, h: number) {
  const pts = list.filter((c) => c.geo).map((c) => c.geo!);
  if (!pts.length || w <= 0 || h <= 0) return { ...HK, z: 10 };
  const lat0 = Math.min(...pts.map((p) => p.lat));
  const lat1 = Math.max(...pts.map((p) => p.lat));
  const lon0 = Math.min(...pts.map((p) => p.lon));
  const lon1 = Math.max(...pts.map((p) => p.lon));
  let z = MAX_Z;
  for (; z > MIN_Z; z--) {
    const a = project(lat1, lon0, z);
    const b = project(lat0, lon1, z);
    if ((b.x - a.x) * TILE <= w - 40 && (b.y - a.y) * TILE <= h - 40) break;
  }
  const c = unproject((project(lat1, lon0, z).x + project(lat0, lon1, z).x) / 2, (project(lat1, lon0, z).y + project(lat0, lon1, z).y) / 2, z);
  return { lat: c.lat, lon: c.lon, z };
}

/**
 * Map view of a camera group: every located feed as a marker (coloured by type), with the feeds on the wall
 * ringed, the selected one filled and the pinned one marked. Click = same as the list (or the tile, if on the wall).
 */
export function GroupMap({ keys, fitKey }: { keys: string[]; fitKey: string }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const cells = useStore((s) => s.cells);
  const selected = useStore((s) => s.selected);
  const pinned = useStore((s) => s.pinned);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ ...HK, z: 10 });
  const list = useMemo(() => keys.map((k) => CHANNEL_BY_KEY.get(k)!).filter((c) => c?.geo), [keys]);

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Frame the group whenever it changes (or the panel first gets a size).
  const framed = useRef("");
  useEffect(() => {
    if (!size.w || framed.current === fitKey) return;
    framed.current = fitKey;
    setView(fit(list, size.w, size.h));
  }, [fitKey, list, size.w, size.h]);

  const c = project(view.lat, view.lon, view.z);
  const toPx = (lat: number, lon: number) => {
    const p = project(lat, lon, view.z);
    return { x: (p.x - c.x) * TILE + size.w / 2, y: (p.y - c.y) * TILE + size.h / 2 };
  };
  const zoomBy = (d: number) => setView((v) => ({ ...v, z: Math.max(MIN_Z, Math.min(MAX_Z, v.z + d)) }));

  // Drag to pan.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => {
      const p = project(v.lat, v.lon, v.z);
      const n = unproject(p.x - dx / TILE, p.y - dy / TILE, v.z);
      return { ...v, lat: n.lat, lon: n.lon };
    });
  };
  const onUp = () => (drag.current = null);

  const pick = (ch: Channel) => {
    const at = cells.indexOf(ch.key);
    const s = store.get();
    if (at >= 0) (s.pinned && !s.focused ? actions.pin(at) : actions.select(at));
    else actions.assign(s.selected, ch.key);
  };

  // Draw on-wall markers last so they sit on top.
  const ordered = [...list].sort((a, b) => Number(cells.includes(a.key)) - Number(cells.includes(b.key)));

  return (
    <div className="group-map">
      <div
        className="group-map-view"
        ref={ref}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => zoomBy(e.deltaY > 0 ? -1 : 1)}
      >
        {size.w > 0 &&
          tilesFor(view.lat, view.lon, view.z, size.w, size.h).map((tl) => (
            <img key={tl.key} src={tl.url} alt="" draggable={false} className="minimap-tile" style={{ left: tl.left, top: tl.top }} />
          ))}
        {size.w > 0 &&
          ordered.map((ch) => {
            const p = toPx(ch.geo!.lat, ch.geo!.lon);
            if (p.x < -10 || p.y < -10 || p.x > size.w + 10 || p.y > size.h + 10) return null;
            const at = cells.indexOf(ch.key);
            const state = at < 0 ? "" : pinned && at === 0 ? " pinned" : at === selected ? " selected" : " on-wall";
            return (
              <button
                key={ch.key}
                type="button"
                className={`gm-pin kind-${ch.kind}${state}`}
                style={{ left: p.x, top: p.y }}
                title={`CH ${fmtNum(ch.num)} · ${chName(ch, lang)}`}
                aria-label={`CH ${fmtNum(ch.num)} ${chName(ch, lang)}`}
                onClick={() => !drag.current?.moved && pick(ch)}
              />
            );
          })}
        <div className="minimap-zoom">
          <button type="button" onClick={() => zoomBy(1)} aria-label={t.zoomIn}>+</button>
          <button type="button" onClick={() => zoomBy(-1)} aria-label={t.zoomOut}>−</button>
          <button type="button" onClick={() => setView(fit(list, size.w, size.h))} aria-label={t.fitMap} title={t.fitMap}>⤢</button>
        </div>
      </div>
      <div className="group-map-legend">
        <span><i className="gm-pin selected" /> {t.mapSelected}</span>
        <span><i className="gm-pin on-wall" /> {t.mapOnWall}</span>
        <span><i className="gm-pin kind-td" /> {t.kind.td}</span>
        <span><i className="gm-pin kind-hko" /> {t.kind.hko}</span>
        <span><i className="gm-pin kind-yt" /> {t.kind.yt}</span>
      </div>
      <div className="group-map-foot">
        <span>
          {list.length} / {keys.length} {t.located}
        </span>
        <span>{ATTRIBUTION}</span>
      </div>
    </div>
  );
}
