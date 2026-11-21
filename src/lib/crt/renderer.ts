// WebGL post-processing pass that turns a flat canvas into a colour CRT picture.
import type { CrtPreset } from "./presets";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime, uCurv, uScan, uScanCount, uMask, uMaskStr, uMaskScale, uAberr, uBloom, uBleed;
uniform float uNoise, uVig, uSat, uCon, uBri, uFlicker, uRoll, uJitter, uMono, uStatic;
// Power sequence: raster scale, beam overdrive, warm-up wash, vertical-hold slip, degauss wobble, afterglow dot.
uniform float uYs, uXs, uOver, uWash, uHold, uWobble, uDot;
// Channel-change static is confined to this rectangle (x0, y0, x1, y1 in picture uv).
uniform vec4 uStaticRect;
uniform float uSwitch;
// Phosphor sweep beam (night P7): a bright line crawling down with a decaying afterglow trail.
uniform float uSweep;
uniform vec3 uTint;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Barrel warp: the whole source stays visible; the screen corners fall outside it and go black.
vec2 warp(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  c *= 1.0 + (c.yx * c.yx) * uCurv;
  return c * 0.5 + 0.5;
}

vec3 sampleRGB(vec2 uv, vec2 off) {
  return vec3(texture2D(uTex, uv + off).r, texture2D(uTex, uv).g, texture2D(uTex, uv - off).b);
}

vec3 afterglow() {
  vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float r2 = dot(d, d);
  return vec3(0.88, 0.94, 1.0) * uDot * (exp(-r2 / 0.00012) * 2.5 + exp(-r2 / 0.003) * 0.35);
}

void main() {
  vec2 uv = vUv;

  // Raster collapses/expands about the centre (power on/off).
  uv = (uv - 0.5) / vec2(max(uXs, 0.0015), max(uYs, 0.0015)) + 0.5;

  // Vertical hold slipping: picture rolls with a black blanking bar.
  float held = uv.y + uHold;
  float blank = 1.0;
  if (uHold != 0.0) {
    if (uv.y >= 0.0 && uv.y <= 1.0) { held = fract(held); blank = smoothstep(0.0, 0.035, held) * (1.0 - smoothstep(0.965, 1.0, held)); }
    uv.y = held;
  }

  // Degauss: a decaying magnetic wobble.
  uv.x += sin(uv.y * 23.0 + uTime * 37.0) * uWobble * 0.006;
  uv.y += sin(uv.x * 17.0 - uTime * 29.0) * uWobble * 0.004;

  uv = warp(uv);

  // Sync wobble and a tracking-error band that crawls up the picture.
  float line = floor(uv.y * uScanCount);
  float band = smoothstep(0.0, 0.04, abs(fract(uv.y - uTime * 0.07) - 0.5) - 0.44);
  uv.x += (hash(vec2(line, floor(uTime * 30.0))) - 0.5) * 0.0025 * uJitter;
  uv.x += band * 0.012 * uJitter * (hash(vec2(line, uTime)) - 0.3);
  // Channel change: sync tear inside the changed frame only, kept within its edges.
  vec4 sr = uStaticRect;
  float inSwitch = uSwitch * step(sr.x, uv.x) * step(uv.x, sr.z) * step(sr.y, uv.y) * step(uv.y, sr.w);
  if (inSwitch > 0.0) uv.x = clamp(uv.x + inSwitch * (hash(vec2(line * 0.37, floor(uTime * 60.0))) - 0.5) * 0.08 * (sr.z - sr.x), sr.x, sr.z);
  // Power-on static covers the whole tube.
  uv.x += uStatic * (hash(vec2(line * 0.37, floor(uTime * 60.0))) - 0.5) * 0.08;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(afterglow(), 1.0); return; }

  vec2 px = 1.0 / uRes;
  vec2 cc = uv - 0.5;
  vec2 off = cc * length(cc) * 2.0 * (uAberr + uWobble * 6.0) * px + vec2(uAberr * 0.25 * px.x, 0.0);
  vec3 col = sampleRGB(uv, off);

  // Composite chroma smear: keep luma sharp, blur colour horizontally.
  if (uBleed > 0.0) {
    vec3 acc = vec3(0.0);
    for (int i = 1; i <= 4; i++) {
      float f = float(i) * 1.6 * px.x;
      acc += texture2D(uTex, uv - vec2(f, 0.0)).rgb + texture2D(uTex, uv + vec2(f * 0.5, 0.0)).rgb;
    }
    acc /= 8.0;
    vec3 chroma = mix(col - luma(col), acc - luma(acc), uBleed);
    col = luma(col) + chroma;
  }

  // Bloom / halation from bright neighbours.
  if (uBloom > 0.0) {
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec2 d = vec2(cos(a), sin(a));
      glow += texture2D(uTex, uv + d * px * 2.5).rgb;
      glow += texture2D(uTex, uv + d * px * 6.0).rgb;
    }
    glow /= 16.0;
    col += max(glow - 0.25, 0.0) * uBloom * 1.2;
  }

  // Grade.
  float y = luma(col);
  col = mix(vec3(y), col, uSat);
  col = (col - 0.5) * uCon + 0.5;
  col *= uBri;
  if (uMono > 0.5) col = vec3(luma(col)) * uTint;
  if (uSweep > 0.0) {
    float beam = fract(uTime / 3.2);
    float behind = fract(beam - uv.y);
    col += uTint * uSweep * (exp(-behind * 14.0) * 0.35 + step(behind, 0.004) * 0.4);
    col *= 1.0 - uSweep * 0.18 * smoothstep(0.0, 0.9, behind);
  }

  // Scanlines: thinner on bright lines, as a real beam blooms.
  float s = 0.5 + 0.5 * cos(6.28318 * uv.y * uScanCount);
  float w = mix(1.0, 0.35, clamp(luma(col), 0.0, 1.0));
  col *= mix(1.0, pow(s, w), uScan) * (1.0 + uScan * 0.35);

  // Phosphor mask in device pixels.
  if (uMask > 0.5) {
    vec2 f = floor(gl_FragCoord.xy / uMaskScale);
    float colIdx;
    if (uMask < 1.5) { colIdx = mod(f.x, 3.0); }
    else if (uMask < 2.5) { colIdx = mod(f.x + mod(f.y, 2.0) * 1.5, 3.0); colIdx = floor(colIdx); }
    else { colIdx = mod(f.x, 3.0); if (mod(f.y + floor(f.x / 3.0) * 2.0, 4.0) < 1.0) colIdx = 3.0; }
    vec3 m = vec3(0.25);
    if (colIdx < 0.5) m.r = 1.0; else if (colIdx < 1.5) m.g = 1.0; else if (colIdx < 2.5) m.b = 1.0;
    col *= mix(vec3(1.0), m, uMaskStr) * (1.0 + uMaskStr * 0.9);
  }

  // Hum bar, flicker, grain, channel-change static.
  float roll = smoothstep(0.0, 0.15, fract(uv.y * 0.6 + uTime * 0.12)) * (1.0 - smoothstep(0.15, 0.3, fract(uv.y * 0.6 + uTime * 0.12)));
  col *= 1.0 + roll * uRoll - uRoll * 0.25;
  col *= 1.0 - uFlicker * hash(vec2(floor(uTime * 24.0), 1.0));
  float n = hash(gl_FragCoord.xy + fract(uTime) * 100.0);
  col += (n - 0.5) * uNoise;
  float snow = hash(vec2(floor(gl_FragCoord.x / 2.0), floor(gl_FragCoord.y / 2.0)) + uTime);
  col = mix(col, vec3(snow), max(uStatic, inSwitch));

  // Vignette and rounded tube corners.
  vec2 v = uv * (1.0 - uv.yx);
  col *= pow(clamp(v.x * v.y * 16.0, 0.0, 1.0), uVig * 0.45);
  vec2 q = abs(uv - 0.5) * 2.0;
  float corner = 1.0 - smoothstep(0.9, 1.0, length(max(q - 0.96, 0.0)) / 0.04);
  col *= corner;

  // Warm-up: a cold tube is washed out; an overdriven beam is hot and white.
  col = mix(col, vec3(luma(col)) * 0.8 + 0.08, uWash);
  col *= uOver * blank;
  float beamLine = 1.0 - smoothstep(0.0, 0.08, uYs);
  col = mix(col, vec3(0.92, 0.96, 1.0) * uOver * 0.6, beamLine * 0.85);
  col += afterglow();
  gl_FragColor = vec4(clamp(col, 0.0, 2.0), 1.0);
}`;

const UNIFORMS = [
  "uRes", "uTime", "uCurv", "uScan", "uScanCount", "uMask", "uMaskStr", "uMaskScale", "uAberr", "uBloom", "uBleed",
  "uNoise", "uVig", "uSat", "uCon", "uBri", "uFlicker", "uRoll", "uJitter", "uMono", "uStatic", "uTint", "uTex",
  "uYs", "uXs", "uOver", "uWash", "uHold", "uWobble", "uDot", "uStaticRect", "uSwitch", "uSweep",
] as const;
type U = (typeof UNIFORMS)[number];

/** One frame of the power sequence. `ON` is the steady state. */
export interface PowerFx {
  ys: number;
  xs: number;
  over: number;
  wash: number;
  hold: number;
  wobble: number;
  dot: number;
  static: number;
}
export const ON: PowerFx = { ys: 1, xs: 1, over: 1, wash: 0, hold: 0, wobble: 0, dot: 0, static: 0 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Switch-on, `t` seconds after power: line snap → fast vertical bloom with overshoot → warm-up, hold slip, degauss. */
export function powerOn(t: number): PowerFx {
  if (t < 0.05) return { ...ON, ys: 0, xs: 0, over: 0 };
  // Hard line for a few frames, then the raster tears open vertically and overshoots.
  let ys: number;
  if (t < 0.11) ys = 0.003;
  else {
    const k = (t - 0.11) / 0.16;
    ys = k >= 1 ? 1 + 0.035 * Math.exp(-(t - 0.27) * 18) * Math.cos((t - 0.27) * 60) : 0.003 + (1 - Math.pow(1 - k, 3)) * 1.03;
  }
  const warm = smooth(0.25, 1.4, t);
  const flick = t < 1.2 ? (Math.random() - 0.5) * 0.25 * (1 - warm) : 0;
  return {
    ys,
    xs: 1,
    over: (t < 0.11 ? 3.2 : 1 + 1.4 * (1 - smooth(0.11, 0.9, t))) + flick,
    wash: 0.75 * (1 - warm),
    // Vertical hold slips a couple of times, then catches.
    hold: t > 0.27 && t < 1.05 ? 0.35 * Math.exp(-(t - 0.27) * 3.2) * Math.sin((t - 0.27) * 14) : 0,
    wobble: t > 0.2 ? 1.1 * Math.exp(-(t - 0.2) * 3.5) : 0,
    dot: 0,
    static: t < 0.7 ? 0.3 * (1 - smooth(0.1, 0.7, t)) : 0,
  };
}

/** Switch-off, `t` seconds after power is cut: vertical collapse → line pinches to a dot → afterglow fades. */
export function powerOff(t: number): PowerFx {
  const ys = t < 0.07 ? Math.max(0.003, 1 - Math.pow(t / 0.07, 2)) : 0.003;
  const xs = t < 0.07 ? 1 : t < 0.19 ? Math.max(0.002, 1 - Math.pow((t - 0.07) / 0.12, 0.6)) : 0;
  const dot = t < 0.17 ? 0 : Math.max(0, Math.exp(-(t - 0.17) * 3.2) * (1 + 0.15 * Math.sin(t * 90)));
  return { ...ON, ys, xs, over: 1 + Math.min(1, t / 0.07) * 2.4, dot, static: 0 };
}

export class CrtRenderer {
  private gl: WebGLRenderingContext;
  private tex: WebGLTexture;
  private u = {} as Record<U, WebGLUniformLocation | null>;

  static create(canvas: HTMLCanvasElement): CrtRenderer | null {
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    try {
      return new CrtRenderer(gl);
    } catch (err) {
      console.warn("CRT shader unavailable", err);
      return null;
    }
  }

  private constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of UNIFORMS) this.u[name] = gl.getUniformLocation(prog, name);

    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.u.uTex, 0);
  }

  /** `sw` is the channel-change static strength; `rect` (x0, y0, x1, y1 in 0..1) limits it to one frame. */
  render(source: HTMLCanvasElement, p: CrtPreset, t: number, sw: number, rect: [number, number, number, number], fx: PowerFx, dpr: number) {
    const gl = this.gl;
    const { width, height } = gl.canvas as HTMLCanvasElement;
    gl.viewport(0, 0, width, height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const f = (k: U, v: number) => gl.uniform1f(this.u[k], v);
    gl.uniform2f(this.u.uRes, width, height);
    f("uTime", t);
    f("uCurv", p.curvature);
    f("uScan", p.scanline);
    f("uScanCount", p.scanCount);
    f("uMask", p.mask);
    f("uMaskStr", p.maskStrength);
    f("uMaskScale", Math.max(1, Math.round(p.maskScale * dpr)));
    f("uAberr", p.aberration * dpr);
    f("uBloom", p.bloom);
    f("uBleed", p.bleed);
    f("uNoise", p.noise);
    f("uVig", p.vignette);
    f("uSat", p.saturation);
    f("uCon", p.contrast);
    f("uBri", p.brightness);
    f("uFlicker", p.flicker);
    f("uRoll", p.roll);
    f("uJitter", p.jitter);
    f("uMono", p.mono);
    f("uStatic", fx.static);
    f("uSwitch", sw);
    f("uSweep", p.sweep);
    gl.uniform4f(this.u.uStaticRect, ...rect);
    f("uYs", fx.ys);
    f("uXs", fx.xs);
    f("uOver", fx.over);
    f("uWash", fx.wash);
    f("uHold", fx.hold);
    f("uWobble", fx.wobble);
    f("uDot", fx.dot);
    gl.uniform3f(this.u.uTint, ...p.tint);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
