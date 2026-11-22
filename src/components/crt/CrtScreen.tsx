import { useEffect, useRef, useState } from "react";
import { usePlayerSlot } from "../../hooks/usePlayerSlot";
import { CHANNEL_BY_KEY, fmtNum, youtubeEmbed, MAX_PLAYING_PREVIEWS } from "../../lib/channels";
import { getSnap, retain, useSnap } from "../../lib/snapshots";
import { lastTouchAt } from "../../hooks/useWallGestures";
import { CRT_NEWS_H, useNews, type NewsItem } from "../../lib/news";
import { NewsTicker } from "../deck/NewsTicker";
import { flatCells, tickerCurves } from "../../lib/crt/flat";
import { actions, bigAspect, feedCount, isPatrolSwitch, store, useStore, wallAspect } from "../../lib/store";
import { drawScreen, mapInsetRect } from "../../lib/crt/compositor";
import { arrange, publishGeometry, type PinMode, type Rect } from "../../lib/arrange";
import { CrtRenderer, ON, powerOff, powerOn, unwarp } from "../../lib/crt/renderer";
import { crtCurvature, crtInset, presetById, setCrtCurve, videoFilter, type CrtPreset } from "../../lib/crt/presets";
import "./crt-video.css";
import { chName } from "../../lib/i18n";
import { powerThunk, staticBurst } from "../../lib/audio";
import { PinControls, pinnedVideoUrl } from "../monitor/PinControls";
import { useYouTubeErrors } from "../../hooks/useYouTubeErrors";

/** How long the live layers stay hidden: through the power-on sequence, and through a whole-wall static burst. */
const VEIL_POWER_MS = 1700;
const VEIL_SWITCH_MS = 900;

/** CSS variables that recreate a picture mode's look on top of a YouTube player. */
function videoLook(p: CrtPreset): React.CSSProperties {
  const [r, g, b] = p.tint.map((c) => Math.round(Math.min(1, c) * 255));
  return {
    ["--vfilter" as string]: videoFilter(p),
    ["--scan-a" as string]: String(0.12 + p.scanline * 0.4),
    ["--scan-p" as string]: p.scanCount > 420 ? "2px" : "3px",
    ["--mask-a" as string]: String(p.maskStrength * 0.6),
    ["--vig" as string]: String(p.vignette),
    ["--noise" as string]: String(Math.min(0.45, p.noise * 2.5)),
    ["--roll" as string]: String(Math.min(0.8, p.roll * 4)),
    ["--flicker" as string]: String(Math.min(0.2, p.flicker * 2.5)),
    ["--tint" as string]: `rgb(${r} ${g} ${b})`,
  };
}

/**
 * A live YouTube stream can't be drawn into WebGL, so it plays as a real player over its own CRT tile, with a
 * CSS version of the current picture mode on top (colour grade, scanlines, mask, vignette, grain, hum bar,
 * flicker, sweep) and a static burst when this tile changes channel. Renders nothing until the stream is live.
 */
function CrtYouTube({ chKey, rect, muted, big, preview, preset, switchedAt, veiled }: { chKey: string; rect: Rect; muted: boolean; big: boolean; preview: boolean; preset: CrtPreset; switchedAt: number; veiled: boolean }) {
  const ch = CHANNEL_BY_KEY.get(chKey);
  const snap = useSnap(ch, big);
  const lang = useStore((s) => s.lang);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Previews take turns to start and play at reduced quality (see usePlayerSlot / .lowq).
  const play = usePlayerSlot(!!ch && ch.kind === "yt" && !!snap.live, preview, `${chKey}|${snap.videoId ?? ""}`);
  useYouTubeErrors(frameRef, chKey, play, !muted, !!snap.live && !snap.replay);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!switchedAt || Date.now() - switchedAt > 400) return;
    setBurst(true);
    const tm = setTimeout(() => setBurst(false), 280);
    return () => clearTimeout(tm);
  }, [switchedAt]);
  if (!ch || ch.kind !== "yt" || !play) return null;
  return (
    <div className={`crt-video${big ? " big" : ""}${preview ? " lowq" : ""}${veiled ? " veiled" : ""}`} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...videoLook(preset) }}>
      <iframe ref={frameRef} src={youtubeEmbed(snap.videoId ?? ch.code, true, snap.replay ? snap.playlist : undefined)} title={chName(ch, lang)} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
      {preset.mono > 0 && <div className="cv-layer cv-glow" />}
      <div className="cv-layer cv-scan" />
      {preset.mask === 1 && <div className="cv-layer cv-grille" />}
      {(preset.mask === 2 || preset.mask === 3) && <div className="cv-layer cv-dots" />}
      {preset.noise > 0.04 && <div className="cv-layer cv-noise" />}
      {preset.roll > 0 && <div className="cv-layer cv-roll" />}
      {preset.flicker > 0.015 && <div className="cv-layer cv-flicker" />}
      {preset.sweep > 0 && <div className="cv-layer cv-sweep" />}
      <div className="cv-layer cv-vignette" />
      {burst && <div className="cv-layer cv-static" />}
      {/* Labels / badge / stamp for this tile are drawn on the flat overlay canvas above the players. */}
    </div>
  );
}

/**
 * Cells that play a live YouTube player in CRT mode — every visible YouTube tile that is actually live. Off-air /
 * unavailable streams are left to the canvas, which draws the OFF AIR screen like any other dead feed.
 */
function videoCells(s: { cells: string[]; pinned: boolean; focused: boolean; selected: number; autoplay: boolean }, shown: number): number[] {
  const isLiveYt = (key: string) => {
    const c = CHANNEL_BY_KEY.get(key);
    return c?.kind === "yt" && !c.noEmbed && !!getSnap(key).live; // no-embed channels stay a still on the canvas
  };
  if (s.focused) return isLiveYt(s.cells[s.selected]) ? [s.selected] : [];
  const out: number[] = [];
  // The pinned and the selected video always play; other previews only with AUTOPLAY on, and at most
  // MAX_PLAYING_PREVIEWS of them (else the canvas draws a still).
  let previews = 0;
  for (let i = 0; i < Math.min(shown, s.cells.length); i++) {
    if (!isLiveYt(s.cells[i])) continue;
    if ((s.pinned && i === 0) || i === s.selected) out.push(i);
    else if (s.autoplay && previews < MAX_PLAYING_PREVIEWS) {
      out.push(i);
      previews++;
    }
  }
  return out;
}

/** Which pin buttons to draw into the CRT picture, mirroring PinControls (pin toggle, then the three sizes). */
function pinButtons(s: { pinned: boolean; focused: boolean; selected: number; pinMode: string; cells: string[] }, hover: boolean) {
  const onPinned = s.focused || (s.pinned && s.selected <= 0);
  if (!onPinned) return { cell: s.selected, buttons: [{ icon: "pin" as const, on: false }], opacity: hover ? 1 : 0.7 };
  const cell = s.focused ? s.selected : 0;
  return {
    cell,
    buttons: [
      ...(pinnedVideoUrl(s.cells[cell]) ? [{ icon: "external" as const, on: false }] : []),
      { icon: "unpin" as const, on: true },
      { icon: "pinWide" as const, on: !s.focused && s.pinMode === "wide" },
      { icon: "pinSide" as const, on: !s.focused && s.pinMode === "side" },
      { icon: (s.focused ? "exitSolo" : "solo") as "exitSolo" | "solo", on: s.focused },
    ],
    opacity: hover ? 1 : 0,
  };
}

/** The CRT wall arrangement in CSS px of the tube (same engine as the DOM wall, inside the safe-area inset). */
function crtLayout(w: number, h: number, s: { previewSize: number; pinned: boolean; pinMode: PinMode; focused: boolean; crtPreset: string; count?: number; aspect?: number; pinAspect?: number; news?: boolean }): { rects: Rect[]; capacity: number } {
  const m = crtInset(crtCurvature(presetById(s.crtPreset)));
  const mx = w * m;
  // The news band sits across the top of the tube, inside the safe area; the wall starts below it.
  const band = s.news ? CRT_NEWS_H : 0;
  const my = h * m;
  const a = arrange({ w: w - mx * 2, h: h - my * 2 - band, previewW: s.previewSize, pinned: s.pinned, pinMode: s.pinMode, solo: s.focused, gap: s.focused ? 0 : 3, count: s.count, aspect: s.aspect, pinAspect: s.pinAspect });
  return { rects: a.rects.map((r) => ({ ...r, x: r.x + mx, y: r.y + my + band })), capacity: a.capacity };
}

/**
 * CRT picture mode for the main viewer: the same wall, composited into a 2D canvas and run through
 * the colour-CRT shader. It fills the stage in place of the DOM wall; panels around it are unchanged.
 */
export function CrtScreen({ exiting = false }: { exiting?: boolean }) {
  const exitingRef = useRef(exiting);
  exitingRef.current = exiting;
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const overHostRef = useRef<HTMLDivElement>(null);
  // Pointer over the tube: pinned / full-view buttons only show on hover (like the normal wall).
  const hoverRef = useRef(false);
  // Latest news for the frame loop (null = ticker off), and whether the ticker is the flat DOM one this frame.
  const newsRef = useRef<NewsItem[] | null>(null);
  const flatRef = useRef(false);
  // Veil: while the tube powers on (mount / refresh / entering CRT) or the whole wall changes (page, group, preset),
  // the live layers (YouTube players, flat overlay, flat ticker) are hidden and everything goes through the shader,
  // so the warm-up / static is seen in full; then the players fade in (they keep loading underneath meanwhile).
  const [veilUntil, setVeilUntil] = useState(() => Date.now() + VEIL_POWER_MS);
  const veilRef = useRef(true);
  const [fallback, setFallback] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const cells = useStore((s) => s.cells);
  const single = useStore((s) => s.focused || s.cells.length === 1);
  const selected = useStore((s) => s.selected);
  const muted = useStore((s) => s.muted);
  const lang = useStore((s) => s.lang);
  const preset = useStore((s) => s.crtPreset);
  const switchedAt = useStore((s) => s.switchedAt);
  const switchedCell = useStore((s) => s.switchedCell);
  const pin = {
    pinned: useStore((s) => s.pinned),
    focused: useStore((s) => s.focused),
    previewSize: useStore((s) => s.previewSize),
    pinMode: useStore((s) => s.pinMode),
  };
  const visible = single ? [cells[selected]] : cells;
  const activeCh = CHANNEL_BY_KEY.get(cells[selected]);

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
    // Flat OSD layer above the YouTube players (their labels / badges / pin buttons would be hidden under them).
    const ov = document.createElement("canvas");
    ov.className = "crt-overlay";
    const octx = ov.getContext("2d")!;
    overHostRef.current!.appendChild(ov);
    // Try WebGL on a fresh canvas; if the shader can't run, show the flat composited picture instead.
    const out = document.createElement("canvas");
    out.className = "crt-canvas";
    const renderer = CrtRenderer.create(out);
    document.fonts?.load("24px 'Fusion Pixel 12px Monospaced TC'", "香港監察網閉路電視錄影直播").catch(() => {});
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
      ov.width = src.width;
      ov.height = src.height;
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
        // The static sound is feedback for the viewer's own channel changes; patrol switches stay silent
        // (the picture still flashes static).
        if (!s.muted && !isPatrolSwitch(s.switchedAt)) staticBurst();
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
      const rects = drawScreen(
        ctx,
        src.width,
        src.height,
        {
          cells: s.cells,
          pinned: s.pinned,
          pinMode: s.pinMode,
          previewW: s.previewSize,
          selected: s.selected,
          single: isSingle,
          entry: s.entry,
          switchedAt: s.switchedAt,
          switchedCell: s.switchedCell,
          showMap: s.showMap,
          mapMini: s.mapMini,
          presetLabel: s.lang === "zh" ? preset.labelZh : preset.label,
          presetAt,
          patrol: s.patrol,
          // Tiles that play a real YouTube player on top are left blank on the canvas.
          videoCells: veilRef.current ? [] : videoCells(s, Number.MAX_SAFE_INTEGER),
          flatCells: veilRef.current ? [] : flatCells(s, Number.MAX_SAFE_INTEGER),
          pinUi: pinButtons(s, hoverRef.current),
          lang: s.lang,
          inset: crtInset(crtCurvature(preset)),
          count: feedCount(s),
          news: newsRef.current,
          flatTicker: flatRef.current && !veilRef.current,
          newsH: CRT_NEWS_H,
          aspect: wallAspect(s),
          pinAspect: bigAspect(s),
          scale: src.width / Math.max(1, wrap.clientWidth),
        },
        now,
        octx,
      );
      const since = now - s.switchedAt;
      // -2 (previews paged under a pinned video): the static is drawn into each preview by the compositor instead.
      let staticAmt = since < 260 && s.switchedCell !== -2 ? 0.85 * (1 - since / 260) : 0;
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
      ov.remove(); // the flat overlay too, or a remount (hot reload, leaving CRT) leaves its last frame stacked on top
    };
  }, []);

  const onPointer = (e: React.MouseEvent, dbl: boolean) => {
    const touch = Date.now() - lastTouchAt < 800;
    if (dbl && touch) return; // touch steps with second taps instead
    const s = store.get();
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    // The map inset on the pinned video: a click folds it to a small box, another click unfolds it.
    const m = mapInsetRect();
    if (m && px >= m.x && px < m.x + m.w && py >= m.y && py < m.y + m.h) {
      if (!dbl) actions.toggleMapMini();
      return;
    }
    if (s.focused) {
      if (dbl) actions.unfocus();
      return;
    }
    const i = crtLayout(r.width, r.height, { ...s, count: feedCount(s), aspect: wallAspect(s), pinAspect: bigAspect(s), news: s.news }).rects.findIndex((q) => px >= q.x && px < q.x + q.w && py >= q.y && py < q.y + q.h);
    if (i < 0) {
      if (!dbl) actions.deselect(); // empty part of the tube
      return;
    }
    if (dbl) actions.escalate(s.pinned && i > 0 ? 0 : i);
    else actions.tap(i, touch);
  };


  // Pin controls float over the selected tile (PIN) or the pinned video (SOLO / UNPIN), matching the CRT geometry.
  const count = useStore(feedCount);
  const newsOn = useStore((s) => s.news);
  const autoplay = useStore((s) => s.autoplay);
  // CURVE toggle: set before anything below asks for the curvature (layout, inset, click mapping, frame loop).
  const curveOn = useStore((s) => s.crtCurve);
  setCrtCurve(curveOn);
  const tubeInset = crtInset(crtCurvature(presetById(preset)));
  // Always listen (the burned-in road / weather readings come from the same poll); the ticker only when NEWS is on.
  const news = useNews(lang);
  newsRef.current = newsOn ? (news ?? []) : null;
  const aspect = useStore(wallAspect);
  const pinAspect = useStore(bigAspect);
  const crt = size.w > 0 ? crtLayout(size.w, size.h, { ...pin, crtPreset: preset, count, aspect, pinAspect, news: newsOn }) : { rects: [] as Rect[], capacity: 0 };
  const rects = crt.rects;
  // One rule for the ticker (lib/crt/flat.ts): it curves unless a flat (YouTube) tile sits in the top row.
  const flat = flatCells({ cells, focused: pin.focused, selected }, rects.length);
  // With CURVE off nothing is warped, so the ticker always goes through the shader (no mismatch possible).
  // Whole-wall change (switchedCell -1 with a new switchedAt): veil again for the static burst — but not for a
  // picture-mode change, which only changes the look (the players stay up).
  const lastPresetRef = useRef(preset);
  useEffect(() => {
    const presetChanged = lastPresetRef.current !== preset;
    lastPresetRef.current = preset;
    if (presetChanged) return;
    if (switchedCell === -1 && switchedAt && Date.now() - switchedAt < 500) setVeilUntil((v) => Math.max(v, switchedAt + VEIL_SWITCH_MS));
  }, [switchedAt, switchedCell, preset]);
  const [, lift] = useState(0);
  useEffect(() => {
    const left = veilUntil - Date.now();
    if (left <= 0) return;
    const tm = setTimeout(() => lift((n) => n + 1), left + 10);
    return () => clearTimeout(tm);
  }, [veilUntil]);
  const veiled = Date.now() < veilUntil;
  veilRef.current = veiled;
  const flatTicker = newsOn && curveOn && !veiled && !tickerCurves(flat, (i) => (pin.focused ? rects[0] : rects[i]), size.h * tubeInset + CRT_NEWS_H);
  flatRef.current = flatTicker;
  let controls: { role: "selected" | "pinned" | "solo"; index: number; x: number; y: number; w: number; h: number } | null = null;
  if (rects.length && (selected >= 0 || pin.pinned)) {
    const onPinned = pin.focused || (pin.pinned && selected <= 0);
    const index = onPinned ? 0 : selected;
    const role = pin.focused ? "solo" : onPinned ? "pinned" : "selected";
    const q = rects[pin.focused ? 0 : index] ?? rects[0];
    controls = { role, index, x: q.x, y: q.y, w: q.w, h: q.h };
  }
  // Follow the tube's barrel distortion: move (and slightly shrink) the buttons to where the curved picture puts
  // their spot in the tile. The buttons sit at the tile's bottom-right (see .pin-controls: right 8px, bottom 34px).
  let warp: React.CSSProperties = {};
  if (controls) {
    const cx = controls.x + controls.w - 8 - 30;
    const cy = controls.y + controls.h - 34 - 14;
    const o = unwarp(cx, cy, size.w, size.h, crtCurvature(presetById(preset)));
    warp = { ["--pin-dx" as string]: `${(o.x - cx).toFixed(1)}px`, ["--pin-dy" as string]: `${(o.y - cy).toFixed(1)}px`, ["--pin-scale" as string]: o.scale.toFixed(3) };
  }
  // Same capacity / navigation contract as the DOM wall.
  const capacity = crt.capacity;
  useEffect(() => {
    if (!pin.focused && capacity > 0) actions.setCapacity(capacity);
  }, [capacity, pin.focused]);
  useEffect(() => {
    publishGeometry(pin.focused ? [] : rects.slice(0, cells.length));
  });

  return (
    <div
      className={`crt-tube${fallback ? " no-gl" : ""}`}
      ref={wrapRef}
      onClick={(e) => onPointer(e, false)}
      onDoubleClick={(e) => onPointer(e, true)}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      <div ref={hostRef} className="crt-host" role="img" aria-label={activeCh ? `CH ${fmtNum(activeCh.num)} ${chName(activeCh, lang)}` : "CRT"} />
      {videoCells({ cells, pinned: pin.pinned, focused: pin.focused, selected, autoplay }, rects.length).map((i) => {
        const rect = pin.focused ? rects[0] : rects[i];
        if (!rect) return null;
        const big = pin.focused || (pin.pinned && i === 0);
        // Static burst on a YouTube tile: whole-wall change, its own retune, or a preview when the previews paged.
        const hit = switchedCell === -1 || switchedCell === i || (switchedCell === -2 && !(pin.pinned && i === 0));
        return (
          <CrtYouTube key={`${cells[i]}-${i}`} chKey={cells[i]} rect={rect} big={big} preview={!big && i !== selected} muted={muted || !(big || (!pin.pinned && !pin.focused && i === selected))} preset={presetById(preset)} switchedAt={hit ? switchedAt : 0} veiled={veiled} />
        );
      })}
      <div ref={overHostRef} className={`crt-overlay-host${veiled ? " veiled" : ""}`} aria-hidden />
      {flatTicker && size.w > 0 && (
        <NewsTicker
          crt
          style={{ left: size.w * tubeInset, top: size.h * tubeInset, width: size.w * (1 - 2 * tubeInset), height: CRT_NEWS_H - 3 }}
        />
      )}
      <div className="crt-glass" />
      {controls && (
        <div
          className={`crt-pin-anchor ${controls.role}`}
          // Same per-mode CSS look as the YouTube players, so the buttons read as part of the CRT picture.
          style={{ left: controls.x, top: controls.y, width: controls.w, height: controls.h, ...videoLook(presetById(preset)), ...warp }}
        >
          <PinControls role={controls.role} index={controls.index} />
        </div>
      )}
    </div>
  );
}
