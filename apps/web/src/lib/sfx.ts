// Effetti sonori sintetici (WebAudio), senza file: tutto gratis e leggero.
let ac: AudioContext | null = null, master: GainNode | null = null;
function ctx(): AudioContext | null {
  try {
    if (!ac) { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); }
    if (ac.state === "suspended") void ac.resume();
    return ac;
  } catch { return null; }
}
function noise(c: AudioContext, d: number) { const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * d)), c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; }
export const sfx = {
  whoosh(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; const n = noise(c, 0.5), f = c.createBiquadFilter(), g = c.createGain(); f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(400, c.currentTime); f.frequency.exponentialRampToValueAtTime(2200, c.currentTime + 0.4); g.gain.setValueAtTime(0.01, c.currentTime); g.gain.linearRampToValueAtTime(0.35, c.currentTime + 0.15); g.gain.linearRampToValueAtTime(0, c.currentTime + 0.5); n.connect(f).connect(g).connect(master); n.start(); },
  tap(on: boolean, freq = 520) { if (!on) return; const c = ctx(); if (!c || !master) return; const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(freq, c.currentTime); o.frequency.exponentialRampToValueAtTime(freq * 0.6, c.currentTime + 0.12); g.gain.setValueAtTime(0.5, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16); o.connect(g).connect(master); o.start(); o.stop(c.currentTime + 0.2); },
  drum(on: boolean, len = 0.6) { if (!on) return; const c = ctx(); if (!c || !master) return; for (let i = 0; i < Math.floor(len / 0.06); i++) { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.06; o.frequency.setValueAtTime(150 - i * 2, t); g.gain.setValueAtTime(0.25 + i * 0.012, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o.connect(g).connect(master); o.start(t); o.stop(t + 0.06); } },
  stamp(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, c.currentTime); o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25); g.gain.setValueAtTime(0.9, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3); o.connect(g).connect(master); o.start(); o.stop(c.currentTime + 0.32); },
  ding(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; [880, 1320].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.09; o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(master!); o.start(t); o.stop(t + 0.4); }); },
  tada(on: boolean) { if (!on) return; const c = ctx(); if (!c || !master) return; [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.1; o.type = "square"; o.frequency.value = f; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(master!); o.start(t); o.stop(t + 0.4); }); },
};
