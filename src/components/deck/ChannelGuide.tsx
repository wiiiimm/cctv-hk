import { useDeferredValue, useMemo, useState } from "react";
import { CHANNEL_BY_KEY, GROUPS, fmtNum } from "../../lib/channels";
import { actions, groupKeysOf, store, useStore } from "../../lib/store";
import { chAltName, chDistrict, chName, groupLabel, useT } from "../../lib/i18n";
import type { Lang } from "../../lib/store";

export function ChannelGuide({ onPick }: { onPick?: () => void }) {
  const groupId = useStore((s) => s.groupId);
  const favourites = useStore((s) => s.favourites);
  const onAir = useStore((s) => s.cells);
  const lang = useStore((s) => s.lang);
  const t = useT();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());

  const rows = useMemo(() => {
    const keys = query ? [...CHANNEL_BY_KEY.keys()] : groupKeysOf({ groupId, favourites });
    return keys
      .map((k) => CHANNEL_BY_KEY.get(k)!)
      .filter(
        (c) =>
          !query ||
          String(c.num).includes(query) ||
          c.code.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          c.nameZh.includes(query) ||
          c.district.toLowerCase().includes(query) ||
          c.districtZh.includes(query),
      )
      .slice(0, 400);
  }, [query, groupId, favourites]);

  return (
    <aside className="guide" aria-label={t.guide}>
      <div className="guide-head">
        <label className="field">
          <span>{t.cameraGroup}</span>
          <select value={groupId} onChange={(e) => actions.loadGroup(e.target.value)}>
            <option value="favourites">
              {t.favourites} ({favourites.length})
            </option>
            {GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.id.startsWith("district:") ? "   " : ""}
                {groupLabel(g, lang)} · {groupLabel(g, (lang === "zh" ? "en" : "zh") as Lang)} ({g.keys.length})
              </option>
            ))}
          </select>
        </label>
        <input className="search" type="search" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.searchLabel} />
      </div>
      <ul className="guide-list">
        {rows.map((c) => {
          const fav = favourites.includes(c.key);
          return (
            <li key={c.key} className={onAir.includes(c.key) ? "on-air" : ""} draggable onDragStart={(e) => e.dataTransfer.setData("text/x-channel", c.key)}>
              <button
                type="button"
                className="guide-row"
                onClick={() => {
                  actions.assign(store.get().selected, c.key);
                  onPick?.();
                }}
                title={t.assignTitle}
              >
                <span className="num">{fmtNum(c.num)}</span>
                <span className={`kind kind-${c.kind}`}>{t.kind[c.kind]}</span>
                <span className="label">
                  <span className="nm">{chName(c, lang)}</span>
                  <span className="sub">
                    {chAltName(c, lang)} · {chDistrict(c, lang)}
                    {c.kind === "td" ? ` ${chDistrict(c, lang === "zh" ? "en" : "zh")}` : ""}
                  </span>
                </span>
              </button>
              <button type="button" className={`fav${fav ? " on" : ""}`} onClick={() => actions.toggleFavourite(c.key)} aria-label={fav ? t.removeFav : t.addFav}>
                ★
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="empty">{t.noMatch}</li>}
      </ul>
    </aside>
  );
}
