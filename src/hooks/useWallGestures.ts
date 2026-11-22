import { useEffect, type RefObject } from "react";
import { actions, store } from "../lib/store";
import { PREVIEW_STEP } from "../lib/arrange";

/** Time of the last touch on the wall, so tiles can tell a finger tap from a mouse click (and skip dblclick). */
export let lastTouchAt = 0;

const SWIPE = 60; // px
const LONG_PRESS = 550; // ms

/**
 * Touch gestures on the wall (DOM and CRT alike). Mouse input is left alone.
 * - Swipe left / right: next / previous page (in full view: next / previous channel).
 * - Swipe down: one pin level down (full → pinned → previews → deselect).
 * - Long-press: select the tile under the finger and open its camera details.
 * - Pinch: preview size.
 */
export function useWallGestures(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
    let pinch: { d0: number; size0: number } | null = null;
    let press: ReturnType<typeof setTimeout> | undefined;
    let handled = false; // a gesture fired: swallow the click that follows

    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const swallowClick = () => {
      const stop = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, true), 400);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if ((e.target as HTMLElement).closest(".solo-info")) return; // the camera panel scrolls normally
      lastTouchAt = Date.now();
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: Date.now() });
      handled = false;
      clearTimeout(press);
      if (pts.size === 2) {
        pinch = { d0: dist(), size0: store.get().previewSize };
        return;
      }
      // Long-press: select what's under the finger, then open the camera details.
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, a")) return;
      press = setTimeout(() => {
        const p = pts.get(e.pointerId);
        if (!p || Math.hypot(p.x - p.x0, p.y - p.y0) > 10) return;
        handled = true;
        const idx = target.closest<HTMLElement>("[data-index]")?.dataset.index;
        if (idx != null) actions.select(+idx);
        window.dispatchEvent(new CustomEvent("cctv:open-sidebar"));
        navigator.vibrate?.(15);
      }, LONG_PRESS);
    };

    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pinch && pts.size === 2) {
        const size = Math.round((pinch.size0 * (dist() / pinch.d0)) / PREVIEW_STEP) * PREVIEW_STEP;
        if (size !== store.get().previewSize) actions.setPreviewSize(size);
        handled = true;
      }
    };

    const up = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      clearTimeout(press);
      if (!p) return;
      if (pinch) {
        if (pts.size < 2) pinch = null;
        if (handled) swallowClick();
        return;
      }
      if (handled) return swallowClick();
      const dx = p.x - p.x0;
      const dy = p.y - p.y0;
      if (Date.now() - p.t0 > 800) return;
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
        // Full view: previous / next channel. Wall: previous / next page.
        if (store.get().focused) actions.channelStep(dx < 0 ? 1 : -1);
        else actions.pageStep(dx < 0 ? 1 : -1);
        swallowClick();
      } else if (dy > SWIPE * 1.3 && dy > Math.abs(dx) * 1.5) {
        actions.deescalate();
        swallowClick();
      }
    };
    const cancel = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      clearTimeout(press);
      if (pts.size < 2) pinch = null;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      clearTimeout(press);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [ref]);
}
