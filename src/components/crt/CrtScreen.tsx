import { useEffect, useRef, useState } from "react";
import { CHANNEL_BY_KEY, fmtNum, youtubeEmbed } from "../../lib/channels";
import { retain, useSnap } from "../../lib/snapshots";
import { actions, store, useStore } from "../../lib/store";
import { drawScreen } from "../../lib/crt/compositor";
import { fitWall } from "../../lib/layout";
import { CrtRenderer } from "../../lib/crt/renderer";
import { presetById } from "../../lib/crt/presets";
import { chName, useT } from "../../lib/i18n";
import { powerThunk, staticBurst } from "../../lib/audio";

/** Margin that keeps picture content clear of the curved, vignetted tube edge. */
const crtInset = (curvature: number) => 0.012 + curvature * 0.35;

/**
 * CRT picture mode for the main viewer: the same wall, composited into a 2D canvas and run through
 * the colour-CRT shader. It fills the stage in place of the DOM wall; panels around it are unchanged.
 */
export function CrtScreen() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const cells = useStore((s) => s.cells);
  const single = useStore((s) => s.focused || s.cells.length === 1);
  const selected = useStore((s) => s.selected);
  const muted = useStore((s) => s.muted);
  const lang = useStore((s) => s.lang);
  const preset = useStore((s) => s.crtPreset);
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
    const out = glRef.current!;
    const src = document.createElement("canvas");
    const ctx = src.getContext("2d")!;
    const renderer = CrtRenderer.create(out);
    document.fonts?.load("24px 'Fusion Pixel 12px Monospaced TC'", "香港閉路電視錄影直播").catch(() => {});
    document.fonts?.load("24px VT323", "CH0123").catch(() => {});
    setFallback(!renderer);

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

    // Warm-up: the picture opens from a line when CRT mode is switched on.
    let p = 0;
    if (!store.get().muted) powerThunk(true);
    let lastT = performance.now();
    let lastSwitch = store.get().switchedAt;
    let lastPreset = store.get().crtPreset;
    let presetAt = 0;
    const t0 = performance.now();

    const frame = (tm: number) => {
      const s = store.get();
      const now = Date.now();
      const dt = Math.min(0.1, (tm - lastT) / 1000);
      lastT = tm;
      if (s.switchedAt !== lastSwitch) {
        lastSwitch = s.switchedAt;
        if (!s.muted) staticBurst();
      }
      if (s.crtPreset !== lastPreset) {
        lastPreset = s.crtPreset;
        presetAt = now;
      }
      p = Math.min(1, p + dt / 0.7);

      const preset = presetById(s.crtPreset);
      const isSingle = s.focused || s.cells.length === 1;
      const ch = CHANNEL_BY_KEY.get(s.cells[s.selected]);
      drawScreen(
        ctx,
        src.width,
        src.height,
        {
          cells: s.cells,
          cols: s.cols,
          rows: s.rows,
          selected: s.selected,
          single: isSingle,
          entry: s.entry,
          switchedAt: s.switchedAt,
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
      const staticAmt = since < 260 ? 0.85 * (1 - since / 260) : 0;
      if (renderer) renderer.render(src, preset, (tm - t0) / 1000, staticAmt, p, dpr);
      else {
        const o = out.getContext("2d");
        if (o) {
          o.globalAlpha = p;
          o.drawImage(src, 0, 0, out.width, out.height);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const onPointer = (e: React.MouseEvent, dbl: boolean) => {
    const s = store.get();
    if (s.focused || s.cells.length === 1) {
      if (dbl) actions.unfocus();
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const m = crtInset(presetById(s.crtPreset).curvature);
    const fit = fitWall(r.width * (1 - m * 2), r.height * (1 - m * 2), s.cols, s.rows, 0);
    const cx = Math.floor(((e.clientX - r.left - r.width * m - fit.x) / fit.wallW) * s.cols);
    const cy = Math.floor(((e.clientY - r.top - r.height * m - fit.y) / fit.wallH) * s.rows);
    if (cx < 0 || cy < 0 || cx >= s.cols || cy >= s.rows) return;
    const i = cy * s.cols + cx;
    actions.select(i);
    if (dbl) actions.focus(i);
  };

  // A live YouTube stream can't go through WebGL; it plays in the focused 4:3 cell with CSS-only CRT effects.
  const inset = crtInset(presetById(preset).curvature);
  const cell = fitWall(size.w * (1 - inset * 2), size.h * (1 - inset * 2), 1, 1, 0);
  cell.x += size.w * inset;
  cell.y += size.h * inset;
  return (
    <div className={`crt-tube${fallback ? " no-gl" : ""}`} ref={wrapRef} onClick={(e) => onPointer(e, false)} onDoubleClick={(e) => onPointer(e, true)}>
      <canvas ref={glRef} className="crt-canvas" role="img" aria-label={activeCh ? `CH ${fmtNum(activeCh.num)} ${chName(activeCh, lang)}` : "CRT"} />
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
    </div>
  );
}
