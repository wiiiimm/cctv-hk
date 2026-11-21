import { ChannelGuide } from "./ChannelGuide";
import { FocusPanel } from "./FocusPanel";
import { Remote } from "./Remote";

/** Left sidebar: details and map for the selected (or pinned) video, the channel guide, and the remote. */
export function Sidebar({ onPick }: { onPick?: () => void }) {
  return (
    <aside className="sidebar">
      <FocusPanel compact />
      <ChannelGuide onPick={onPick} />
      <Remote />
    </aside>
  );
}
