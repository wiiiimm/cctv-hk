import { PinModes, PinToggle } from "../PinButtons";

export type PinRole = "selected" | "pinned" | "solo";

/** Pin controls in the corner of a video: pin on the selected tile; single view + pin toggle on the pinned video. */
export function PinControls({ role, index }: { role: PinRole; index: number }) {
  return (
    <div className={`pin-controls ${role}`} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {/* Same order as the sidebar: pin, then single view. */}
      <PinToggle index={role === "selected" ? index : 0} />
      {role !== "selected" && <PinModes />}
    </div>
  );
}
