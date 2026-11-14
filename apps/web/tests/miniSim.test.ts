import { describe, expect, it } from "vitest";
import { MINI_SLOT_MS } from "@gdt/game-engine";
import { SIM_DEFAULTS, SIM_ME, humanVote, newSim, onStage, optsFromQuery, optsToQuery, slotsOf, stepSim } from "../src/lib/miniSim.ts";
import type { SimOpts } from "../src/lib/miniSim.ts";

const ids = Array.from({ length: 100 }, (_, i) => `p${String(Math.floor(i / 7) + 1).padStart(2, "0")}-i${String((i % 7) + 1).padStart(2, "0")}`);
const base = (x: Partial<SimOpts> = {}): SimOpts => ({ ...SIM_DEFAULTS, seed: 5, ...x });

describe("simulatore degli intervalli", () => {
  it("ogni modalità e ogni numero di giocatori arrivano all'inizio dell'intervallo, con 6 carte e 18 uscite", () => {
    for (const kind of ["accusa", "amore", "peggiore"] as const) for (const players of [3, 4, 5, 6]) {
      const r = newSim(base({ kind, players }), ids, 1_000_000);
      expect(r.state.phase, `${kind} ${players}`).toBe("MINI_RUN"); expect(r.state.tower).toHaveLength(6); expect(r.state.mini!.order).toHaveLength(18);
      expect(r.state.mini!.kind).toBe(kind); expect(r.state.playerIds).toHaveLength(players);
    }
  });
  it("tempi di partenza: dall'inizio 9 s al «via», dal 3-2-1 3 s, dalla corsa subito", () => {
    expect(newSim(base({ start: "inizio" }), ids, 0).goAt).toBe(12000);
    expect(newSim(base({ start: "conto" }), ids, 0).goAt).toBe(3000);
    expect(newSim(base({ start: "corsa" }), ids, 0).goAt).toBeLessThan(1000);
  });
  it("i bot votano ai tempi previsti, ognuno quando la sua carta è in scena; a fine corsa si contano i voti", () => {
    const r = newSim(base({ votes: "forzato", forced: [2], players: 4 }), ids, 0), order = r.state.mini!.order;
    expect(Object.keys(r.plan).sort()).toEqual(["p2", "p3", "p4"]);
    for (const v of Object.values(r.plan)) { expect(v.position).toBe(2); expect(slotsOf(order, 2).some((i) => v.at >= r.goAt + i * MINI_SLOT_MS && v.at < r.goAt + (i + 1) * MINI_SLOT_MS)).toBe(true); }
    expect(stepSim(r, r.goAt - 100)).toBe(r);   // prima del «via» non succede nulla
    let s = stepSim(r, r.goAt + 60 * MINI_SLOT_MS / 3 * 3);   // molto dopo: hanno votato tutti i bot
    expect(Object.keys(s.state.votes).sort()).toEqual(["p2", "p3", "p4"]);
    s = stepSim(s, s.endAt + 1);
    expect(s.state.phase).toBe("MINI_RESULTS"); expect(s.state.miniResult!.leaders).toEqual([2]);
  });
  it("tutti votano (anche il giocatore in automatico): l'intervallo si chiude da solo prima di fine corsa", () => {
    const r = newSim(base({ votes: "presto", forced: [3], autoMe: true, players: 3 }), ids, 0);
    const s = stepSim(r, r.goAt + 10 * MINI_SLOT_MS);
    expect(s.state.phase).toBe("MINI_RESULTS"); expect(s.endAt).toBeGreaterThan(r.goAt + 10 * MINI_SLOT_MS);
  });
  it("nessun voto: a fine corsa non cade e non vince nessuno", () => {
    const r = newSim(base({ votes: "nessuno" }), ids, 0), s = stepSim(r, r.endAt + 1);
    expect(s.state.miniResult!.leaders).toEqual([]);
  });
  it("il giocatore vota con lo stesso controllo del server: solo se la carta è in scena", () => {
    const r = newSim(base({ votes: "nessuno" }), ids, 0), order = r.state.mini!.order, c = order[1]!;
    expect(onStage(r, c, r.goAt + MINI_SLOT_MS + 500)).toBe(true);
    expect(humanVote(r, c, r.goAt - 2000)).toBeNull();
    const v = humanVote(r, c, r.goAt + MINI_SLOT_MS + 500)!;
    expect(v.state.votes[SIM_ME]).toBe(c); expect(humanVote(v, c, r.goAt + MINI_SLOT_MS + 600)).toBeNull();   // un voto solo
  });
  it("partenza dal verdetto o dai punti: l'intervallo è già concluso, con l'esito scelto", () => {
    for (const start of ["verdetto", "punti"] as const) {
      const r = newSim(base({ kind: "peggiore", start, votes: "forzato", forced: [2, 5], autoMe: true, players: 4 }), ids, 0);
      expect(r.state.phase).toBe("MINI_RESULTS"); expect(r.state.miniResult!.leaders).toEqual([2, 5]); expect(r.state.miniResult!.fallenPositions).toEqual([2, 5]);
    }
  });
  it("il collegamento riproduce lo scenario", () => {
    const o = base({ kind: "amore", start: "corsa", votes: "forzato", forced: [1, 4], autoMe: true, players: 5, level: "hard" });
    expect(optsFromQuery(new URLSearchParams(optsToQuery(o)))).toEqual(o);
    expect(optsFromQuery(new URLSearchParams("k=boh&n=99&e=9,2"))).toMatchObject({ kind: "accusa", players: 6, forced: [2] });
  });
});
