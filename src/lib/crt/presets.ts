// CRT looks. Every numeric value feeds a uniform in renderer.ts; `videoFilter` (plus the numbers) drives the
// CSS-only version of the same look that sits on top of YouTube players, which WebGL can't draw.
export interface CrtPreset {
  id: string;
  label: string;
  labelZh: string;
  /** Barrel distortion amount. */
  curvature: number;
  /** Scanline depth 0..1 and number of scanlines across the picture. */
  scanline: number;
  scanCount: number;
  /** 0 none, 1 aperture grille, 2 shadow mask, 3 slot mask. */
  mask: 0 | 1 | 2 | 3;
  maskStrength: number;
  /** Phosphor triad size in device pixels. */
  maskScale: number;
  /** Convergence error at the edges, in output pixels. */
  aberration: number;
  bloom: number;
  /** Horizontal chroma smear (composite / VHS). */
  bleed: number;
  noise: number;
  vignette: number;
  saturation: number;
  contrast: number;
  brightness: number;
  flicker: number;
  /** Rolling hum bar strength. */
  roll: number;
  /** Horizontal sync wobble / tracking error. */
  jitter: number;
  mono: number;
  tint: [number, number, number];
  /** Slow phosphor sweep beam (night P7), 0..1. */
  sweep: number;
  /** CSS filter that grades a YouTube player to match (CSS filters apply to iframes). */
  videoFilter?: string;
}

const base: Omit<CrtPreset, "id" | "label" | "labelZh"> = {
  curvature: 0.03,
  scanline: 0.4,
  scanCount: 480,
  mask: 1,
  maskStrength: 0.3,
  maskScale: 1,
  aberration: 0.6,
  bloom: 0.35,
  bleed: 0,
  noise: 0.03,
  vignette: 0.35,
  saturation: 1.1,
  contrast: 1.05,
  brightness: 1.05,
  flicker: 0.01,
  roll: 0,
  jitter: 0,
  mono: 0,
  tint: [1, 1, 1],
  sweep: 0,
};

export const PRESETS: CrtPreset[] = [
  { ...base, id: "trinitron", label: "Trinitron PVM", labelZh: "特麗霓虹 監視器" },
  {
    ...base,
    id: "living-room",
    label: "Living-room TV", labelZh: "客廳電視",
    curvature: 0.065,
    scanline: 0.3,
    scanCount: 400,
    mask: 2,
    maskStrength: 0.4,
    aberration: 1.6,
    bloom: 0.55,
    bleed: 0.25,
    noise: 0.06,
    vignette: 0.6,
    saturation: 1.25,
    contrast: 1.0,
    brightness: 1.1,
    roll: 0.04,
    jitter: 0.25,
  },
  {
    ...base,
    id: "arcade",
    label: "Arcade cabinet", labelZh: "街機",
    curvature: 0.045,
    scanline: 0.7,
    scanCount: 300,
    mask: 3,
    maskStrength: 0.45,
    aberration: 0.9,
    bloom: 0.75,
    saturation: 1.35,
    contrast: 1.15,
    brightness: 1.2,
  },
  {
    ...base,
    id: "vhs",
    label: "VHS playback", labelZh: "錄影帶",
    curvature: 0.05,
    scanline: 0.25,
    scanCount: 360,
    mask: 2,
    maskStrength: 0.22,
    aberration: 3.0,
    bloom: 0.45,
    bleed: 0.85,
    noise: 0.11,
    vignette: 0.5,
    saturation: 0.85,
    contrast: 1.08,
    brightness: 1.05,
    flicker: 0.02,
    roll: 0.08,
    jitter: 1.0,
  },
  {
    ...base,
    id: "security",
    label: "B/W security monitor", labelZh: "黑白保安監視器",
    curvature: 0.05,
    scanline: 0.55,
    scanCount: 360,
    mask: 0,
    maskStrength: 0,
    aberration: 0,
    bloom: 0.5,
    noise: 0.12,
    vignette: 0.75,
    saturation: 0,
    contrast: 1.25,
    brightness: 1.1,
    flicker: 0.04,
    roll: 0.15,
    jitter: 0.3,
    mono: 1,
    tint: [0.86, 1.0, 0.94],
    videoFilter: "grayscale(1) sepia(0.12) hue-rotate(70deg) contrast(1.25) brightness(1.08)",
  },
  // Monochrome phosphor tubes (after the sibling cctv-hk project's presets).
  {
    ...base,
    id: "green-p1",
    label: "Green P1 phosphor", labelZh: "綠色 P1 螢光",
    curvature: 0.05,
    scanline: 0.5,
    scanCount: 360,
    mask: 0,
    maskStrength: 0,
    aberration: 0,
    bloom: 0.6,
    noise: 0.06,
    vignette: 0.6,
    saturation: 0,
    contrast: 1.2,
    brightness: 1.05,
    flicker: 0.02,
    mono: 1,
    tint: [0.41, 1.0, 0.54],
    videoFilter: "grayscale(1) sepia(1) hue-rotate(78deg) saturate(2.9) contrast(1.18) brightness(0.92)",
  },
  {
    ...base,
    id: "amber-p3",
    label: "Amber P3 phosphor", labelZh: "琥珀色 P3 螢光",
    curvature: 0.05,
    scanline: 0.5,
    scanCount: 360,
    mask: 0,
    maskStrength: 0,
    aberration: 0,
    bloom: 0.6,
    noise: 0.06,
    vignette: 0.6,
    saturation: 0,
    contrast: 1.2,
    brightness: 1.05,
    flicker: 0.02,
    mono: 1,
    tint: [1.0, 0.82, 0.49],
    videoFilter: "grayscale(1) sepia(1) hue-rotate(-14deg) saturate(3.2) contrast(1.18) brightness(0.94)",
  },
  {
    ...base,
    id: "night-p7",
    label: "Night P7 (sweep)", labelZh: "夜視 P7（掃描）",
    curvature: 0.06,
    scanline: 0.45,
    scanCount: 360,
    mask: 0,
    maskStrength: 0,
    aberration: 0,
    bloom: 0.7,
    noise: 0.1,
    vignette: 0.7,
    saturation: 0,
    contrast: 1.3,
    brightness: 1.0,
    flicker: 0.02,
    mono: 1,
    tint: [0.72, 0.96, 0.26],
    sweep: 1,
    videoFilter: "grayscale(1) sepia(1) hue-rotate(48deg) saturate(2.5) contrast(1.3) brightness(0.92)",
  },
];

/** CSS filter for a YouTube player under this look (explicit, or derived from the colour grade). */
export function videoFilter(p: CrtPreset): string {
  if (p.videoFilter) return p.videoFilter;
  const blur = p.bleed > 0.5 ? " blur(0.6px)" : p.bleed > 0 ? " blur(0.3px)" : "";
  return `saturate(${p.saturation}) contrast(${p.contrast}) brightness(${p.brightness})${blur}`;
}

/** Curvature actually used: cut to 30% on phones, where the barrel warp eats too much of a small screen. */
export function crtCurvature(p: CrtPreset): number {
  const phone = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 600;
  return p.curvature * (phone ? 0.3 : 1);
}

/** Margin (fraction per side) that keeps picture content clear of the curved, vignetted tube edge. */
export const crtInset = (curvature: number) =>
  (typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 600 ? 0.005 : 0.012) + curvature * 0.35;

export const PRESET_IDS = PRESETS.map((p) => p.id);
export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];
