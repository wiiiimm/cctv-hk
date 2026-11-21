import { actions } from "../../lib/store";
import { useT } from "../../lib/i18n";

export type PinRole = "selected" | "pinned" | "solo";

/**
 * Visible pin controls on a video: PIN on the selected tile; SOLO / UNPIN on the pinned video;
 * EXIT SOLO / UNPIN in solo. Clicks don't fall through to the tile underneath.
 */
export function PinControls({ role, index, className = "" }: { role: PinRole; index: number; className?: string }) {
  const t = useT();
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const btn = (label: string, onPress: () => void, primary = false, title?: string) => (
    <button
      type="button"
      className={`pin-btn${primary ? " primary" : ""}`}
      title={title}
      onClick={(e) => {
        stop(e);
        onPress();
      }}
      onDoubleClick={stop}
    >
      {label}
    </button>
  );
  return (
    <div className={`pin-controls ${role} ${className}`} onClick={stop} onDoubleClick={stop}>
      {role === "selected" && btn(t.pin, () => actions.pin(index), true, t.pinTitle)}
      {role === "pinned" && (
        <>
          {btn(t.soloBtn, () => actions.focus(0), true, t.soloTitle)}
          {btn(t.unpin, actions.unpin)}
        </>
      )}
      {role === "solo" && (
        <>
          {btn(t.backToWall, actions.unfocus, true)}
          {btn(t.unpin, actions.unpin)}
        </>
      )}
    </div>
  );
}
