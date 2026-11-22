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
  const custom = s.customGroups.find((c) => `custom:${c.id}` === s.groupId);
  const group = s.groupId === "favourites" ? t.favourites : custom ? custom.name : g ? groupLabel(g, s.lang) : "";

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
      <a className="gh-link" href="https://github.com/wiiiimm/cctv-hk" target="_blank" rel="noopener noreferrer" title={t.sourceOnGitHub} aria-label={t.sourceOnGitHub}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        GitHub
      </a>
    </footer>
  );
}
