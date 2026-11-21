// Full-colour CRT looks. Every value feeds a uniform in shader.ts.
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
  },
];

export const PRESET_IDS = PRESETS.map((p) => p.id);
export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];
