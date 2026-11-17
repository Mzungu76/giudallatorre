import { describe, expect, it } from "vitest";
import { suggestAction } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import { createRoomBody } from "@gdt/game-protocol";
import { RoomCore } from "../src/RoomCore.ts";
import { deps } from "./helpers.ts";

/** Gioca la stanza come farebbe l'host: tutto ciò che il motore gli chiede (Megafono: segnalino; voto; avanti). */
function gioca(core: RoomCore, host: string) {
  let now = 0, guard = 0, cartaBonus = 0; const visti = new Set<string>();
  core.onConnect(host, 0); core.handle(host, { t: "start" }, 0);
  const g0 = core.data.game as GameState; visti.add(g0.phase);
  while (core.data.stage === "PLAYING" && guard++ < 400) {
    const g = core.data.game as GameState; visti.add(g.phase);
    if (g.lastResult) for (const l of Object.values(g.lastResult.lines).flat()) if (l.kind === "carta") cartaBonus++;
    const a = suggestAction(g, host, Math.random);
    if (a) { const { playerId: _p, ...action } = a as Record<string, unknown>; core.handle(host, { t: "act", action } as never, now); }
    else if (g.phase === "RESULTS") core.handle(host, { t: "act", action: { type: "advance" } }, now);
    now += 1500; core.tick(now);
  }
  return { visti, guard, cartaBonus };
}

describe("partita Flash: due turni", () => {
  it("il protocollo accetta flash e flashMega", () => {
    expect(createRoomBody.safeParse({ nickname: "Io", flash: true, flashMega: "host", bots: { count: 3, level: "hard" } }).success).toBe(true);
    expect(createRoomBody.safeParse({ nickname: "Io", flash: true, flashMega: "boh" }).success).toBe(false);
  });
  it("frase e carte si assegnano da sole: si va subito al segnalino e al voto; due turni e basta, senza premio né spareggio", () => {
    for (const mega of ["host", "random"] as const) for (let i = 0; i < 4; i++) {
      const c = RoomCore.create("FLASH", deps(20 + i), 0, { nickname: "Io", flash: true, flashMega: mega, bots: { count: 3, level: "hard" } });
      expect(c.core.data.options.flash).toBe(true);
      const { visti, cartaBonus } = gioca(c.core, c.playerId), g = c.core.data.game as GameState;
      expect(c.core.data.stage).toBe("FINISHED"); expect(g.phase).toBe("GAME_OVER"); expect(g.totalTurns).toBe(2); expect(g.history).toHaveLength(2);
      expect(cartaBonus).toBe(0);   // nessun +2 per la carta caduta: nessuno sceglie le carte
      expect(g.award).toBeNull(); expect(g.winners!.length).toBeGreaterThan(0); expect(g.goldenTurns).toBe(0);
      expect(visti.has("PROCLAIM") && !visti.has("PLAY")).toBe(false);   // le fasi di scelta non sono mai lasciate al giocatore
      expect(visti.has("PROCLAIM")).toBe(false); expect(visti.has("PLAY")).toBe(false); expect(visti.has("VOTE")).toBe(true);
      expect(g.history![0]!.megafonoId).not.toBe(g.history![1]!.megafonoId);   // il Megafono ruota
    }
  });
  it("«Io faccio il Megafono»: l'host posa il segnalino; «a caso»: il Megafono varia da una stanza all'altra", () => {
    const m = (mega: "host" | "random", i: number) => { const c = RoomCore.create("FLSH" + i, deps(40 + i), 0, { nickname: "Io", flash: true, flashMega: mega, bots: { count: 3, level: "hard" } }); c.core.onConnect(c.playerId, 0); c.core.handle(c.playerId, { t: "start" }, 0); const g = c.core.data.game as GameState; return g.playerIds[g.megafonoIndex] === c.playerId; };
    for (let i = 0; i < 8; i++) expect(m("host", i)).toBe(true);
    const caso = Array.from({ length: 160 }, (_, i) => m("random", 100 + i)), quota = caso.filter(Boolean).length / caso.length;
    expect(quota).toBeGreaterThan(0.12); expect(quota).toBeLessThan(0.4);   // con 4 giocatori l'host è Megafono circa 1 volta su 4
  });
});
