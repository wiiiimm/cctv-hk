import { useState } from "react";
import { LAYOUTS, actions, useStore } from "../../lib/store";
import { PRESETS } from "../../lib/crt/presets";
import { useT } from "../../lib/i18n";
import { hkDate, hkTime, useClock } from "../../hooks/useClock";

function LayoutIcon({ c, r }: { c: number; r: number }) {
  return (
    <span className="lay-icon" style={{ gridTemplateColumns: `repeat(${c},1fr)`, gridTemplateRows: `repeat(${r},1fr)` }} aria-hidden>
      {Array.from({ length: Math.min(c * r, 36) }, (_, i) => <i key={i} />)}
    </span>
  );
}

export function TopBar({ onGuide }: { onGuide: () => void }) {
  const { cols, rows, patrol, patrolSec, showMap, muted, mode, crtPreset, lang } = useStore((s) => s);
  const t = useT();
  const now = useClock();
  const [custom, setCustom] = useState(false);
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
        {LAYOUTS.map(([c, r]) => (
          <button key={`${c}x${r}`} type="button" className={`lay${c === cols && r === rows ? " on" : ""}`} onClick={() => actions.setLayout(c, r)} title={`${c}×${r}`}>
            <LayoutIcon c={c} r={r} />
          </button>
        ))}
        <button type="button" className={`lay txt${custom ? " on" : ""}`} onClick={() => setCustom((v) => !v)} title={t.custom}>
          n×m
        </button>
        {custom && (
          <span className="custom-lay">
            <input type="number" min={1} max={8} value={cols} onChange={(e) => actions.setLayout(clamp(+e.target.value), rows)} aria-label={t.columns} />
            ×
            <input type="number" min={1} max={8} value={rows} onChange={(e) => actions.setLayout(cols, clamp(+e.target.value))} aria-label={t.rows} />
          </span>
        )}
      </div>

      <div className="tb-group" role="group" aria-label={t.patrol}>
        <button type="button" className={`pill${patrol ? " on rec" : ""}`} onClick={actions.togglePatrol} title={t.patrolTitle}>
          {patrol ? `● ${t.patrol}` : t.patrol}
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
        <button type="button" className={`pill${showMap ? " on" : ""}`} onClick={actions.toggleMap} title={t.mapTitle}>{t.map}</button>
        <button type="button" className={`pill${!muted ? " on" : ""}`} onClick={actions.toggleMute} title={t.soundTitle}>
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

const clamp = (n: number) => Math.max(1, Math.min(8, Math.round(n) || 1));
