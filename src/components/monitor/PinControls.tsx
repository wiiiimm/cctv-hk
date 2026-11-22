import { PinModes, PinToggle, IconButton } from "../PinButtons";
import { CHANNEL_BY_KEY } from "../../lib/channels";
import { getSnap } from "../../lib/snapshots";
import { useStore } from "../../lib/store";
import { useT } from "../../lib/i18n";
import { ExternalIcon } from "../icons";

export type PinRole = "selected" | "pinned" | "solo";

/** The YouTube video the pinned / full-view tile is showing, for "open in a new window" (null for other feeds). */
export function pinnedVideoUrl(key: string | undefined): string | null {
  const ch = key ? CHANNEL_BY_KEY.get(key) : undefined;
  if (!ch || ch.kind !== "yt") return null;
  const id = getSnap(ch.key).videoId ?? (ch.follow ? undefined : ch.code);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Open the video in its own window (a popup sized like a player; a new tab where popups open as tabs). */
export function openVideoWindow(url: string) {
  window.open(url, "_blank", "popup,width=1280,height=760,noopener");
}

/** Pin controls in the corner of a video: pin on the selected tile; on the pinned video "open on YouTube" (videos),
 * the pin toggle and the pinned sizes. */
export function PinControls({ role, index }: { role: PinRole; index: number }) {
  const t = useT();
  const key = useStore((s) => (role === "solo" ? s.cells[s.selected] : role === "pinned" ? s.cells[0] : undefined));
  const url = role === "selected" ? null : pinnedVideoUrl(key);
  return (
    <div className={`pin-controls ${role}`} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {url && <IconButton icon={<ExternalIcon />} label={t.openWindow} onPress={() => openVideoWindow(url)} />}
      {/* Same order as the sidebar: pin, then single view. */}
      <PinToggle index={role === "selected" ? index : 0} />
      {role !== "selected" && <PinModes />}
    </div>
  );
}
