import { useEffect, useRef, useState } from "react";
import { CHANNEL_BY_KEY, fmtNum, youtubeEmbed } from "../../lib/channels";
import { retain, useSnap } from "../../lib/snapshots";
import { actions, store, useStore } from "../../lib/store";
import { drawScreen } from "../../lib/crt/compositor";
import { fitWall, slotRect, slots } from "../../lib/layout";
import { CrtRenderer, ON, powerOff, powerOn } from "../../lib/crt/renderer";
import { crtInset, presetById } from "../../lib/crt/presets";
import { chName, useT } from "../../lib/i18n";
import { powerThunk, staticBurst } from "../../lib/audio";
import { PinControls } from "../monitor/PinControls";

/**
 * CRT picture mode for the main viewer: the same wall, composited into a 2D canvas and run through
 * the colour-CRT shader. It fills the stage in place of the DOM wall; panels around it are unchanged.
 */
export function CrtScreen({ exiting = false }: { exiting?: boolean }) {
  const exitingRef = useRef(exiting);
  exitingRef.current = exiting;
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const cells = useStore((s) => s.cells);
  const single = useStore((s) => s.focused || s.cells.length === 1);
  const selected = useStore((s) => s.selected);
  const muted = useStore((s) => s.muted);
  const lang = useStore((s) => s.lang);
  const preset = useStore((s) => s.crtPreset);
  const pin = {
    pinned: useStore((s) => s.pinned),
    focused: useStore((s) => s.focused),
    cols: useStore((s) => s.cols),
    rows: useStore((s) => s.rows),
    span: useStore((s) => s.span),
  };
  const t = useT();
  const visible = single ? [cells[selected]] : cells;
  const activeCh = CHANNEL_BY_KEY.get(cells[selected]);
  const activeSnap = useSnap(single ? activeCh : undefined, true);
  const ytLive = single && activeCh?.kind === "yt" && activeSnap.live;

  // Keep every visible feed polling while it is on screen.
  const visibleSig = visible.join("|");
  useEffect(() => {
    const releases = visible.map((k) => retain(k, single));
    return () => releases.forEach((r) => r());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSig, single]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const src = document.createElement("canvas");
    const ctx = src.getContext("2d")!;
    // Try WebGL on a fresh canvas; if the shader can't run, show the flat composited picture instead.
    const out = document.createElement("canvas");
    out.className = "crt-canvas";
    const renderer = CrtRenderer.create(out);
    document.fonts?.load("24px 'Fusion Pixel 12px Monospaced TC'", "香港閉路電視錄影直播").catch(() => {});
    document.fonts?.load("24px VT323", "CH0123").catch(() => {});
    setFallback(!renderer);
    const display = renderer ? out : src;
    if (!renderer) src.className = "crt-canvas";
    hostRef.current!.appendChild(display);

    let raf = 0;
    let dpr = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      out.width = Math.max(2, Math.round(r.width * dpr));
      out.height = Math.max(2, Math.round(r.height * dpr));
      const scale = Math.min(1.5, dpr);
      src.width = Math.max(2, Math.round(r.width * scale));
      src.height = Math.max(2, Math.round(r.height * scale));
      setSize({ w: r.width, h: r.height });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // Power sequence clocks (seconds, from performance.now()).
    let onAt = performance.now();
    let offAt = 0;
    if (!store.get().muted) powerThunk(true);
    let lastSwitch = store.get().switchedAt;
    let lastPreset = store.get().crtPreset;
    let presetAt = 0;
    const t0 = performance.now();

    let failed = false;
    const frame = (tm: number) => {
      // Never let one bad frame kill the loop; log the first failure.
      raf = requestAnimationFrame(frame);
      try {
        draw(tm);
      } catch (err) {
        if (!failed) console.error("CRT frame failed", err);
        failed = true;
      }
    };
    const draw = (tm: number) => {
      const s = store.get();
      const now = Date.now();
      if (s.switchedAt !== lastSwitch) {
        lastSwitch = s.switchedAt;
        if (!s.muted) staticBurst();
      }
      if (s.crtPreset !== lastPreset) {
        lastPreset = s.crtPreset;
        presetAt = now;
      }
      if (exitingRef.current && !offAt) {
        offAt = tm;
        if (!s.muted) powerThunk(false);
      } else if (!exitingRef.current && offAt) {
        // Switched back on mid-shutdown: run the warm-up again.
        offAt = 0;
        onAt = tm;
        if (!s.muted) powerThunk(true);
      }
      let fx = offAt ? powerOff((tm - offAt) / 1000) : tm - onAt < 1600 ? powerOn((tm - onAt) / 1000) : ON;
      // Dev aid: window.__crtFx = { on: true, t: 0.2 } freezes the power sequence at that moment.
      const dbg = import.meta.env.DEV ? (window as unknown as { __crtFx?: { on: boolean; t: number } }).__crtFx : undefined;
      if (dbg) fx = dbg.on ? powerOn(dbg.t) : powerOff(dbg.t);

      const preset = presetById(s.crtPreset);
      const isSingle = s.focused || s.cells.length === 1;
      const ch = CHANNEL_BY_KEY.get(s.cells[s.selected]);
      const rects = drawScreen(
        ctx,
        src.width,
        src.height,
        {
          cells: s.cells,
          cols: s.cols,
          rows: s.rows,
          span: s.span,
          selected: s.selected,
          single: isSingle,
          entry: s.entry,
          switchedAt: s.switchedAt,
          switchedCell: s.switchedCell,
          showMap: s.showMap,
          presetLabel: s.lang === "zh" ? preset.labelZh : preset.label,
          presetAt,
          patrol: s.patrol,
          hideMedia: isSingle && ch?.kind === "yt",
          lang: s.lang,
          inset: crtInset(preset.curvature),
          scale: src.width / Math.max(1, wrap.clientWidth),
        },
        now,
      );
      const since = now - s.switchedAt;
      let staticAmt = since < 260 ? 0.85 * (1 - since / 260) : 0;
      // Dev aid: window.__crtSw = 0.85 holds the channel-change static at that strength.
      const dbgSw = import.meta.env.DEV ? (window as unknown as { __crtSw?: number }).__crtSw : undefined;
      if (dbgSw != null) staticAmt = dbgSw;
      // Confine the switch to the frame that changed (the spotlight, or the retuned tile); else the whole tube.
      const cell = isSingle ? undefined : rects.get(s.switchedCell);
      const rect: [number, number, number, number] = cell
        ? [cell.x / src.width, cell.y / src.height, (cell.x + cell.w) / src.width, (cell.y + cell.h) / src.height]
        : [0, 0, 1, 1];
      if (renderer) renderer.render(src, preset, (tm - t0) / 1000, staticAmt, rect, fx, dpr);
      else display.style.opacity = String(offAt ? 0 : Math.min(1, fx.ys));
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      display.remove();
    };
  }, []);

  const onPointer = (e: React.MouseEvent, dbl: boolean) => {
    const s = store.get();
    if (s.focused) {
      if (dbl) actions.unfocus();
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const m = crtInset(presetById(s.crtPreset).curvature);
    const fit = fitWall(r.width * (1 - m * 2), r.height * (1 - m * 2), s.cols, s.rows, 0);
    const px = e.clientX - r.left - r.width * m;
    const py = e.clientY - r.top - r.height * m;
    const i = slots(s.cols, s.rows, s.span).findIndex((sl) => {
      const q = slotRect(fit, sl, 0);
      return px >= q.x && px < q.x + q.w && py >= q.y && py < q.y + q.h;
    });
    if (i < 0) return;
    if (dbl) actions.escalate(s.pinned && i > 0 ? 0 : i);
    else if (s.pinned) actions.pin(i);
    else actions.select(i);
  };


  // A live YouTube stream can't go through WebGL; it plays in the focused 4:3 cell with CSS-only CRT effects.
  const inset = crtInset(presetById(preset).curvature);
  const cell = fitWall(size.w * (1 - inset * 2), size.h * (1 - inset * 2), 1, 1, 0);
  cell.x += size.w * inset;
  cell.y += size.h * inset;
  // Pin controls float over the selected tile (PIN) or the pinned video (SOLO / UNPIN), matching the CRT geometry.
  let controls: { role: "selected" | "pinned" | "solo"; index: number; x: number; y: number; w: number; h: number } | null = null;
  if (size.w > 0) {
    const gap = pin.focused ? 0 : Math.max(2, Math.round(size.w / 400));
    const fit = fitWall(size.w * (1 - inset * 2), size.h * (1 - inset * 2), pin.focused ? 1 : pin.cols, pin.focused ? 1 : pin.rows, gap);
    const layout = pin.focused ? [{ col: 0, row: 0, span: 1 }] : slots(pin.cols, pin.rows, pin.span);
    const onPinned = pin.focused || (pin.pinned && selected === 0);
    const index = onPinned ? 0 : selected;
    const role = pin.focused ? "solo" : onPinned ? "pinned" : "selected";
    const q = slotRect(fit, layout[index] ?? layout[0], gap);
    controls = { role, index, x: q.x + size.w * inset, y: q.y + size.h * inset, w: q.w, h: q.h };
  }

  return (
    <div className={`crt-tube${fallback ? " no-gl" : ""}`} ref={wrapRef} onClick={(e) => onPointer(e, false)} onDoubleClick={(e) => onPointer(e, true)}>
      <div ref={hostRef} className="crt-host" role="img" aria-label={activeCh ? `CH ${fmtNum(activeCh.num)} ${chName(activeCh, lang)}` : "CRT"} />
      {ytLive && activeCh && (
        <div className="crt-video" style={{ left: cell.x, top: cell.y, width: cell.wallW, height: cell.wallH }}>
          <iframe src={youtubeEmbed(activeCh.code, muted)} title={chName(activeCh, lang)} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
          <div className="crt-video-fx" />
          <div className="crt-video-osd">
            <span>
              CH {fmtNum(activeCh.num)} {t.stLive}
            </span>
            <span>{chName(activeCh, lang)}</span>
          </div>
        </div>
      )}
      <div className="crt-glass" />
      {controls && (
        <div className={`crt-pin-anchor ${controls.role}`} style={{ left: controls.x, top: controls.y, width: controls.w, height: controls.h }}>
          <PinControls role={controls.role} index={controls.index} />
        </div>
      )}
    </div>
  );
}
