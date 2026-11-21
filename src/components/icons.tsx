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
