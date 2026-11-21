import { memo } from "react";
import { CHANNEL_BY_KEY, fmtNum, youtubeEmbed } from "../../lib/channels";
import { useSnap } from "../../lib/snapshots";
import { actions, store, useStore } from "../../lib/store";
import { chAltName, chName, useT } from "../../lib/i18n";
import { PinControls, type PinRole } from "./PinControls";
import { ago, hkStamp, useClock } from "../../hooks/useClock";

interface Props {
  /** Which pin controls to show on this tile, if any. */
  pinRole?: PinRole;
  index: number;
  channelKey: string;
  selected: boolean;
  large: boolean;
  allowVideo: boolean;
  muted: boolean;
}

export const Tile = memo(function Tile({ pinRole, index, channelKey, selected, large, allowVideo, muted }: Props) {
  const ch = CHANNEL_BY_KEY.get(channelKey);
  const snap = useSnap(ch, large);
  const now = useClock();
  const t = useT();
  const lang = useStore((s) => s.lang);
  if (!ch) return <div className="tile" />;

  const isVideo = ch.kind === "yt";
  const playing = isVideo && allowVideo && snap.live;
  const noSignal = snap.status === "error" || snap.status === "offline";
  const stale = !isVideo && snap.takenAt && now - snap.takenAt > ch.refreshMs * 3;
  const name = chName(ch, lang);

  return (
    <div
      className={`tile${selected ? " selected" : ""}${large ? " large" : ""}`}
      // Pinned: clicking a small tile pins it instead. Double-click steps up a pin level (solo toggles back).
      onClick={() => (store.get().pinned && !store.get().focused ? actions.pin(index) : actions.select(index))}
      onDoubleClick={() => (store.get().focused ? actions.unfocus() : actions.escalate(index))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const key = e.dataTransfer.getData("text/x-channel");
        if (key) actions.assign(index, key);
      }}
      role="button"
      tabIndex={-1}
      aria-label={`CH ${fmtNum(ch.num)} ${name}`}
    >
      {playing ? (
        <iframe
          className="tile-media"
          src={youtubeEmbed(ch.code, muted)}
          title={name}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : snap.url && !noSignal ? (
        <img className="tile-media" src={snap.url} alt={name} draggable={false} />
      ) : null}

      {noSignal && (
        <div className="tile-nosignal">
          <span>{snap.status === "offline" ? t.offAir : t.noSignal}</span>
        </div>
      )}
      {snap.status === "loading" && (
        <div className="tile-nosignal searching">
          <span>{t.searching}</span>
        </div>
      )}

      {!(playing && large) && (
        <>
          <div className="osd osd-tl">
            <b>CH {fmtNum(ch.num)}</b> <span className={`kind kind-${ch.kind}`}>{t.kind[ch.kind]}</span>
          </div>
          <div className="osd osd-tr">
            {isVideo ? (
              snap.live ? <span className="badge">{t.live}</span> : null
            ) : (
              <span className={`badge${stale ? " stale" : ""}`}>{stale ? t.stale : t.rec}</span>
            )}
          </div>
          <div className="osd osd-bottom">
            <span className="osd-title">
              <span className="osd-name">{name}</span>
              <span className="osd-alt">{chAltName(ch, lang)}</span>
            </span>
            <span className="osd-stamp">
              {isVideo ? hkStamp(now) : snap.takenAt ? hkStamp(snap.takenAt) : "--"}
              {!isVideo && snap.takenAt ? <span className="age"> +{ago(snap.takenAt, now)}</span> : null}
            </span>
          </div>
        </>
      )}
      {isVideo && !playing && snap.live && <div className="tile-play">▶</div>}
      {pinRole && <PinControls role={pinRole} index={index} />}
      {/* Selection indicator: drawn above the picture (an outline on the tile itself sits underneath it). */}
      {selected && (
        <div className="tile-sel" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
});
