import { useEffect, useRef, useState } from "react";
import { ATTRIBUTION, tilesFor } from "../lib/maptiles";
import { useT } from "../lib/i18n";

interface Props {
  lat: number;
  lon: number;
  approx: boolean;
  label: string;
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

  const tiles = tilesFor(lat, lon, zoom, size.w, size.h);
  return (
    <figure className="minimap" aria-label={`Map: ${label}`}>
      <div className="minimap-view" ref={ref}>
        {tiles.map((t) => (
          <img key={t.key} src={t.url} alt="" draggable={false} className="minimap-tile" style={{ left: t.left, top: t.top }} />
        ))}
        <div className={`minimap-pin${approx ? " approx" : ""}`} />
        <div className="minimap-reticle" />
        <div className="minimap-zoom">
          <button type="button" onClick={() => setZoom((z) => Math.min(18, z + 1))} aria-label={t.zoomIn}>+</button>
          <button type="button" onClick={() => setZoom((z) => Math.max(10, z - 1))} aria-label={t.zoomOut}>−</button>
        </div>
      </div>
      <figcaption>
        <span>
          {lat.toFixed(5)}N {lon.toFixed(5)}E{approx ? ` · ${t.approx}` : ""}
        </span>
        <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`} target="_blank" rel="noreferrer">
          {ATTRIBUTION}
        </a>
      </figcaption>
    </figure>
  );
}
