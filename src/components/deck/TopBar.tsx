import { LAYOUTS, actions, hasPinnedVariant, pinnedLayout, useStore } from "../../lib/store";
import { PRESETS } from "../../lib/crt/presets";
import { slots } from "../../lib/layout";
import { useT } from "../../lib/i18n";
import { hkDate, hkTime, useClock } from "../../hooks/useClock";
import { PinToggle } from "../PinButtons";

function LayoutIcon({ c, r, sp }: { c: number; r: number; sp: number }) {
  return (
    <span className="lay-icon" style={{ gridTemplateColumns: `repeat(${c},1fr)`, gridTemplateRows: `repeat(${r},1fr)` }} aria-hidden>
      {slots(c, r, sp).map((s, i) => (
        <i key={i} className={s.span > 1 ? "big" : ""} style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: `${s.row + 1} / span ${s.span}` }} />
      ))}
    </span>
  );
}

export function TopBar({ onGuide }: { onGuide: () => void }) {
  const { gridCols, gridRows, pinned, focused, patrol, patrolSec, muted, mode, crtPreset, lang, theater } = useStore((s) => s);
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

      <div className="tb-group" role="group" aria-label={t.layout}>
        <div className="seg">
          <button type="button" className={`lay${focused ? " on" : ""}`} onClick={() => (focused ? actions.unfocus() : actions.focus())} title={t.soloTitle}>
            <LayoutIcon c={1} r={1} sp={0} />
          </button>
          {LAYOUTS.map(([c, r]) => {
            const [pc, pr, ps] = pinnedLayout(c, r);
            const on = !focused && c === gridCols && r === gridRows;
            return (
              <button key={`${c}x${r}`} type="button" className={`lay${on ? " on" : ""}`} onClick={() => actions.setLayout(c, r)} title={pinned ? `${c}×${r} · ${hasPinnedVariant(c, r) ? `${t.pinned} 1+${slots(pc, pr, ps).length - 1}` : t.solo}` : `${c}×${r}`}>
                {pinned && hasPinnedVariant(c, r) ? <LayoutIcon c={pc} r={pr} sp={ps} /> : <LayoutIcon c={c} r={r} sp={0} />}
              </button>
            );
          })}
        </div>
        <PinToggle />
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

