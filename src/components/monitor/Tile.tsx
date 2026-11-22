import { memo, useRef } from "react";
import { BurnLines } from "../BurnIn";
import { burnIn } from "../../lib/burnin";
import { useNews } from "../../lib/news";
import { TileMap } from "../MiniMap";
import { usePlayerSlot } from "../../hooks/usePlayerSlot";
import { CHANNEL_BY_KEY, fmtNum, youtubeEmbed } from "../../lib/channels";
import { useSnap } from "../../lib/snapshots";
import { actions, store, useStore } from "../../lib/store";
import { chAltName, chName, useT, chDistrict } from "../../lib/i18n";
import { PinControls, type PinRole } from "./PinControls";
import { ago, hkStamp, hkTime, useClock } from "../../hooks/useClock";
import "./osd.css";
import { useYouTubeErrors } from "../../hooks/useYouTubeErrors";
import { lastTouchAt } from "../../hooks/useWallGestures";

interface Props {
  /** Which pin controls to show on this tile, if any. */
  pinRole?: PinRole;
  index: number;
  channelKey: string;
  selected: boolean;
  large: boolean;
  allowVideo: boolean;
  /** Draw the map inset on this (pinned / full-view) tile — when the sidebar with its map is hidden. */
  mapOnTile?: boolean;
  muted: boolean;
}

export const Tile = memo(function Tile({ pinRole, index, channelKey, selected, large, allowVideo, muted, mapOnTile = false }: Props) {
  const ch = CHANNEL_BY_KEY.get(channelKey);
  const snap = useSnap(ch, large);
  const now = useClock();
  const t = useT();
  const lang = useStore((s) => s.lang);
  const showMap = useStore((s) => s.showMap);
  useNews(lang); // keeps the road / weather readings fresh (shared poller)
  const burn = ch ? burnIn(ch, lang, large) : [];
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Previews (not the pinned / full-view or selected video) start one after another and play at reduced quality.
  const preview = !large && !selected;
  const willPlay = usePlayerSlot(ch?.kind === "yt" && !ch.noEmbed && allowVideo && !!snap.live, preview, `${channelKey}|${snap.videoId ?? ""}`);
  // Players load muted (autoplay is allowed); the hook starts playback and unmutes the one that should have sound.
  useYouTubeErrors(frameRef, channelKey, willPlay, !muted, !!snap.live && !snap.replay);
  if (!ch) return <div className="tile" />;

  const isVideo = ch.kind === "yt";
  const playing = willPlay;
  const noSignal = snap.status === "error" || snap.status === "offline";
  const stale = !isVideo && snap.takenAt && now - snap.takenAt > ch.refreshMs * 3;
  // Recording slots show the recording's own title, with the slot name ("無綫新聞 重溫 1") as the second line.
  const name = snap.title ?? chName(ch, lang);

  return (
    <div
      className={`tile${selected ? " selected" : ""}${large ? " large" : ""}`}
      // Pinned: clicking a small tile pins it instead. Double-click steps up a pin level (solo toggles back).
      onClick={(e) => {
        const touch = (e.nativeEvent as PointerEvent).pointerType === "touch" || Date.now() - lastTouchAt < 600;
        if (store.get().focused) return;
        actions.tap(index, touch);
      }}
      // Touch has its own second-tap step (see actions.tap); a finger double-tap must not step twice.
      onDoubleClick={() => {
        if (Date.now() - lastTouchAt < 800) return;
        if (store.get().focused) actions.unfocus();
        else actions.escalate(index);
      }}
      data-index={index}
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
          ref={frameRef}
          className={`tile-media${preview ? " lowq" : ""}`}
          src={youtubeEmbed(snap.videoId ?? ch.code, true, snap.replay ? snap.playlist : undefined)}
          title={name}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          tabIndex={-1}
        />
      ) : snap.url && !noSignal ? (
        <img className="tile-media" src={snap.url} alt={name} draggable={false} />
      ) : null}

      {noSignal && (
        <div className="tile-nosignal">
          {snap.reason === "blocked" ? (
            <>
              <span>{t.unavailable}</span>
              <small>{t.maybeRegion}</small>
            </>
          ) : (
            <span>{snap.status === "offline" ? t.offAir : t.noSignal}</span>
          )}
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
          <BurnLines lines={burn} className="osd osd-burn" />
          <div className="osd osd-tr">
            {isVideo ? (
              snap.live ? <span className={`badge${snap.replay ? " replay" : ""}`}>{snap.replay ? t.replay : t.live}</span> : null
            ) : (
              <span className={`badge${stale ? " stale" : ""}`}>{stale ? t.stale : t.rec}</span>
            )}
          </div>
          <div className="osd osd-bottom">
            <span className="osd-title">
              <span className="osd-name">{name}</span>
              <span className="osd-alt">{snap.title ? chName(ch, lang) : chAltName(ch, lang)}</span>
              {/* Phones: area + picture time inside the caption block (the separate stamp is hidden there). */}
              <span className="osd-meta">
                {chDistrict(ch, lang)} · {isVideo ? hkTime(now) : snap.takenAt ? hkTime(snap.takenAt) : "--"}
                {!isVideo && snap.takenAt ? <span className="age"> +{ago(snap.takenAt, now)}</span> : null}
              </span>
            </span>
            <span className="osd-stamp">
              {isVideo && !(snap.replay && snap.title && snap.takenAt) ? hkStamp(now) : snap.takenAt ? hkStamp(snap.takenAt) : "--"}
              {!isVideo && snap.takenAt ? <span className="age"> +{ago(snap.takenAt, now)}</span> : null}
            </span>
          </div>
        </>
      )}
      {isVideo && !playing && snap.live && !ch.noEmbed && <div className="tile-play">▶</div>}
      {/* Owner blocks playback on other sites: offer the video on YouTube instead of a player. */}
      {isVideo && ch.noEmbed && snap.videoId && (
        <a
          className="tile-yt-link"
          href={`https://www.youtube.com/watch?v=${snap.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          title={t.watchOnYouTubeTitle}
        >
          {t.watchOnYouTube}
        </a>
      )}
      {large && mapOnTile && showMap && ch.geo && <TileMap lat={ch.geo.lat} lon={ch.geo.lon} approx={ch.geo.approx} video={isVideo} top={34 + burn.length * 22} />}
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
