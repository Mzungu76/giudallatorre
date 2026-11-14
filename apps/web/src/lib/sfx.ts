// Effetti sonori. Se in public/audio/ c'è il file con lo stesso nome (es. stamp.mp3) suona quello,
// altrimenti resta il suono sintetico (WebAudio) qui sotto: si possono sostituire un effetto alla volta.
import { music } from "./music.ts";
let ac: AudioContext | null = null, master: GainNode | null = null;
function ctx(): AudioContext | null {
  try {
    if (!ac) { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); }
    if (ac.state === "suspended") void ac.resume();
    return ac;
  } catch { return null; }
}
function noise(c: AudioContext, d: number) { const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * d)), c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; }
const synth = {
  whoosh(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; const n = noise(c, 0.5), f = c.createBiquadFilter(), g = c.createGain(); f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(400, c.currentTime); f.frequency.exponentialRampToValueAtTime(2200, c.currentTime + 0.4); g.gain.setValueAtTime(0.01, c.currentTime); g.gain.linearRampToValueAtTime(0.35, c.currentTime + 0.15); g.gain.linearRampToValueAtTime(0, c.currentTime + 0.5); n.connect(f).connect(g).connect(master); n.start(); },
  tap(on: boolean, freq = 520) { if (!on) return; const c = ctx(); if (!c || !master) return; const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(freq, c.currentTime); o.frequency.exponentialRampToValueAtTime(freq * 0.6, c.currentTime + 0.12); g.gain.setValueAtTime(0.5, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16); o.connect(g).connect(master); o.start(); o.stop(c.currentTime + 0.2); },
  drum(on: boolean, len = 0.6) { if (!on) return; const c = ctx(); if (!c || !master) return; for (let i = 0; i < Math.floor(len / 0.06); i++) { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.06; o.frequency.setValueAtTime(150 - i * 2, t); g.gain.setValueAtTime(0.25 + i * 0.012, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o.connect(g).connect(master); o.start(t); o.stop(t + 0.06); } },
  stamp(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, c.currentTime); o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25); g.gain.setValueAtTime(0.9, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3); o.connect(g).connect(master); o.start(); o.stop(c.currentTime + 0.32); },
  ding(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; [880, 1320].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.09; o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(master!); o.start(t); o.stop(t + 0.4); }); },
  fanfare(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.13; o.type = "sawtooth"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + (i === 6 ? 0.9 : 0.3)); o.connect(g).connect(master!); o.start(t); o.stop(t + (i === 6 ? 1 : 0.35)); }); const n = noise(c, 0.6), f2 = c.createBiquadFilter(), g2 = c.createGain(); f2.type = "highpass"; f2.frequency.value = 5000; g2.gain.setValueAtTime(0.25, c.currentTime + 0.85); g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.5); n.connect(f2).connect(g2).connect(master); n.start(c.currentTime + 0.85); },
  tada(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.1; o.type = "square"; o.frequency.value = f; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(master!); o.start(t); o.stop(t + 0.4); }); },
};

type Name = keyof typeof synth;
// durata (ms) per cui la musica si abbassa; gli effetti brevi non la toccano
const DUCK: Partial<Record<Name, number>> = { fanfare: 2200, tada: 1800, stamp: 700, drum: 1500 };
const bufs = new Map<Name, AudioBuffer | null>();
let loading = false;
function preload() {
  const c = ctx(); if (!c || loading) return; loading = true;
  (Object.keys(synth) as Name[]).forEach((n) => {
    fetch(`/audio/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("manca"))))
      .then((ab) => c.decodeAudioData(ab)).then((b) => { bufs.set(n, b); }).catch(() => { bufs.set(n, null); });
  });
}
function sample(n: Name, rate: number): boolean {
  const b = bufs.get(n), c = ac;
  if (!b || !c || !master) return false;
  const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; s.connect(master); s.start();
  return true;
}
export const sfx = {
  whoosh(on: boolean) { if (!on) return; preload(); if (!sample("whoosh", 1)) synth.whoosh(on); },
  tap(on: boolean, freq = 520) { if (!on) return; preload(); if (!sample("tap", Math.min(2, Math.max(0.5, freq / 520)))) synth.tap(on, freq); },
  drum(on: boolean, len = 0.6) { if (!on) return; preload(); music.duck(DUCK.drum ?? 0); if (!sample("drum", 1)) synth.drum(on, len); },
  stamp(on: boolean) { if (!on) return; preload(); music.duck(DUCK.stamp ?? 0); if (!sample("stamp", 1)) synth.stamp(on); },
  ding(on: boolean) { if (!on) return; preload(); if (!sample("ding", 1)) synth.ding(on); },
  fanfare(on: boolean) { if (!on) return; preload(); music.duck(DUCK.fanfare ?? 0); if (!sample("fanfare", 1)) synth.fanfare(on); },
  tada(on: boolean) { if (!on) return; preload(); music.duck(DUCK.tada ?? 0); if (!sample("tada", 1)) synth.tada(on); },
};
