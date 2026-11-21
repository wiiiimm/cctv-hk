import { useEffect, useRef, useState } from "react";
import { fitWall } from "../../lib/layout";
import { useStore } from "../../lib/store";
import { Tile } from "./Tile";

const GAP = 3;

/** The central viewing surface: an n×m wall of 4:3 monitors, or one focused feed. */
export function VideoWall() {
  const { cols, rows, cells, selected, focused, muted } = useStore((s) => s);
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const single = focused || cells.length === 1;
  const shown = single ? [selected] : cells.map((_, i) => i);
  const c = single ? 1 : cols;
  const r = single ? 1 : rows;
  const allowVideo = single || cells.length <= 4;
  const fit = fitWall(area.w, area.h, c, r, GAP);

  return (
    <div className="wall-area" ref={ref}>
      {area.w > 0 && (
        <div
          className="wall"
          style={{
            left: fit.x,
            top: fit.y,
            width: fit.wallW,
            height: fit.wallH,
            padding: GAP,
            gap: GAP,
            gridTemplateColumns: `repeat(${c}, ${fit.cellW}px)`,
            gridTemplateRows: `repeat(${r}, ${fit.cellH}px)`,
          }}
        >
          {shown.map((i) => (
            <Tile
              key={single ? `focus-${i}` : i}
              index={i}
              channelKey={cells[i]}
              selected={!single && i === selected}
              large={single}
              allowVideo={allowVideo}
              muted={muted || !(single || i === selected)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
