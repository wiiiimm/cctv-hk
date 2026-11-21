// Small stroke icons (24×24, currentColor). The path data is shared with the CRT compositor, which draws the
// same icons into the CRT picture with Path2D.
export const ICON_PATHS = {
  pin: ["M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z", "M12 13v8"],
  unpin: ["M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z", "M12 13v8", "M3 3l18 18"],
  solo: ["M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"],
  exitSolo: ["M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"],
  smaller: ["M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z"],
  bigger: ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
  pinWide: ["M3 4h18v11H3zM3 18h5v2H3zM10 18h4v2h-4zM16 18h5v2h-5z"],
  pinSide: ["M3 4h12v10H3zM17 4h4v4h-4zM17 10h4v4h-4zM3 17h4v3H3zM9 17h6v3H9zM17 17h4v3h-4z"],
  groups: ["M3 6h6l2 2h10v11H3z", "M12 11v5M9.5 13.5h5"],
} as const;
export type IconName = keyof typeof ICON_PATHS;

type P = { size?: number };

function Icon({ name, size = 16 }: P & { name: IconName }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Pushpin. */
export const PinIcon = (p: P) => <Icon name="pin" {...p} />;
/** Pushpin, struck through. */
export const UnpinIcon = (p: P) => <Icon name="unpin" {...p} />;
/** Corners opening outward: show only this video. */
export const SoloIcon = (p: P) => <Icon name="solo" {...p} />;
/** Corners closing inward: leave solo. */
export const ExitSoloIcon = (p: P) => <Icon name="exitSolo" {...p} />;
/** Many small tiles: smaller previews. */
export const SmallerIcon = (p: P) => <Icon name="smaller" {...p} />;
/** Few large tiles: bigger previews. */
export const BiggerIcon = (p: P) => <Icon name="bigger" {...p} />;
/** Pinned "wide": a full-width picture over a row of previews. */
export const PinWideIcon = (p: P) => <Icon name="pinWide" {...p} />;
/** Pinned "side": a picture with a column of previews on its right and a row below. */
export const PinSideIcon = (p: P) => <Icon name="pinSide" {...p} />;
/** Folder with a plus: add to my groups. */
export const GroupsIcon = (p: P) => <Icon name="groups" {...p} />;
