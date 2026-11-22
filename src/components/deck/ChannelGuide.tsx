import { useDeferredValue, useMemo, useState } from "react";
import { CHANNELS, CHANNEL_BY_KEY, GROUPS, fmtNum, type Channel } from "../../lib/channels";
import { fuzzySearch } from "../../lib/search";
import { actionTarget, actions, groupKeysOf, store, useStore } from "../../lib/store";
import { chAltName, chDistrict, chName, groupLabel, useT } from "../../lib/i18n";
import { GroupMenu } from "./GroupMenu";
import { useListStatus, useListVideo } from "../../lib/snapshots";
import { GroupMap } from "./GroupMap";
import type { Lang } from "../../lib/store";

export function ChannelGuide({ onPick }: { onPick?: () => void }) {
  const groupId = useStore((s) => s.groupId);
  const favourites = useStore((s) => s.favourites);
  const customGroups = useStore((s) => s.customGroups);
  const [naming, setNaming] = useState<null | { mode: "new" } | { mode: "rename"; id: string }>(null);
  const [nameDraft, setNameDraft] = useState("");
  const current = groupId.startsWith("custom:") ? customGroups.find((g) => `custom:${g.id}` === groupId) : undefined;
  const onAir = useStore((s) => s.cells);
  const lang = useStore((s) => s.lang);
  const t = useT();
  const [q, setQ] = useState("");
  // List or map view of the group (remembered per browser).
  const [view, setView] = useState<"list" | "map">(() => {
    try {
      return localStorage.getItem("cctv-hk:guide-view") === "map" ? "map" : "list";
    } catch {
      return "list";
    }
  });
  const chooseView = (v: "list" | "map") => {
    setView(v);
    try {
      localStorage.setItem("cctv-hk:guide-view", v);
    } catch {
      /* ignore */
    }
  };
  const query = useDeferredValue(q.trim().toLowerCase());

  // Every channel matching the group / search; the list shows the first 400, the map shows them all.
  const matches = useMemo(() => {
    // Searching looks across every channel (fuzzy, best match first); otherwise show the group in order.
    if (query) return fuzzySearch(CHANNELS, query);
    return groupKeysOf({ groupId, favourites, customGroups }).map((k) => CHANNEL_BY_KEY.get(k)!);
  }, [query, groupId, favourites, customGroups]);
  const rows = useMemo(() => matches.slice(0, 400), [matches]);

  const other = (lang === "zh" ? "en" : "zh") as Lang;
  const section = (sec: string) => GROUPS.filter((g) => g.section === sec);
  const opt = (g: (typeof GROUPS)[number], indent = false) => (
    <option key={g.id} value={g.id}>
      {indent ? "\u00a0\u00a0\u00a0" : ""}
      {groupLabel(g, lang)} · {groupLabel(g, other)} ({g.keys.length})
    </option>
  );
  const submitName = () => {
    const name = nameDraft.trim();
    if (!name || !naming) return setNaming(null);
    if (naming.mode === "new") {
      const id = actions.createGroup(name);
      actions.loadGroup(`custom:${id}`);
    } else actions.renameGroup(naming.id, name);
    setNaming(null);
  };

  return (
    <section className="guide" aria-label={t.guide}>
      <div className="guide-head">
        <label className="field">
          <span>{t.cameraGroup}</span>
          <span className="group-pick">
            <select value={groupId} onChange={(e) => actions.loadGroup(e.target.value)}>
              <optgroup label={t.myGroups}>
                <option value="favourites">
                  {t.favourites} ({favourites.length})
                </option>
                {customGroups.map((g) => (
                  <option key={g.id} value={`custom:${g.id}`}>
                    ◆ {g.name} ({g.keys.length})
                  </option>
                ))}
              </optgroup>
              <optgroup label={t.topics}>{section("topic").map((g) => opt(g))}</optgroup>
              <optgroup label={t.feedTypes}>{section("type").map((g) => opt(g))}</optgroup>
              <optgroup label={t.newsGroups}>{section("news").map((g) => opt(g))}</optgroup>
              <optgroup label={t.youtubeGroups}>{section("youtube").map((g) => opt(g))}</optgroup>
              <optgroup label={t.regions}>
                {GROUPS.filter((g) => g.section === "region" || g.section === "district").map((g) => opt(g, g.section === "district"))}
              </optgroup>
            </select>
            <button
              type="button"
              className="icon-btn"
              title={t.newGroup}
              aria-label={t.newGroup}
              onClick={() => {
                setNameDraft("");
                setNaming({ mode: "new" });
              }}
            >
              +
            </button>
          </span>
        </label>
        {naming && (
          <form
            className="group-name"
            onSubmit={(e) => {
              e.preventDefault();
              submitName();
            }}
          >
            <input autoFocus className="search" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder={t.groupName} aria-label={t.groupName} onKeyDown={(e) => e.key === "Escape" && setNaming(null)} />
            <button type="submit" className="btn">
              {naming.mode === "new" ? t.create : t.save}
            </button>
          </form>
        )}
        {current && !naming && (
          <div className="group-tools">
            <button
              type="button"
              className="link"
              onClick={() => {
                setNameDraft(current.name);
                setNaming({ mode: "rename", id: current.id });
              }}
            >
              {t.rename}
            </button>
            <button type="button" className="link danger" onClick={() => window.confirm(t.deleteConfirm.replace("{name}", current.name)) && actions.deleteGroup(current.id)}>
              {t.delete}
            </button>
          </div>
        )}
        <div className="guide-search-row">
          <input className="search" type="search" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.searchLabel} />
          <span className="view-toggle" role="group" aria-label={t.guideView}>
            <button type="button" className={view === "list" ? "on" : ""} aria-pressed={view === "list"} onClick={() => chooseView("list")}>
              {t.listView}
            </button>
            <button type="button" className={view === "map" ? "on" : ""} aria-pressed={view === "map"} onClick={() => chooseView("map")}>
              {t.mapView}
            </button>
          </span>
        </div>
      </div>
      {view === "map" ? (
        <GroupMap keys={matches.map((c) => c.key)} fitKey={`${groupId}|${query}`} />
      ) : (
      <ul className="guide-list">
        {rows.map((c) => {
          const fav = favourites.includes(c.key);
          return (
            <li key={c.key} className={onAir.includes(c.key) ? "on-air" : ""} draggable onDragStart={(e) => e.dataTransfer.setData("text/x-channel", c.key)}>
              <button
                type="button"
                className="guide-row"
                onClick={() => {
                  actions.assign(actionTarget(store.get()), c.key);
                  onPick?.();
                }}
                title={t.assignTitle}
              >
                <span className="num">{fmtNum(c.num)}</span>
                <KindBadge c={c} />
                <span className="label">
                  <span className="nm">{chName(c, lang)}</span>
                  <span className="sub">
                    {chAltName(c, lang)} · {chDistrict(c, lang)}
                    {c.kind === "td" ? ` ${chDistrict(c, lang === "zh" ? "en" : "zh")}` : ""}
                  </span>
                  {c.follow && <NowTitle c={c} />}
                </span>
              </button>
              {c.kind === "yt" && <YouTubeLink c={c} />}
              {/* Add to my groups, then favourite. */}
              <GroupMenu chKey={c.key} compact />
              <button type="button" className={`fav${fav ? " on" : ""}`} onClick={() => actions.toggleFavourite(c.key)} aria-label={fav ? t.removeFav : t.addFav}>
                ★
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="empty">{current && !query ? t.emptyGroup : t.noMatch}</li>}
      </ul>
      )}
    </section>
  );
}

/** Row badge: traffic / weather show their type; video channels show what they're doing now (LIVE / REPLAY / OFF AIR). */
function KindBadge({ c }: { c: Channel }) {
  const t = useT();
  const status = useListStatus(c);
  if (c.kind !== "yt" || status === "unknown") return <span className={`kind kind-${c.kind}`}>{t.kind[c.kind]}</span>;
  const label = { live: t.live, replay: t.replay, offair: t.offAir, blocked: t.unavailableShort }[status];
  return <span className={`kind kind-yt st-${status}`}>{label}</span>;
}

/** Followed channels / recordings: the title of what's showing now (live stream or replay). */
function NowTitle({ c }: { c: Channel }) {
  const v = useListVideo(c);
  return v?.title ? <span className="sub now-title">▸ {v.title}</span> : null;
}

/** ↗ opens the exact video this row is showing on YouTube (new tab) — every video channel has one. */
function YouTubeLink({ c }: { c: Channel }) {
  const t = useT();
  const followed = useListVideo(c);
  // Followed channels / recordings: the video showing now. Fixed streams: their own video.
  const v = followed ?? (c.follow ? undefined : { id: c.code, title: undefined });
  if (!v) return null;
  return (
    <a className="fav yt-link" href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" title={v.title ? `${t.openOnYouTube}: ${v.title}` : t.openOnYouTube} aria-label={t.openOnYouTube}>
      ↗
    </a>
  );
}
