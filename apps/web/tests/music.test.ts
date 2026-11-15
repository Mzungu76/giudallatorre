import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Audio finto: registra quali file vengono creati e riprodotti, e permette di simulare «file assente».
class FakeAudio {
  static all: FakeAudio[] = []; src: string; loop = false; preload = ""; volume = 0; paused = true; private l: Record<string, (() => void)[]> = {};
  constructor(src: string) { this.src = src; FakeAudio.all.push(this); }
  play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; }
  addEventListener(t: string, f: () => void) { (this.l[t] ??= []).push(f); } fire(t: string) { (this.l[t] ?? []).forEach((f) => f()); }
}
const playing = () => FakeAudio.all.filter((a) => !a.paused).map((a) => a.src.replace("/audio/", ""));

describe("musica del voto", () => {
  beforeEach(() => {
    vi.resetModules(); FakeAudio.all = [];
    vi.stubGlobal("Audio", FakeAudio); vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, clearTimeout }); vi.stubGlobal("document", { addEventListener() {}, removeEventListener() {} });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("durante il voto (turni e intervalli) suona musica-suspense.mp3, poi torna il tema", async () => {
    const { music } = await import("../src/lib/music.ts");
    music.play("musica-tema.mp3"); expect(playing()).toEqual(["musica-tema.mp3"]);
    music.voting(true); expect(playing()).toEqual(["musica-suspense.mp3"]);
    music.play("musica-tema.mp3"); expect(playing()).toEqual(["musica-suspense.mp3"]);   // il rinnovo del sottofondo non spegne la musica del voto
    music.voting(false); expect(playing()).toEqual(["musica-tema.mp3"]);
  });
  it("se musica-suspense.mp3 non esiste, resta il tema (nessun silenzio)", async () => {
    const { music } = await import("../src/lib/music.ts");
    music.play("musica-tema.mp3"); music.voting(true);
    FakeAudio.all.find((a) => a.src.endsWith("musica-suspense.mp3"))!.fire("error");
    expect(playing()).toEqual(["musica-tema.mp3"]);
    music.voting(false); music.voting(true); expect(playing()).toEqual(["musica-tema.mp3"]);   // non ci riprova a ogni voto
  });
  it("senza sottofondo (suono spento, grande schermo) il voto non fa suonare niente", async () => {
    const { music } = await import("../src/lib/music.ts");
    music.play(null); music.voting(true); expect(playing()).toEqual([]);
  });
});
