import { CHANNEL_BY_KEY, GROUP_BY_ID, fmtNum, useGroupsRev } from "../../lib/channels";
import { actions, activeKey, groupKeysOf, useStore } from "../../lib/store";
import { chName, groupLabel, useT } from "../../lib/i18n";
import { IconButton, PinToggle } from "../PinButtons";
import { ExitSoloIcon, SoloIcon } from "../icons";

const openDrawer = () => window.dispatchEvent(new CustomEvent("cctv:open-sidebar"));

/**
 * Phone bottom bar (replaces the status bar below 760px), in thumb reach.
 * - A camera selected / pinned: its channel and name, then pin, full view, favourite and ⓘ (opens the drawer).
 * - Otherwise: the camera group (opens the drawer) and a ‹ page › pager.
 */
export function MobileBar() {
  const t = useT();
  const s = useStore((x) => x);
  const key = activeKey(s);
  const ch = key ? CHANNEL_BY_KEY.get(key) : undefined;
  const fav = !!key && s.favourites.includes(key);

  useGroupsRev();
  const keys = groupKeysOf(s);
  const n = Math.max(1, s.cells.length - (s.pinned ? 1 : 0));
  const pages = Math.max(1, Math.ceil(keys.length / n));
  const g = GROUP_BY_ID.get(s.groupId);
  const custom = s.customGroups.find((c) => `custom:${c.id}` === s.groupId);
  const group = s.groupId === "favourites" ? t.favourites : s.groupId === "nearby" ? t.nearMe : custom ? custom.name : g ? groupLabel(g, s.lang) : "";

  return (
    <footer className="mobilebar">
      {ch ? (
        <>
          <button type="button" className="mb-cam" onClick={openDrawer} title={t.cameraInfo}>
            <b>CH {fmtNum(ch.num)}</b> <span>{chName(ch, s.lang)}</span>
          </button>
          <span className="mb-actions">
            <PinToggle />
            <IconButton
              icon={s.focused ? <ExitSoloIcon /> : <SoloIcon />}
              label={s.focused ? t.exitSoloTitle : t.soloTitle}
              on={s.focused}
              onPress={() => (s.focused ? actions.unfocus() : actions.focus())}
            />
            <IconButton icon="★" label={fav ? t.removeFav : t.addFav} on={fav} onPress={() => key && actions.toggleFavourite(key)} />
            <IconButton icon="ⓘ" label={t.cameraInfo} onPress={openDrawer} />
          </span>
        </>
      ) : (
        <>
          <button type="button" className="mb-group" onClick={openDrawer} title={t.cameraGroup}>
            {group} <span aria-hidden>▾</span>
          </button>
          <span className="mb-pager">
            <IconButton icon="‹" label={t.prevPage} onPress={() => actions.pageStep(-1)} />
            <span className="mb-page">
              {(s.page % pages) + 1}/{pages}
            </span>
            <IconButton icon="›" label={t.nextPage} onPress={() => actions.pageStep(1)} />
          </span>
        </>
      )}
    </footer>
  );
}
