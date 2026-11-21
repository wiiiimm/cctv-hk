import { useEffect, useRef, useState } from "react";
import { arrange, publishGeometry } from "../../lib/arrange";
import { actions, useStore } from "../../lib/store";
import { Tile } from "./Tile";

export const WALL_GAP = 3;

/**
 * The central viewing surface. It always fills the stage: as many previews as fit at the user's preview size,
 * with the pinned video (if any) shown large beside or above them. It reports its capacity back to the store.
 */
export function VideoWall() {
  const { cells, selected, focused, muted, pinned, previewSize, pinMode } = useStore((s) => s);
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const solo = focused;
  const layout = arrange({ w: area.w, h: area.h, previewW: previewSize, pinned, pinMode, solo, gap: WALL_GAP });

  // Adopt the capacity (not while solo: the previews are just hidden, so keep them).
  const capacity = layout.rects.length;
  useEffect(() => {
    if (!solo && capacity > 0) actions.setCapacity(capacity);
  }, [capacity, solo]);
  useEffect(() => {
    publishGeometry(solo ? [] : layout.rects.slice(0, cells.length));
  });

  const shown = solo ? [selected] : cells.map((_, i) => i).slice(0, layout.rects.length);

  return (
    <div
      className={`wall-area wall-${layout.kind}`}
      ref={ref}
      // Clicking empty space on the wall (not a tile) clears the selection.
      onClick={(e) => e.target === e.currentTarget && actions.deselect()}
    >
      {area.w > 0 &&
        shown.map((i, slot) => {
          const rect = layout.rects[slot];
          if (!rect) return null;
          const big = solo || (pinned && i === 0);
          return (
            <div key={solo ? `focus-${i}` : i} className="slot" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
              <Tile
                pinRole={solo ? "solo" : pinned && i === 0 ? "pinned" : i === selected && !big ? "selected" : undefined}
                index={i}
                channelKey={cells[i]}
                // The pinned (big) video needs no selection highlight; previews still get one.
                selected={!solo && i === selected && !big}
                large={big}
                // Live YouTube autoplays everywhere; previews are always muted, only the pinned / full video has sound.
                allowVideo
                muted={muted || !big}
              />
            </div>
          );
        })}
    </div>
  );
}
