import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { applyAction, BOT_ENGINES, chooseBotAction, cncPoints, createGame, DEFAULT_BOT_ENGINE, getBotEngine, megafonoOf, newBotMemory, scoreTurn, TUNE } from "../src/index.ts";
import type { BotLevel, GameState, TowerSlot } from "../src/index.ts";
import { nextRandom } from "../src/rng.ts";
import { cfg } from "./helpers.ts";

const tower = (owners: (string | null)[]): TowerSlot[] => owners.map((o, i) => ({ position: i + 1, cardId: `c${i + 1}`, ownerId: o }));
const ids = ["a", "b", "c", "d"];

describe("scoreTurn: unica fonte del punteggio", () => {
  it("CADE che cade: +4 al Megafono e a chi l'ha votata, +2 ai voti giusti e al proprietario", () => {
    const r = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 3, b: 2, c: 2, d: 2 }, [{ slot: "cade", effect: "cade", position: 2 }]);
    expect(r.T.fallen).toEqual([2]);
    expect(r.points).toEqual({ a: 4, b: 2 + 2 + 4, c: 2 + 4, d: 2 + 4 });   // b è anche proprietario della carta 2
  });
  it("NON CADE che resta su vale +2 (non +1) al Megafono e a chi l'ha votata", () => {
    const r = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 1, b: 2, c: 2, d: 3 }, [{ slot: "noncade", effect: "noncade", position: 4 }]);
    expect(r.T.fallen).toEqual([2]);
    expect(r.points.a).toBe(2);
    expect(r.outs[0]).toMatchObject({ hit: true, voters: [] });
  });
  it("NON CADE con voti sulla carta: +2 al Megafono e +2 a ogni votante della Folla", () => {
    const r = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 1, b: 4, c: 1, d: 1 }, [{ slot: "noncade", effect: "noncade", position: 4 }]);
    expect(r.T.fallen).toEqual([1]);
    expect(r.points).toEqual({ a: 2 + 2 + 2, b: 2, c: 2, d: 2 });   // a: voto giusto + carta caduta + NON CADE; b: votava la carta salva
  });
  it("VOTI NULLI!: nessun punto e il voto annullato non vale", () => {
    const r = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 1, b: 2, c: 2, d: 2 }, [{ slot: "nulli", effect: "nulli", position: 2 }]);
    expect(r.T.annulled.sort()).toEqual(["b", "c", "d"]);
    expect(r.T.fallen).toEqual([1]);   // restano valide solo le carte non annullate: cade quella del Megafono, votata da lui solo
    expect(r.points).toEqual({ a: 2 + 2, b: 0, c: 0, d: 0 });   // il Megafono: voto giusto + sua carta; la Folla perde il +2; il segnalino non dà nulla
  });
  it("proprietari nascosti: nessun +2 della carta", () => {
    const r = scoreTurn(tower([null, null, null, null]), ids, "a", { a: 2, b: 2, c: 2, d: 2 }, [{ slot: "noncade", effect: "noncade", position: 1 }]);
    expect(r.lines.b!.map((l) => l.kind)).toEqual(["voto"]);
  });
});

describe("i bot valutano i turni con le stesse regole del motore", () => {
  it("cncPoints coincide con i punti reali (con noncadeEv = 1; Megafono esatto; Folla esatta tranne il +2 delle carte altrui, che il Megafono non conosce)", () => {
    const saved = TUNE.noncadeEv; TUNE.noncadeEv = 1;
    try { checkAgainstEngine(); } finally { TUNE.noncadeEv = saved; }
  });
  it("con il peso storico del NON CADE (0.5) il Megafono lo valuta +1 invece di +2, e solo quello", () => {
    expect(TUNE.noncadeEv).toBe(0.5);
    const s = createGame(cfg(4, { seed: 3 })).state, t = [1, 2, 3, 4].map((i) => ({ position: i, cardId: `c${i}`, ownerId: null }));
    const st = { ...s, tower: t }, mega = megafonoOf(s), others = s.playerIds.filter((p) => p !== mega);
    const votes = { [mega]: 1, [others[0]!]: 4, [others[1]!]: 1, [others[2]!]: 1 };
    const real = scoreTurn(t, s.playerIds, mega, votes, [{ slot: "noncade", effect: "noncade", position: 4 }]);
    const hyp = cncPoints(st, mega, votes, [{ effect: "noncade", position: 4 }]);
    expect(real.points[mega]).toBe(2 + 2);   // voto giusto + NON CADE (nessuna carta propria: owner null)
    expect(hyp.m).toBe(2 + 1);
    expect(hyp.f * others.length).toBe((real.points[others[0]!]! - 1) + real.points[others[1]!]! + real.points[others[2]!]!);
  });
});

function checkAgainstEngine() {
  {
    let checked = 0, noncadeHit = 0;
    for (let seed = 1; seed <= 12; seed++) for (const n of [3, 4, 6]) {
      let s = createGame(cfg(n, { seed })).state; const mem = newBotMemory(); let r = seed * 7919, g = 0;
      const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
      while (s.phase !== "GAME_OVER" && g++ < 4000) {
        if (s.phase === "RESULTS") { s = applyAction(s, { type: "advance" }).state; continue; }
        let act = null;
        for (const p of s.playerIds) { act = chooseBotAction(s, p, (["easy", "medium", "hard"] as BotLevel[])[(seed + g) % 3]!, mem, rand); if (act) break; }
        if (!act) break;
        const pre = s, next = applyAction(pre, act).state;
        if (act.type === "vote" && next.phase === "RESULTS") {
          const res = next.lastResult!, mega = megafonoOf(pre), marks = (pre.marks ?? []).map((m) => ({ effect: m.slot, position: m.position }));
          const hyp = cncPoints(pre, mega, { ...pre.votes, [act.playerId]: act.position }, marks);
          expect(hyp.m, `seed ${seed} n ${n}`).toBe(res.points[mega]);
          const folla = pre.playerIds.filter((p) => p !== mega), cartaPts = (p: string) => res.lines[p]!.filter((l) => l.kind === "carta").reduce((a, l) => a + l.pts, 0);
          expect(hyp.f * folla.length).toBeCloseTo(folla.reduce((a, p) => a + res.points[p]! - cartaPts(p), 0), 9);
          checked++; if (marks[0]?.effect === "noncade" && res.marks[0]?.hit) noncadeHit++;
        }
        s = next;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(noncadeHit, "il controllo deve aver coperto NON CADE andato a segno").toBeGreaterThan(5);
  }
}

describe("registro dei motori e Baseline AI", () => {
  it("la baseline è un motore distinto e il predefinito è registrato", () => {
    expect(Object.keys(BOT_ENGINES)).toContain("baseline-1");
    expect(BOT_ENGINES[DEFAULT_BOT_ENGINE]).toBeDefined();
    expect(getBotEngine("baseline-1").chooseAction).not.toBe(getBotEngine("legacy-1.1").chooseAction);
    expect(getBotEngine("inesistente").id).toBe(DEFAULT_BOT_ENGINE);
  });
  it("il file della baseline è congelato (impronta SHA-256): se cambia, è una scelta consapevole da registrare in docs/AI_CHANGELOG.md", () => {
    const src = readFileSync(new URL("../src/ai-baseline/ai.ts", import.meta.url));
    expect(createHash("sha256").update(src).digest("hex")).toBe("af1ff7a340eb51cc8022d60469d0f13bde35937b69eea6f90a6cc8273b11e19e");
  });
  it("regressione: con i parametri predefiniti i bot in produzione prendono le STESSE decisioni della baseline (partite intere, tutti i livelli)", () => {
    const run = (id: string, seed: number, n: number) => {
      const eng = getBotEngine(id); let s: GameState = createGame(cfg(n, { seed })).state; const mem = eng.newMemory(), log: string[] = []; let r = seed * 31, g = 0;
      const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
      while (s.phase !== "GAME_OVER" && g++ < 4000) {
        if (s.phase === "RESULTS") { eng.learn(mem, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
        const a = s.playerIds.map((p, i) => eng.chooseAction(s, p, (["easy", "medium", "hard"] as BotLevel[])[(i + seed) % 3]!, mem, rand)).find((x) => x);
        if (!a) throw new Error("bloccata");
        log.push(JSON.stringify(a)); s = applyAction(s, a).state;
      }
      return log.join("|") + JSON.stringify(s.scores);
    };
    for (const n of [3, 4, 5, 6]) for (let seed = 1; seed <= 6; seed++) expect(run("legacy-1.1", seed, n), `n ${n} seed ${seed}`).toBe(run("baseline-1", seed, n));
  });
  it.each(Object.keys(BOT_ENGINES))("%s gioca partite complete legali e deterministiche", (id) => {
    const eng = getBotEngine(id), play = () => {
      let s: GameState = createGame(cfg(4, { seed: 5 })).state; const mem = eng.newMemory(); let r = 99, g = 0;
      const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
      while (s.phase !== "GAME_OVER" && g++ < 4000) {
        if (s.phase === "RESULTS") { eng.learn(mem, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
        const a = s.playerIds.map((p) => eng.chooseAction(s, p, "hard", mem, rand)).find((x) => x);
        if (!a) throw new Error("nessuna azione in " + s.phase);
        s = applyAction(s, a).state;
      }
      return s;
    };
    const a = play(), b = play();
    expect(a.phase).toBe("GAME_OVER"); expect(a.scores).toEqual(b.scores);
  });
});
