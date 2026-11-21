import { CHANNEL_BY_KEY, fmtNum } from "../../lib/channels";
import { useSnap } from "../../lib/snapshots";
import { actions, activeKey, useStore } from "../../lib/store";
import { chAltName, chDistrict, chName, chRegion, useT } from "../../lib/i18n";
import { ago, hkStamp, useClock } from "../../hooks/useClock";
import { MiniMap } from "../MiniMap";

export function FocusPanel() {
  const key = useStore(activeKey);
  const focused = useStore((s) => s.focused || s.cells.length === 1);
  const fav = useStore((s) => s.favourites.includes(key));
  const showMap = useStore((s) => s.showMap);
  const lang = useStore((s) => s.lang);
  const t = useT();
  const other = lang === "zh" ? "en" : "zh";
  const ch = CHANNEL_BY_KEY.get(key);
  const snap = useSnap(ch);
  const now = useClock();
  if (!ch) return null;

  const source = { td: t.srcTd, hko: t.srcHko, yt: t.srcYt }[ch.kind];
  const status =
    snap.status === "ok" ? (ch.kind === "yt" ? t.stLive : t.stOk) : { loading: t.stLoading, error: t.stError, offline: t.stOffline }[snap.status];

  return (
    <section className="panel" aria-label={t.selected}>
      <header className="panel-head">
        <span className="panel-tag">{focused ? t.focus : t.selected}</span>
        <span className="num">CH {fmtNum(ch.num)}</span>
        <span className={`kind kind-${ch.kind}`}>{t.kind[ch.kind]}</span>
      </header>
      <h2 className="panel-title">{chName(ch, lang)}</h2>
      <p className="panel-alt">{chAltName(ch, lang)}</p>
      <dl className="panel-meta">
        <dt>{t.code}</dt>
        <dd>{ch.code}</dd>
        <dt>{t.area}</dt>
        <dd>
          {chDistrict(ch, lang)} · {chRegion(ch, lang)}
          <span className="alt">
            {chDistrict(ch, other)} · {chRegion(ch, other)}
          </span>
        </dd>
        <dt>{t.source}</dt>
        <dd>{source}</dd>
        <dt>{t.status}</dt>
        <dd className={`st-${snap.status}`}>{status}</dd>
        {ch.kind !== "yt" && (
          <>
            <dt>{t.picture}</dt>
            <dd>{snap.takenAt ? `${hkStamp(snap.takenAt)} (+${ago(snap.takenAt, now)})` : "--"}</dd>
          </>
        )}
      </dl>
      <div className="panel-actions">
        <button type="button" onClick={() => actions.channelStep(-1)} title="PgDn / −">{t.chDown}</button>
        <button type="button" onClick={() => actions.channelStep(1)} title="PgUp / +">{t.chUp}</button>
        <button type="button" onClick={() => actions.toggleFocus()} title="Enter">
          {focused ? t.backToWall : t.focusBtn}
        </button>
        <button type="button" className={fav ? "on" : ""} onClick={() => actions.toggleFavourite(ch.key)} title="*" aria-label={fav ? t.removeFav : t.addFav}>
          ★
        </button>
      </div>
      {ch.geo ? (
        showMap && <MiniMap lat={ch.geo.lat} lon={ch.geo.lon} approx={ch.geo.approx} label={chName(ch, lang)} />
      ) : (
        <p className="panel-nogeo">{t.noGeo}</p>
      )}
    </section>
  );
}
