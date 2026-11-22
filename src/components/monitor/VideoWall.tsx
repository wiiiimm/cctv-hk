import { useEffect, useRef, useState } from "react";
import { arrange, publishGeometry } from "../../lib/arrange";
import { actions, bigAspect, feedCount, useStore, wallAspect } from "../../lib/store";
import { FocusPanel } from "../deck/FocusPanel";
import { Tile } from "./Tile";

export const WALL_GAP = 3;

/**
 * The central viewing surface. It always fills the stage: as many previews as fit at the user's preview size,
 * with the pinned video (if any) shown large beside or above them. It reports its capacity back to the store.
 */
export function VideoWall() {
  const { cells, selected, focused, muted, pinned, previewSize, pinMode, autoplay } = useStore((s) => s);
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const solo = focused;
  const count = useStore(feedCount);
  const aspect = useStore(wallAspect);
  const pinAspect = useStore(bigAspect);
  const layout = arrange({ w: area.w, h: area.h, previewW: previewSize, pinned, pinMode, solo, gap: WALL_GAP, count, aspect, pinAspect });
  // Portrait full view: the picture moves to the top and the camera panel uses the space below it.
  const soloInfo = solo && layout.rects[0] && area.h - layout.rects[0].h >= 160 && area.h > area.w;
  if (soloInfo) layout.rects[0] = { ...layout.rects[0], y: 0 };

  // Adopt the capacity (not while solo: the previews are just hidden, so keep them).
  // Report what the stage holds at this size (not just what a small group fills), so paging stays one screenful.
  const capacity = layout.capacity;
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
                // Live YouTube only (traffic / weather are unaffected): the pinned / full-view video always plays;
                // previews play muted when AUTOPLAY is on, else show a still + ▶. Only the big video has sound.
                allowVideo={big || autoplay}
                muted={muted || !big}
              />
            </div>
          );
        })}
      {soloInfo && (
        <div className="solo-info" style={{ top: layout.rects[0].h }}>
          <FocusPanel compact />
        </div>
      )}
    </div>
  );
}
