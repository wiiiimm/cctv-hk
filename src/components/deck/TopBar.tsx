import { useEffect, useRef, useState } from "react";
import { actions, store, useStore, type PatrolMode } from "../../lib/store";
import { viewLink } from "../../lib/urlState";
import { PRESETS } from "../../lib/crt/presets";
import { PREVIEW_MAX, PREVIEW_MIN, PREVIEW_STEP } from "../../lib/arrange";
import { useT } from "../../lib/i18n";
import { hkDate, hkTime, useClock } from "../../hooks/useClock";
import { useMedia } from "../../hooks/useMedia";
import { IconButton } from "../PinButtons";
import { BiggerIcon, SmallerIcon } from "../icons";

/** Below this width the top bar is one compact row; the rest of its controls move into the ⋯ panel. */
export const COMPACT_TOPBAR = "(max-width: 1099px)";

// ---- control groups, shared by the full bar and the ⋯ panel ----

function PreviewSize() {
  const t = useT();
  const previewSize = useStore((s) => s.previewSize);
  const previews = useStore((s) => Math.max(0, s.cells.length - (s.pinned ? 1 : 0)));
  return (
    <div className="tb-group preview-size" role="group" aria-label={t.previewSize}>
      <IconButton icon={<SmallerIcon />} label={t.smallerPreviews} onPress={() => actions.resizePreviews(-1)} />
      <input
        type="range"
        className="size-slider"
        min={PREVIEW_MIN}
        max={PREVIEW_MAX}
        step={PREVIEW_STEP}
        value={previewSize}
        onChange={(e) => actions.setPreviewSize(+e.target.value)}
        aria-label={t.previewSize}
        title={`${t.previewSize}: ${previews}`}
      />
      <IconButton icon={<BiggerIcon />} label={t.biggerPreviews} onPress={() => actions.resizePreviews(1)} />
      <span className="preview-count" title={t.previewCount}>
        {previews}
      </span>
    </div>
  );
}

function PatrolToggle() {
  const t = useT();
  const patrol = useStore((s) => s.patrol);
  return (
    <button type="button" className={`pill toggle${patrol ? " on rec" : ""}`} onClick={actions.togglePatrol} title={t.patrolTitle} aria-pressed={patrol}>
      {t.patrol}
    </button>
  );
}

function PatrolSettings() {
  const t = useT();
  const patrolSec = useStore((s) => s.patrolSec);
  const patrolMode = useStore((s) => s.patrolMode);
  return (
    <>
      <select value={patrolMode} onChange={(e) => actions.setPatrolMode(e.target.value as PatrolMode)} aria-label={t.patrolModeLabel} title={t.patrolModeTitle}>
        <option value="rolling">{t.patrolRolling}</option>
        <option value="page">{t.patrolPage}</option>
        <option value="pinned">{t.patrolPinned}</option>
      </select>
      <select value={patrolSec} onChange={(e) => actions.setPatrolSec(+e.target.value)} aria-label={t.patrolDwell}>
        {[5, 10, 15, 30, 60].map((s) => (
          <option key={s} value={s}>{s}s</option>
        ))}
      </select>
    </>
  );
}

function CrtToggle() {
  const t = useT();
  const crtOn = useStore((s) => s.mode === "crt");
  return (
    <button type="button" className={`pill crt${crtOn ? " on" : ""}`} onClick={actions.toggleMode} title={t.crtTitle} aria-pressed={crtOn}>
      {t.crt}
    </button>
  );
}

function PictureMode() {
  const t = useT();
  const crtOn = useStore((s) => s.mode === "crt");
  const crtPreset = useStore((s) => s.crtPreset);
  const lang = useStore((s) => s.lang);
  return (
    <select className={crtOn ? "" : "dim"} value={crtPreset} onChange={(e) => actions.setPreset(e.target.value)} aria-label={t.pictureMode} title={t.pictureMode}>
      {PRESETS.map((p) => (
        <option key={p.id} value={p.id}>{lang === "zh" ? p.labelZh : p.label}</option>
      ))}
    </select>
  );
}

function CurveToggle() {
  const t = useT();
  const curve = useStore((s) => s.crtCurve);
  const crtOn = useStore((s) => s.mode === "crt");
  return (
    <button type="button" className={`pill toggle${curve ? " on" : ""}${crtOn ? "" : " dim"}`} onClick={actions.toggleCurve} title={t.curveTitle} aria-pressed={curve}>
      {t.curve}
    </button>
  );
}

function AutoplayToggle() {
  const t = useT();
  const autoplay = useStore((s) => s.autoplay);
  return (
    <button type="button" className={`pill toggle${autoplay ? " on" : ""}`} onClick={actions.toggleAutoplay} title={t.autoplayTitle} aria-pressed={autoplay}>
      {t.autoplay}
    </button>
  );
}

function SoundToggle() {
  const t = useT();
  const muted = useStore((s) => s.muted);
  return (
    <button type="button" className={`pill toggle${!muted ? " on" : ""}`} onClick={actions.toggleMute} title={t.soundTitle} aria-pressed={!muted}>
      {muted ? t.muted : t.sound}
    </button>
  );
}

function NewsToggle() {
  const t = useT();
  const news = useStore((s) => s.news);
  return (
    <button type="button" className={`pill toggle${news ? " on" : ""}`} onClick={actions.toggleNews} title={t.newsTitle} aria-pressed={news}>
      {t.news}
    </button>
  );
}

function LangToggle() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  return (
    <button type="button" className="pill lang" onClick={actions.toggleLang} title={t.langTitle} lang={lang === "zh" ? "en" : "zh-Hant"}>
      {t.lang}
    </button>
  );
}

/** Share this exact view: the system share sheet on phones, else copy the link. */
function ShareButton() {
  const t = useT();
  const [done, setDone] = useState(false);
  const copied = () => {
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  const share = async () => {
    const url = viewLink(store.get());
    // Touch devices: the system share sheet (HTTPS only). Elsewhere: copy the link.
    if (navigator.share && window.isSecureContext && matchMedia("(hover: none)").matches) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user closed the sheet
      }
    }
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error("no async clipboard");
      await navigator.clipboard.writeText(url);
      copied();
    } catch {
      // Plain-HTTP pages (e.g. the dev server over Tailscale) have no async clipboard: copy via a hidden text box.
      const box = document.createElement("textarea");
      box.value = url;
      box.setAttribute("readonly", "");
      box.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      box.remove();
      if (ok) copied();
      else window.prompt(t.shareView, url); // last resort: show it to copy by hand
    }
  };
  return (
    <button type="button" className={`pill share${done ? " on" : ""}`} onClick={share} title={t.shareView}>
      {done ? t.linkCopied : t.share}
    </button>
  );
}

function Clock() {
  const t = useT();
  const now = useClock();
  return (
    <div className="clock" aria-label={t.hkt}>
      <span className="clock-date">{hkDate(now)}</span>
      <b>{hkTime(now)}</b>
      <span>{t.hkt}</span>
    </div>
  );
}

/** ⋯ panel for the compact top bar: everything that doesn't fit in the one row, in labelled sections. */
function MorePanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const out = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!ref.current?.contains(el) && !el.closest(".tb-more")) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("mousedown", out);
    window.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", out);
      window.removeEventListener("keydown", esc, true);
    };
  }, [onClose]);
  return (
    <div className="tb-sheet" ref={ref} role="dialog" aria-label={t.moreControls}>
      <div className="tb-sheet-row">
        <span className="tb-sheet-label">{t.previewSize}</span>
        <PreviewSize />
      </div>
      <div className="tb-sheet-row">
        <span className="tb-sheet-label">{t.patrol}</span>
        <div className="tb-group">
          <PatrolSettings />
        </div>
      </div>
      <div className="tb-sheet-row">
        <span className="tb-sheet-label">{t.pictureMode.replace(/\s*\(.*\)$/, "")}</span>
        <div className="tb-group">
          <PictureMode />
          <CurveToggle />
        </div>
      </div>
      <div className="tb-sheet-row">
        <div className="tb-group">
          <SoundToggle />
          <AutoplayToggle />
          <NewsToggle />
          <ShareButton />
        </div>
        <Clock />
      </div>
    </div>
  );
}

export function TopBar({ onGuide, sidebarShown = true }: { onGuide: () => void; sidebarShown?: boolean }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const compact = useMedia(COMPACT_TOPBAR);
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!compact) setMore(false);
  }, [compact]);

  return (
    <header className={`topbar${compact ? " compact" : ""}`}>
      <button
        type="button"
        className={`guide-toggle${sidebarShown ? " on" : ""}`}
        onClick={onGuide}
        aria-label={sidebarShown ? t.hideSidebar : t.showSidebar}
        title={`${sidebarShown ? t.hideSidebar : t.showSidebar} (T)`}
        aria-expanded={sidebarShown}
      >
        ☰
      </button>
      <div className="brand">
        <span className="brand-dot" />
        <b>{lang === "zh" ? "香港閉路電視" : "HK CCTV"}</b>
        <span className="brand-alt">{lang === "zh" ? "HK CCTV" : "香港閉路電視"}</span>
      </div>

      {compact ? (
        <div className="tb-compact-end">
          <PatrolToggle />
          <CrtToggle />
          {/* Language is always one tap away, even on the smallest screens. */}
          <LangToggle />
          <button
            type="button"
            className={`icon-btn tb-more${more ? " on" : ""}`}
            onClick={() => setMore((v) => !v)}
            aria-label={t.moreControls}
            title={t.moreControls}
            aria-expanded={more}
          >
            ⋯
          </button>
          {more && <MorePanel onClose={() => setMore(false)} />}
        </div>
      ) : (
        <>
          {/* Preview size: the wall fills the screen with as many previews as fit at this size. */}
          <PreviewSize />
          <div className="tb-group" role="group" aria-label={t.patrol}>
            <PatrolToggle />
            <PatrolSettings />
          </div>
          <div className="tb-group" role="group" aria-label={t.crtTitle}>
            <CrtToggle />
            <PictureMode />
            <CurveToggle />
          </div>
          <div className="tb-group">
            <SoundToggle />
            <AutoplayToggle />
            <NewsToggle />
            <LangToggle />
            <ShareButton />
          </div>
          <Clock />
        </>
      )}
    </header>
  );
}
