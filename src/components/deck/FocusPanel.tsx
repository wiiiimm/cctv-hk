import { CHANNEL_BY_KEY, fmtNum } from "../../lib/channels";
import { useSnap } from "../../lib/snapshots";
import { actions, activeKey, useStore } from "../../lib/store";
import { chAltName, chDistrict, chName, chRegion, useT } from "../../lib/i18n";
import { ago, hkStamp, useClock } from "../../hooks/useClock";
import { MiniMap } from "../MiniMap";
import { PinModes, PinToggle } from "../PinButtons";
import { GroupMenu } from "./GroupMenu";

export function FocusPanel({ compact = false }: { compact?: boolean }) {
  const key = useStore(activeKey) ?? "";
  // A selected (not pinned) feed can be closed, which clears the selection.
  const closable = useStore((s) => s.selected >= 0 && !(s.pinned && s.selected === 0));
  const focused = useStore((s) => s.focused);
  const pinnedHere = useStore((s) => s.pinned && s.selected <= 0);
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
    snap.status === "ok" ? (ch.kind === "yt" ? (snap.replay ? t.stReplay : t.stLive) : t.stOk) : { loading: t.stLoading, error: t.stError, offline: t.stOffline }[snap.status];

  return (
    <section className={`panel${compact ? " compact" : ""}`} aria-label={t.selected}>
      <header className="panel-head">
        <span className="panel-tag">{focused ? t.solo : pinnedHere ? t.pinned : t.selected}</span>
        <span className="num">CH {fmtNum(ch.num)}</span>
        <span className={`kind kind-${ch.kind}`}>{t.kind[ch.kind]}</span>
        {closable && (
          <button type="button" className="panel-close" onClick={actions.deselect} title={t.closeInfo} aria-label={t.closeInfo}>
            ×
          </button>
        )}
      </header>
      <h2 className="panel-title">{snap.title ?? chName(ch, lang)}</h2>
      <p className="panel-alt">{snap.title ? `${chName(ch, lang)} · ${hkStamp(snap.takenAt ?? now)}` : chAltName(ch, lang)}</p>
      <dl className="panel-meta">
        {!compact && (
          <>
            <dt>{t.code}</dt>
            <dd>{ch.code}</dd>
          </>
        )}
        <dt>{t.area}</dt>
        <dd>
          {chDistrict(ch, lang)} · {chRegion(ch, lang)}
          <span className="alt">
            {chDistrict(ch, other)} · {chRegion(ch, other)}
          </span>
        </dd>
        {!compact && (
          <>
            <dt>{t.source}</dt>
            <dd>{source}</dd>
          </>
        )}
        <dt>{t.status}</dt>
        <dd className={`st-${snap.status}`}>
          {status}
          {compact && ch.kind !== "yt" && snap.takenAt ? <span className="age"> · +{ago(snap.takenAt, now)}</span> : null}
        </dd>
        {!compact && ch.kind !== "yt" && (
          <>
            <dt>{t.picture}</dt>
            <dd>{snap.takenAt ? `${hkStamp(snap.takenAt)} (+${ago(snap.takenAt, now)})` : "--"}</dd>
          </>
        )}
      </dl>
      {/* Row 1: channel down / up, half width each. */}
      <div className="panel-ch">
        <button type="button" className="btn" onClick={() => actions.channelStep(-1)} title="PgDn">{t.chDown}</button>
        <button type="button" className="btn" onClick={() => actions.channelStep(1)} title="PgUp">{t.chUp}</button>
      </div>
      {/* Row 2: everything that acts on this camera — pin + pinned sizes, favourite, add to my groups. */}
      <div className="panel-actions">
        <span className="pin-cluster" role="group" aria-label={t.pinModes}>
          <PinToggle />
          <PinModes />
        </span>
        {/* Favourite and groups sit at the right end of the row. */}
        <span className="panel-actions-end">
          <button type="button" className={`icon-btn${fav ? " on" : ""}`} onClick={() => actions.toggleFavourite(ch.key)} title="*" aria-label={fav ? t.removeFav : t.addFav} aria-pressed={fav}>
            ★
          </button>
          <GroupMenu chKey={ch.key} />
        </span>
      </div>
      {ch.geo ? (
        showMap && <MiniMap lat={ch.geo.lat} lon={ch.geo.lon} approx={ch.geo.approx} label={chName(ch, lang)} />
      ) : (
        <p className="panel-nogeo">{t.noGeo}</p>
      )}
    </section>
  );
}
