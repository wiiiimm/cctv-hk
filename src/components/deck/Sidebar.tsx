import { ChannelGuide } from "./ChannelGuide";
import { FocusPanel } from "./FocusPanel";

/** Left sidebar: details and map for the selected (or pinned) video, then the channel guide. */
export function Sidebar({ onPick }: { onPick?: () => void }) {
  return (
    <aside className="sidebar">
      <FocusPanel compact />
      <ChannelGuide onPick={onPick} />
    </aside>
  );
}
