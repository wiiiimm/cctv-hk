import { CHANNELS, fmtNum, GROUP_BY_ID } from "../../lib/channels";
import { groupKeysOf, useStore } from "../../lib/store";
import { groupLabel, useT } from "../../lib/i18n";

export function StatusBar() {
  const s = useStore((x) => x);
  const t = useT();
  const keys = groupKeysOf(s);
  const n = Math.max(1, s.cells.length - (s.pinned ? 1 : 0));
  const pages = Math.max(1, Math.ceil(keys.length / n));
  const g = GROUP_BY_ID.get(s.groupId);
  const group = s.groupId === "favourites" ? t.favourites : g ? groupLabel(g, s.lang) : "";

  return (
    <footer className="statusbar">
      <span>
        {t.group} <b>{group}</b> · {t.page} <b>{(s.page % pages) + 1}/{pages}</b> · {s.focused ? t.solo : s.pinned ? `${t.pinned} + ${s.cells.length - 1} ${t.previewsWord}` : `${s.cells.length} ${t.previewsWord}`}
      </span>
      {s.entry && (
        <span className="entry">
          {t.tune} <b>{fmtNum(Number(s.entry))}</b>_
        </span>
      )}
      <span className="keys">
        {t.keys.map(([k, label]) => (
          <span key={k}>
            <kbd>{k}</kbd> {label}
          </span>
        ))}
      </span>
      <span className="credit">
        {CHANNELS.length} {t.feeds} · {t.credit}
      </span>
    </footer>
  );
}
