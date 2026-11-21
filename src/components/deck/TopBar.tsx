import { actions, useStore } from "../../lib/store";
import { PRESETS } from "../../lib/crt/presets";
import { PREVIEW_MAX, PREVIEW_MIN, PREVIEW_STEP } from "../../lib/arrange";
import { useT } from "../../lib/i18n";
import { hkDate, hkTime, useClock } from "../../hooks/useClock";
import { IconButton, PinModes, PinToggle } from "../PinButtons";
import { BiggerIcon, SmallerIcon } from "../icons";

export function TopBar({ onGuide }: { onGuide: () => void }) {
  const { previewSize, cells, pinned, patrol, patrolSec, muted, mode, crtPreset, lang, theater } = useStore((s) => s);
  const previews = Math.max(0, cells.length - (pinned ? 1 : 0));
  const t = useT();
  const now = useClock();
  const crtOn = mode === "crt";

  return (
    <header className="topbar">
      <button type="button" className="guide-toggle" onClick={onGuide} aria-label={t.guide}>☰</button>
      <div className="brand">
        <span className="brand-dot" />
        <b>{lang === "zh" ? "香港閉路電視" : "HK CCTV"}</b>
        <span className="brand-alt">{lang === "zh" ? "HK CCTV" : "香港閉路電視"}</span>
      </div>

      {/* Preview size: the wall fills the screen with as many previews as fit at this size. */}
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
        <PinToggle />
        <PinModes />
      </div>

      <div className="tb-group" role="group" aria-label={t.patrol}>
        <button type="button" className={`pill toggle${patrol ? " on rec" : ""}`} onClick={actions.togglePatrol} title={t.patrolTitle} aria-pressed={patrol}>
          {t.patrol}
        </button>
        <select value={patrolSec} onChange={(e) => actions.setPatrolSec(+e.target.value)} aria-label={t.patrolDwell}>
          {[5, 10, 15, 30, 60].map((s) => (
            <option key={s} value={s}>{s}s</option>
          ))}
        </select>
      </div>

      <div className="tb-group" role="group" aria-label={t.crtTitle}>
        <button type="button" className={`pill crt${crtOn ? " on" : ""}`} onClick={actions.toggleMode} title={t.crtTitle} aria-pressed={crtOn}>
          {t.crt}
        </button>
        <select className={crtOn ? "" : "dim"} value={crtPreset} onChange={(e) => actions.setPreset(e.target.value)} aria-label={t.pictureMode} title={t.pictureMode}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{lang === "zh" ? p.labelZh : p.label}</option>
          ))}
        </select>
      </div>

      <div className="tb-group">
        <button type="button" className={`pill toggle${theater ? " on" : ""}`} onClick={actions.toggleTheater} title={t.theaterTitle} aria-pressed={theater}>{t.theater}</button>
        <button type="button" className={`pill toggle${!muted ? " on" : ""}`} onClick={actions.toggleMute} title={t.soundTitle} aria-pressed={!muted}>
          {muted ? t.muted : t.sound}
        </button>
        <button type="button" className="pill lang" onClick={actions.toggleLang} title={t.langTitle} lang={lang === "zh" ? "en" : "zh-Hant"}>
          {t.lang}
        </button>
      </div>

      <div className="clock" aria-label={t.hkt}>
        <span>{hkDate(now)}</span>
        <b>{hkTime(now)}</b>
        <span>{t.hkt}</span>
      </div>
    </header>
  );
}

