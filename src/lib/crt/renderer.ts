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
uniform float uNoise, uVig, uSat, uCon, uBri, uFlicker, uRoll, uJitter, uMono, uStatic, uPower;
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

void main() {
  vec2 uv = vUv;

  // Power on/off: collapse to a horizontal line, then to a dot.
  float p = uPower;
  float ys = p > 0.35 ? (p - 0.35) / 0.65 : 0.006;
  float xs = p > 0.35 ? 1.0 : max(p / 0.35, 0.004);
  uv = (uv - 0.5) / vec2(xs, ys) + 0.5;

  uv = warp(uv);

  // Sync wobble and a tracking-error band that crawls up the picture.
  float line = floor(uv.y * uScanCount);
  float band = smoothstep(0.0, 0.04, abs(fract(uv.y - uTime * 0.07) - 0.5) - 0.44);
  uv.x += (hash(vec2(line, floor(uTime * 30.0))) - 0.5) * 0.0025 * uJitter;
  uv.x += band * 0.012 * uJitter * (hash(vec2(line, uTime)) - 0.3);
  uv.x += uStatic * (hash(vec2(line * 0.37, floor(uTime * 60.0))) - 0.5) * 0.08;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  vec2 px = 1.0 / uRes;
  vec2 cc = uv - 0.5;
  vec2 off = cc * length(cc) * 2.0 * uAberr * px + vec2(uAberr * 0.25 * px.x, 0.0);
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
  col = mix(col, vec3(hash(vec2(floor(gl_FragCoord.x / 2.0), floor(gl_FragCoord.y / 2.0)) + uTime)), uStatic);

  // Vignette and rounded tube corners.
  vec2 v = uv * (1.0 - uv.yx);
  col *= pow(clamp(v.x * v.y * 16.0, 0.0, 1.0), uVig * 0.45);
  vec2 q = abs(uv - 0.5) * 2.0;
  float corner = 1.0 - smoothstep(0.9, 1.0, length(max(q - 0.96, 0.0)) / 0.04);
  col *= corner;

  col *= 1.0 + (1.0 - p) * 2.5;
  gl_FragColor = vec4(clamp(col, 0.0, 1.5), 1.0);
}`;

const UNIFORMS = [
  "uRes", "uTime", "uCurv", "uScan", "uScanCount", "uMask", "uMaskStr", "uMaskScale", "uAberr", "uBloom", "uBleed",
  "uNoise", "uVig", "uSat", "uCon", "uBri", "uFlicker", "uRoll", "uJitter", "uMono", "uStatic", "uPower", "uTint", "uTex",
] as const;
type U = (typeof UNIFORMS)[number];

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

  render(source: HTMLCanvasElement, p: CrtPreset, t: number, staticAmt: number, power: number, dpr: number) {
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
    f("uStatic", staticAmt);
    f("uPower", power);
    gl.uniform3f(this.u.uTint, ...p.tint);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
