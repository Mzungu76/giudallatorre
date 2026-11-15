import { describe, expect, it } from "vitest";
import { suggestAction } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import { createRoomBody } from "@gdt/game-protocol";
import { RoomCore } from "../src/RoomCore.ts";
import { deps } from "./helpers.ts";

/** Gioca (con un umano che agisce a caso) fino alla fine; opzionalmente ricrea la stanza dai dati serializzati a metà (riavvio del Durable Object). */
function playSolo(core: RoomCore, humanId: string, opts: { restartAt?: number } = {}) {
  let now = 0, guard = 0, c = core;
  core.onConnect(humanId, 0); core.handle(humanId, { t: "start" }, 0);
  while (c.data.stage === "PLAYING" && guard++ < 6000) {
    const g = c.data.game as GameState, a = suggestAction(g, humanId, Math.random);
    if (a) { const { playerId: _p, ...action } = a as Record<string, unknown>; c.handle(humanId, { t: "act", action } as never, now); }
    else if (g.phase === "RESULTS" || g.phase === "MINI_RESULTS") c.handle(humanId, { t: "act", action: { type: "advance" } }, now);
    now += 1500; c.tick(now);
    if (opts.restartAt === guard) { c = new RoomCore(JSON.parse(JSON.stringify(c.data)), deps(9)); c.onConnect(humanId, now); }
  }
  return { core: c, guard };
}

describe("motore dei bot sperimentale (solo stanze di collaudo)", () => {
  it("di default non cambia nulla: nessuna opzione, nessuna memoria strategica, partita completa con i bot di sempre", () => {
    const c = RoomCore.create("DEFLT", deps(5), 0, { nickname: "Solo", bots: { count: 3, level: "hard" } });
    expect(c.core.data.options.botEngine).toBeUndefined();
    const { core, guard } = playSolo(c.core, c.playerId);
    expect(core.data.stage).toBe("FINISHED"); expect(guard).toBeLessThan(6000); expect(core.data.strat).toBeUndefined();
  });
  it("anche in una stanza di collaudo senza l'opzione i bot restano quelli di sempre", () => {
    const c = RoomCore.create("DBGNO", deps(5), 0, { nickname: "Solo", debug: true, bots: { count: 3, level: "hard" } });
    expect(c.core.data.options.botEngine).toBeUndefined(); expect(playSolo(c.core, c.playerId).core.data.strat).toBeUndefined();
  });
  it("l'opzione vale solo con debug: senza, viene ignorata", () => {
    const c = RoomCore.create("NODBG", deps(5), 0, { nickname: "Solo", botEngine: "strategic", bots: { count: 3, level: "hard" } });
    expect(c.core.data.options.botEngine).toBeUndefined();
  });
  it("il protocollo accetta solo il valore previsto", () => {
    expect(createRoomBody.safeParse({ nickname: "Ale", debug: true, botEngine: "strategic" }).success).toBe(true);
    expect(createRoomBody.safeParse({ nickname: "Ale", debug: true, botEngine: "altro" }).success).toBe(false);
    expect(createRoomBody.safeParse({ nickname: "Ale" }).success).toBe(true);
  });
  it("con l'opzione: 1 umano + 3 bot strategici giocano una partita completa, imparano e la stanza si può riavviare a metà", () => {
    for (const restartAt of [undefined, 40]) {
      const c = RoomCore.create("STRAT", deps(7), 0, { nickname: "Solo", debug: true, botEngine: "strategic", bots: { count: 3, level: "hard" } });
      expect(c.core.data.options.botEngine).toBe("strategic");
      const { core, guard } = playSolo(c.core, c.playerId, restartAt ? { restartAt } : {});
      expect(core.data.stage).toBe("FINISHED"); expect(guard).toBeLessThan(6000);
      const mem = core.data.strat as Record<string, { opp: { turns: unknown[] } }>;
      expect(Object.keys(mem)).toHaveLength(3); for (const m of Object.values(mem)) expect(m.opp.turns.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("tempo di decisione dei bot strategici in stanza (6 giocatori): misurato e contenuto", () => {
    const c = RoomCore.create("TIMEX", deps(11), 0, { nickname: "Solo", debug: true, botEngine: "strategic", bots: { count: 5, level: "hard" } });
    const core = c.core, id = c.playerId; core.onConnect(id, 0); core.handle(id, { t: "start" }, 0);
    let now = 0, guard = 0, worst = 0;
    while (core.data.stage === "PLAYING" && guard++ < 6000) {
      const g = core.data.game as GameState, a = suggestAction(g, id, Math.random);
      if (a) { const { playerId: _p, ...action } = a as Record<string, unknown>; core.handle(id, { t: "act", action } as never, now); }
      else if (g.phase === "RESULTS" || g.phase === "MINI_RESULTS") core.handle(id, { t: "act", action: { type: "advance" } }, now);
      now += 1500; const t0 = performance.now(); core.tick(now); worst = Math.max(worst, performance.now() - t0);
    }
    expect(core.data.stage).toBe("FINISHED"); console.log(`tick peggiore con bot strategici a 6 giocatori: ${worst.toFixed(1)} ms`);
    expect(worst).toBeLessThan(400);
  });
});
