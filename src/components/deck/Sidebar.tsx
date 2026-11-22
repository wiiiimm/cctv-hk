import { useT } from "../../lib/i18n";
import { ChannelGuide } from "./ChannelGuide";
import { FocusPanel } from "./FocusPanel";
import { Remote } from "./Remote";

/**
 * Left sidebar: details and map for the selected (or pinned) video, the channel guide, and the remote.
 * Below 1180px it is a slide-out drawer; `onClose` closes it (× button in the drawer header).
 */
export function Sidebar({ onPick, onClose }: { onPick?: () => void; onClose?: () => void }) {
  const t = useT();
  return (
    <aside className="sidebar">
      <div className="drawer-head">
        <span>{t.guide}</span>
        <button type="button" className="drawer-close" onClick={onClose} aria-label={t.hideSidebar} title={`${t.hideSidebar} (T)`}>
          «
        </button>
      </div>
      <FocusPanel compact />
      <ChannelGuide onPick={onPick} />
      <Remote />
    </aside>
  );
}
