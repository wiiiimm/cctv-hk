import { useEffect, useRef, useState } from "react";
import { useMedia } from "../../hooks/useMedia";
import { arrange, publishGeometry } from "../../lib/arrange";
import { actions, bigAspect, feedCount, useStore, wallAspect } from "../../lib/store";
import { CHANNEL_BY_KEY, MAX_PLAYING_PREVIEWS } from "../../lib/channels";
import { FocusPanel } from "../deck/FocusPanel";
import { Tile } from "./Tile";

export const WALL_GAP = 3;

/**
 * The central viewing surface. It always fills the stage: as many previews as fit at the user's preview size,
 * with the pinned video (if any) shown large beside or above them. It reports its capacity back to the store.
 */
export function VideoWall() {
  const { cells, selected, focused, muted, pinned, previewSize, pinMode, autoplay, theater } = useStore((s) => s);
  // The sidebar (and its map) is hidden in theatre mode, and is a closed drawer on narrow screens.
  const narrow = useMedia("(max-width: 1180px)");
  const sidebarHidden = theater || narrow;
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
  // Which previews may play: the first MAX_PLAYING_PREVIEWS video previews in wall order (pinned / selected always do).
  const playable = new Set<number>();
  for (const i of shown) {
    if (playable.size >= MAX_PLAYING_PREVIEWS) break;
    if (CHANNEL_BY_KEY.get(cells[i])?.kind === "yt" && !(pinned && i === 0) && i !== selected) playable.add(i);
  }

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
                // previews play muted when AUTOPLAY is on, else show a still + ▶ — except the selected one, which plays.
                // One video has sound (see `muted` below).
                allowVideo={big || i === selected || (autoplay && playable.has(i))}
                mapOnTile={sidebarHidden}
                // Sound goes to one video: the pinned / full-view one, or with nothing pinned the selected preview.
                muted={muted || !(big || (!pinned && !solo && i === selected))}
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
