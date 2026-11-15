import { describe, expect, it } from "vitest";
import { suggestAction } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import { createRoomBody } from "@gdt/game-protocol";
import { RoomCore } from "../src/RoomCore.ts";
import { deps } from "./helpers.ts";

function playSolo(core: RoomCore, humanId: string, restartAt?: number) {
  let now = 0, guard = 0, c = core, worst = 0;
  core.onConnect(humanId, 0); core.handle(humanId, { t: "start" }, 0);
  while (c.data.stage === "PLAYING" && guard++ < 6000) {
    const g = c.data.game as GameState, a = suggestAction(g, humanId, Math.random);
    if (a) { const { playerId: _p, ...action } = a as Record<string, unknown>; c.handle(humanId, { t: "act", action } as never, now); }
    else if (g.phase === "RESULTS" || g.phase === "MINI_RESULTS") c.handle(humanId, { t: "act", action: { type: "advance" } }, now);
    now += 1500; const t0 = performance.now(); c.tick(now); worst = Math.max(worst, performance.now() - t0);
    if (restartAt === guard) { c = new RoomCore(JSON.parse(JSON.stringify(c.data)), deps(9)); c.onConnect(humanId, now); }
  }
  return { core: c, guard, worst };
}

describe("bot nuovi (v2 con etichette v2) di default; v2 / attuali solo in collaudo", () => {
  it("le stanze nuove usano di default i bot nuovi (v2e), anche senza debug; l'opzione esplicita vale solo con debug", () => {
    for (const debug of [false, true]) {
      const c = RoomCore.create("DEFLT", deps(5), 0, { nickname: "Solo", ...(debug ? { debug: true } : {}), bots: { count: 3, level: "hard" } });
      expect(c.core.data.options.botEngine).toBe("v2e"); expect(playSolo(c.core, c.playerId).core.data.stage).toBe("FINISHED");
    }
    const a = RoomCore.create("ATTUA", deps(6), 0, { nickname: "Solo", debug: true, botEngine: "attuali", bots: { count: 3, level: "hard" } });
    expect(a.core.data.options.botEngine).toBe("attuali"); expect(playSolo(a.core, a.playerId).core.data.stage).toBe("FINISHED");
  });
  it("kill switch: con NEW_BOTS_DEFAULT spento tornano i bot di sempre (verificato leggendo la costante e il ramo)", async () => {
    const { NEW_BOTS_DEFAULT, V2_BOTS_ENABLED } = await import("../src/RoomCore.ts");
    expect(NEW_BOTS_DEFAULT).toBe(true); expect(V2_BOTS_ENABLED).toBe(true);
  });
  it("tempo del tick a 6 giocatori: bot attuali e v2, 5 partite ciascuno (informativo)", () => {
    const worst = (opt: object) => { let w = 0, sum = 0; for (let k = 0; k < 5; k++) { const c = RoomCore.create("TIMEZ", deps(20 + k), 0, { nickname: "Solo", debug: true, ...opt, bots: { count: 5, level: "hard" } }); const r = playSolo(c.core, c.playerId); w = Math.max(w, r.worst); sum += r.worst; } return { w, mean: sum / 5 }; };
    const a = worst({ botEngine: "attuali" }), b = worst({ botEngine: "v2e" });
    console.log(`tick peggiore (max su 5 partite): bot attuali ${a.w.toFixed(1)} ms, v2 ${b.w.toFixed(1)} ms; media dei massimi ${a.mean.toFixed(1)} / ${b.mean.toFixed(1)}`);
    expect(b.w).toBeLessThan(250);
  });
  it("l'opzione vale solo con debug e solo per il valore previsto", () => {
    expect(RoomCore.create("NODBG", deps(5), 0, { nickname: "Solo", botEngine: "v2", bots: { count: 3, level: "hard" } }).core.data.options.botEngine).toBe("v2e");   // senza debug l'opzione è ignorata: vale il predefinito
    expect(createRoomBody.safeParse({ nickname: "Ale", debug: true, botEngine: "v2" }).success).toBe(true);
    expect(createRoomBody.safeParse({ nickname: "Ale", debug: true, botEngine: "x" }).success).toBe(false);
  });
  it("con l'opzione: partita completa con bot v2, anche con riavvio a metà; memoria serializzabile; tempo del tick contenuto", () => {
    for (const [restartAt, bots] of [[undefined, 3], [40, 3], [undefined, 5]] as const) {
      const c = RoomCore.create("V2XXX", deps(7), 0, { nickname: "Solo", debug: true, botEngine: "v2", bots: { count: bots, level: "hard" } });
      expect(c.core.data.options.botEngine).toBe("v2");
      const { core, guard, worst } = playSolo(c.core, c.playerId, restartAt);
      expect(core.data.stage).toBe("FINISHED"); expect(guard).toBeLessThan(6000); expect(worst).toBeLessThan(100);
      expect(Object.keys((core.data.botMem as { follow?: object }).follow ?? {}).length).toBeGreaterThan(0);   // ha imparato quanto ognuno segue il segnalino
      if (bots === 5) console.log(`tick peggiore con bot v2 a 6 giocatori: ${worst.toFixed(1)} ms`);
    }
  });
  it("v2e (v2 con etichette v2): accettata solo con debug, partita completa, la leva globale resta spenta", async () => {
    const { TUNE } = await import("../../packages/game-engine/src/ai-v2/ai.ts");
    expect(createRoomBody.safeParse({ nickname: "Ale", debug: true, botEngine: "v2e" }).success).toBe(true);
    expect(RoomCore.create("NODB2", deps(5), 0, { nickname: "Solo", botEngine: "attuali", bots: { count: 3, level: "hard" } }).core.data.options.botEngine).toBe("v2e");   // senza debug l'opzione è ignorata
    const c = RoomCore.create("V2EXX", deps(9), 0, { nickname: "Solo", debug: true, botEngine: "v2e", bots: { count: 3, level: "hard" } });
    expect(c.core.data.options.botEngine).toBe("v2e");
    expect(playSolo(c.core, c.playerId).core.data.stage).toBe("FINISHED");
    expect(TUNE.labelsV2).toBe(0);
  });
  it("v2m (etichette morbide): accettata solo con debug, partita completa, le leve globali restano spente", async () => {
    const { TUNE } = await import("../../packages/game-engine/src/ai-v2/ai.ts");
    expect(createRoomBody.safeParse({ nickname: "Ale", debug: true, botEngine: "v2m" }).success).toBe(true);
    const c = RoomCore.create("V2MXX", deps(11), 0, { nickname: "Solo", debug: true, botEngine: "v2m", bots: { count: 3, level: "hard" } });
    expect(c.core.data.options.botEngine).toBe("v2m");
    expect(playSolo(c.core, c.playerId).core.data.stage).toBe("FINISHED");
    expect(TUNE.labelsV2).toBe(0); expect(TUNE.labelsSmooth).toBe(0);
  });
  it("v2o (occhi diversi): accettata solo con debug, partita completa con intervallo, le leve globali restano spente", async () => {
    const { TUNE } = await import("../../packages/game-engine/src/ai-v2/ai.ts");
    expect(createRoomBody.safeParse({ nickname: "Ale", debug: true, botEngine: "v2o" }).success).toBe(true);
    const c = RoomCore.create("V2OXX", deps(13), 0, { nickname: "Solo", debug: true, botEngine: "v2o", bots: { count: 3, level: "hard" } });
    expect(c.core.data.options.botEngine).toBe("v2o");
    expect(playSolo(c.core, c.playerId).core.data.stage).toBe("FINISHED");
    expect(TUNE.labelsV2).toBe(0); expect(TUNE.labelsSmooth).toBe(0);
  });
});
