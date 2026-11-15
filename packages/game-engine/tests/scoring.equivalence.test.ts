import { describe, expect, it } from "vitest";
import { applyAction, chooseBotAction, createGame, luiTokens, megafonoOf, newBotMemory, scoreTurn, learnFromResult } from "../src/index.ts";
import type { BotLevel, TowerSlot } from "../src/index.ts";
import { nextRandom } from "../src/rng.ts";
import { cfg } from "./helpers.ts";

const tower = (owners: (string | null)[]): TowerSlot[] => owners.map((o, i) => ({ position: i + 1, cardId: `c${i + 1}`, ownerId: o }));
const ids = ["a", "b", "c", "d"];

describe("scoreTurn: esempi calcolati a mano", () => {
  it("CADE che cade: +4 al Megafono e a chi l'ha votata, +2 ai voti giusti e al proprietario", () => {
    const r = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 3, b: 2, c: 2, d: 2 }, [{ slot: "cade", effect: "cade", position: 2 }]);
    expect(r.T.fallen).toEqual([2]);
    expect(r.points).toEqual({ a: 4, b: 2 + 2 + 4, c: 2 + 4, d: 2 + 4 });
  });
  it("NON CADE a segno vale +2 al Megafono e +2 a chi la votava", () => {
    const r = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 1, b: 4, c: 1, d: 1 }, [{ slot: "noncade", effect: "noncade", position: 4 }]);
    expect(r.T.fallen).toEqual([1]);
    expect(r.points).toEqual({ a: 2 + 2 + 2, b: 2, c: 2, d: 2 });
  });
  it("VOTI NULLI!: nessun punto dal segnalino e il voto annullato non vale", () => {
    const r = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 1, b: 2, c: 2, d: 2 }, [{ slot: "nulli", effect: "nulli", position: 2 }]);
    expect(r.T.annulled.sort()).toEqual(["b", "c", "d"]);
    expect(r.points).toEqual({ a: 4, b: 0, c: 0, d: 0 });
  });
  it("proprietari nascosti: nessun +2 della carta", () => {
    const r = scoreTurn(tower([null, null, null, null]), ids, "a", { a: 2, b: 2, c: 2, d: 2 }, [{ slot: "noncade", effect: "noncade", position: 1 }]);
    expect(r.lines.b!.map((l) => l.kind)).toEqual(["voto"]);
  });
  it("senza dettaglio (withLines = false) i punti sono gli stessi", () => {
    const a = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 3, b: 2, c: 2, d: 2 }, [{ slot: "cade", effect: "cade", position: 2 }]);
    const b = scoreTurn(tower(["a", "b", "c", "d"]), ids, "a", { a: 3, b: 2, c: 2, d: 2 }, [{ slot: "cade", effect: "cade", position: 2 }], false);
    expect(b.points).toEqual(a.points); expect(b.lines).toEqual({});
  });
});

describe("scoreTurn coincide con resolve() del motore ufficiale", () => {
  it("su centinaia di turni reali (3–8 giocatori, tutti i segnalini, pareggi compresi): stessi punti, stesse voci, stessi esiti", () => {
    let checked = 0; const seenMarks = new Set<string>(); let ties = 0;
    for (let seed = 1; seed <= 14; seed++) for (const n of [3, 4, 5, 6, 8]) {
      let s = createGame(cfg(n, { seed })).state; const mem = newBotMemory(); let r = seed * 7919 + n, g = 0;
      const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
      while (s.phase !== "GAME_OVER" && g++ < 5000) {
        if (s.phase === "RESULTS") { learnFromResult(mem, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
        let act = null;
        for (const p of s.playerIds) { act = chooseBotAction(s, p, (["easy", "medium", "hard"] as BotLevel[])[(seed + g) % 3]!, mem, rand); if (act) break; }
        if (!act) break;
        const pre = s, next = applyAction(pre, act).state;
        if (act.type === "vote" && next.phase === "RESULTS") {
          const res = next.lastResult!, votes = { ...pre.votes, [act.playerId]: act.position };
          const marks = (pre.marks ?? []).map((m) => ({ slot: m.slot, effect: luiTokens(pre).find((x) => x.slot === m.slot)?.effect ?? "nulli", position: m.position }));
          const sc = scoreTurn(pre.tower, pre.playerIds, megafonoOf(pre), votes, marks);
          expect(sc.points, `seed ${seed} n ${n} turno ${pre.turnNumber}`).toEqual(res.points);
          expect(sc.lines).toEqual(res.lines);
          expect(sc.T.fallen).toEqual(res.fallenPositions);
          expect(sc.T.tie).toBe(res.tie);
          expect(sc.outs).toEqual(res.marks);
          checked++; seenMarks.add(`${marks[0]!.effect}:${res.marks[0]!.hit}`); if (res.tie) ties++;
        }
        s = next;
      }
    }
    expect(checked).toBeGreaterThan(300);
    for (const k of ["cade:true", "cade:false", "noncade:true", "noncade:false", "nulli:true"]) expect(seenMarks.has(k), `caso non coperto: ${k}`).toBe(true);
    expect(ties).toBeGreaterThan(0);
  });
});
