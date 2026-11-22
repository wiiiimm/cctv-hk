import { useEffect, useRef, useState } from "react";
import { ATTRIBUTION, FLIGHT_MS, fmtLatLon, flyView, pointIn, reducedMotion, tilesForView, viewOf, type MapView } from "../lib/maptiles";
import { useT } from "../lib/i18n";

interface Props {
  lat: number;
  lon: number;
  approx: boolean;
  label: string;
}

/** Animated view: flies from wherever the map is to `target` whenever the target changes. */
function useFlight(target: MapView, width: number): MapView {
  const [view, setView] = useState(target);
  const shown = useRef(target);
  shown.current = view;
  const key = `${target.x},${target.y},${target.z}`;
  useEffect(() => {
    const from = shown.current;
    if (reducedMotion() || (from.x === target.x && from.y === target.y && from.z === target.z)) {
      setView(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = (now - t0) / FLIGHT_MS;
      setView(t >= 1 ? target : flyView(from, target, t, width));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return view;
}

export function MiniMap({ lat, lon, approx, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 180 });
  const [zoom, setZoom] = useState(approx ? 14 : 16);
  const t = useT();

  useEffect(() => setZoom(approx ? 14 : 16), [lat, lon, approx]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const target = viewOf(lat, lon, zoom);
  const view = useFlight(target, size.w);
  const tiles = tilesForView(view, size.w, size.h);
  // The pin rides with the map to the new camera (it is only centred once the flight lands).
  const pin = pointIn(view, target, size.w, size.h);
  return (
    <figure className="minimap" aria-label={`Map: ${label}`}>
      <div className="minimap-view" ref={ref}>
        {tiles.map((tl) => (
          <img key={tl.key} src={tl.url} alt="" draggable={false} className="minimap-tile" style={{ left: tl.left, top: tl.top, width: tl.size, height: tl.size }} />
        ))}
        <div className={`minimap-pin${approx ? " approx" : ""}`} style={{ left: pin.x, top: pin.y }} />
        <div className="minimap-reticle" />
        <div className="minimap-zoom">
          <button type="button" onClick={() => setZoom((z) => Math.min(18, z + 1))} aria-label={t.zoomIn}>+</button>
          <button type="button" onClick={() => setZoom((z) => Math.max(10, z - 1))} aria-label={t.zoomOut}>−</button>
        </div>
      </div>
      <figcaption>
        <span>
          {fmtLatLon(lat, lon)}{approx ? ` · ${t.approx}` : ""}
        </span>
        <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`} target="_blank" rel="noreferrer">
          {ATTRIBUTION}
        </a>
      </figcaption>
    </figure>
  );
}
