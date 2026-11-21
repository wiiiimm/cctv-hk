// Small stroke icons (24×24, currentColor) for pin / solo controls.
type P = { size?: number };

function Svg({ size = 16, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

/** Pushpin. */
export const PinIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z" />
    <path d="M12 13v8" />
  </Svg>
);

/** Pushpin, struck through. */
export const UnpinIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z" />
    <path d="M12 13v8" />
    <path d="M3 3l18 18" />
  </Svg>
);

/** Corners opening outward: show only this video. */
export const SoloIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);

/** Corners closing inward: leave solo. */
export const ExitSoloIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
);

/** Many small tiles: smaller previews. */
export const SmallerIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z" />
  </Svg>
);

/** Few large tiles: bigger previews. */
export const BiggerIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
  </Svg>
);

/** Pinned "wide": a full-width picture over a row of previews. */
export const PinWideIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 4h18v11H3zM3 18h5v2H3zM10 18h4v2h-4zM16 18h5v2h-5z" />
  </Svg>
);

/** Pinned "side": a picture with a column of previews on its right and a row below. */
export const PinSideIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 4h12v10H3zM17 4h4v4h-4zM17 10h4v4h-4zM3 17h4v3H3zM9 17h6v3H9zM17 17h4v3h-4z" />
  </Svg>
);
