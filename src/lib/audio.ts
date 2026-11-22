// Tiny WebAudio effects for the CRT shell: channel-change static and the power thunk.
let ctx: AudioContext | null = null;
/** The audio context — or null before the first click / key press (browsers refuse to start audio until then, and
 * warn in the console for every attempt), so the sound effects are simply skipped. */
function ac(): AudioContext | null {
  const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
  if (!activated) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function staticBurst(ms = 180, gain = 0.08) {
  const a = ac();
  if (!a) return;
  const len = Math.floor((a.sampleRate * ms) / 1000);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value = 0.6;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(a.destination);
  src.start();
}

export function powerThunk(on: boolean) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(on ? 60 : 120, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(on ? 15000 : 40, a.currentTime + (on ? 0.6 : 0.3));
  g.gain.setValueAtTime(on ? 0.015 : 0.12, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + (on ? 0.9 : 0.35));
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 1);
  staticBurst(on ? 260 : 120, 0.05);
}

export function click() {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "square";
  o.frequency.value = 1800;
  g.gain.setValueAtTime(0.03, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.03);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.04);
}
