// One look for pin / single-view controls everywhere (top bar, sidebar, video overlay).
// Neutral = an action you can take; "on" (yellow) = that state is active for this video.
import { actions, useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { ExitSoloIcon, PinIcon, SoloIcon, UnpinIcon } from "./icons";

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  on?: boolean;
  onPress: () => void;
}

export function IconButton({ icon, label, on = false, onPress }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn${on ? " on" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation(); // never fall through to the tile underneath
        onPress();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {icon}
    </button>
  );
}

/** Pin toggle for video `index` (default: the selected video). On = that video is the pinned one. */
export function PinToggle({ index }: { index?: number }) {
  const t = useT();
  const pinnedHere = useStore((s) => s.pinned && (index ?? s.selected) === 0);
  return (
    <IconButton
      icon={pinnedHere ? <UnpinIcon /> : <PinIcon />}
      label={pinnedHere ? t.unpinTitle : t.pinTitle}
      on={pinnedHere}
      onPress={() => (pinnedHere ? actions.unpin() : actions.pin(index))}
    />
  );
}

/** Single-view toggle. On = single view is showing. */
export function SoloToggle() {
  const t = useT();
  const solo = useStore((s) => s.focused);
  return (
    <IconButton
      icon={solo ? <ExitSoloIcon /> : <SoloIcon />}
      label={solo ? t.exitSoloTitle : t.soloTitle}
      on={solo}
      onPress={() => (solo ? actions.unfocus() : actions.focus())}
    />
  );
}
