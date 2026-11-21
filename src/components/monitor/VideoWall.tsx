import { useEffect, useRef, useState } from "react";
import { fitWall, slotRect, slots } from "../../lib/layout";
import { useStore } from "../../lib/store";
import { Tile } from "./Tile";

export const WALL_GAP = 3;

/** The central viewing surface: an n×m (or spotlight) wall of 4:3 monitors, or one focused feed. */
export function VideoWall() {
  const { cols, rows, span, cells, selected, focused, muted, pinned } = useStore((s) => s);
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const single = focused || cells.length === 1;
  const c = single ? 1 : cols;
  const r = single ? 1 : rows;
  const layout = single ? [{ col: 0, row: 0, span: 1 }] : slots(cols, rows, span);
  const shown = single ? [selected] : cells.map((_, i) => i);
  const allowVideo = single || cells.length <= 4;
  const fit = fitWall(area.w, area.h, c, r, WALL_GAP);

  return (
    <div className="wall-area" ref={ref}>
      {area.w > 0 &&
        shown.map((i, slot) => {
          const rect = slotRect(fit, layout[slot], WALL_GAP);
          const big = single || (span > 1 && i === 0);
          return (
            <div key={single ? `focus-${i}` : i} className="slot" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
              <Tile
                pinRole={focused ? "solo" : pinned && i === 0 ? "pinned" : !single && i === selected && !big ? "selected" : undefined}
                index={i}
                channelKey={cells[i]}
                // The pinned (big) video needs no selection highlight; small tiles still get one.
                selected={!single && i === selected && !big}
                large={big}
                allowVideo={allowVideo || big}
                muted={muted || !(single || i === selected)}
              />
            </div>
          );
        })}
    </div>
  );
}
