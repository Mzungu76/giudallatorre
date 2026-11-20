import { describe, expect, it } from "vitest";
import { suggestAction } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import { createRoomBody, clientMessageSchema } from "@gdt/game-protocol";
import { EXPANSIONS, DECK } from "../src/content.ts";
import { RoomCore } from "../src/RoomCore.ts";
import { deps, makeRoom, playToEnd, send } from "./helpers.ts";

const deckIds = (g: GameState) => [...g.drawPile, ...g.discardPile, ...Object.values(g.hands).flat(), ...g.tower.map((t) => t.cardId)];

describe("espansioni nelle partite", () => {
  it("il registro ha il mazzo Summit: 36 carte (summit-cNN) e 18 frasi", () => {
    expect(EXPANSIONS.summit!.cards).toHaveLength(36);
    expect(EXPANSIONS.summit!.cards[0]).toBe("summit-c01");
    expect(EXPANSIONS.summit!.phrases).toHaveLength(18);
  });
  it("il protocollo accetta le espansioni e le carte con il nuovo identificativo, e rifiuta il resto", () => {
    expect(createRoomBody.safeParse({ nickname: "Ada", espansioni: ["summit"] }).success).toBe(true);
    expect(createRoomBody.safeParse({ nickname: "Ada", espansioni: ["../x"] }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ t: "act", action: { type: "playCard", cardId: "summit-c07" } }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ t: "act", action: { type: "playCard", cardId: "summit-c7x" } }).success).toBe(false);
  });
  it("senza espansioni il mazzo è quello base; con Summit si aggiungono le 36 carte; id sconosciuti ignorati", () => {
    const base = makeRoom(4, 70); send(base, 0, { t: "start" });
    expect(base.core.data.options.espansioni).toBeUndefined();
    expect(deckIds(base.core.data.game!).length).toBe(DECK.length);
    const conf = makeRoom(4, 71, 1_000_000, { espansioni: ["summit", "summit", "nonesiste"], espLivelli: { summit: "tutto" } }); send(conf, 0, { t: "start" });
    expect(conf.core.data.options.espansioni).toEqual(["summit"]);
    const ids = deckIds(conf.core.data.game!);
    expect(ids.length).toBe(DECK.length + 36); expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((i) => i.startsWith("summit-")).length).toBe(36);
  });
  it("intensità: assaggio 12 carte, metà 18 (predefinito), tutto 36; cambiano a ogni partita; frasi 1 / 3 / tutte", () => {
    const conta = (r: ReturnType<typeof makeRoom>) => deckIds(r.core.data.game!).filter((i) => i.startsWith("summit-"));
    const nFrasi = (r: ReturnType<typeof makeRoom>) => { const g = r.core.data.game!, testi = new Set(EXPANSIONS.summit!.phrases.map((f) => `Oggi ${f.verb} sulla torre ${f.text}`)); return [g.proclaim!, ...g.phraseDraw].filter((c) => c.phrases.some((t) => testi.has(t))).length; };
    const prova = (liv: "assaggio" | "meta" | "tutto" | undefined, seed: number) => { const r = makeRoom(4, seed, 1_000_000, { espansioni: ["summit"], ...(liv ? { espLivelli: { summit: liv } } : {}) }); send(r, 0, { t: "setOptions", ageBand: 14 }); send(r, 0, { t: "start" }); return r; };
    expect(conta(prova("assaggio", 90))).toHaveLength(12); expect(conta(prova("meta", 90))).toHaveLength(18); expect(conta(prova(undefined, 90))).toHaveLength(18); expect(conta(prova("tutto", 90))).toHaveLength(36);
    expect(conta(prova("meta", 91)).sort().join()).not.toBe(conta(prova("meta", 92)).sort().join());   // estrazione diversa a ogni partita
    expect(nFrasi(prova("assaggio", 93))).toBe(1); expect(nFrasi(prova("meta", 93))).toBe(3); expect(nFrasi(prova("tutto", 93))).toBeGreaterThanOrEqual(4);
  });
  it("il protocollo accetta i livelli e rifiuta valori sconosciuti; la stanza li ricorda", () => {
    expect(createRoomBody.safeParse({ nickname: "Ada", espansioni: ["summit"], espLivelli: { summit: "assaggio" } }).success).toBe(true);
    expect(createRoomBody.safeParse({ nickname: "Ada", espansioni: ["summit"], espLivelli: { summit: "troppo" } }).success).toBe(false);
    const r = makeRoom(3, 94, 1_000_000, { espansioni: ["summit", "altro"], espLivelli: { summit: "assaggio", altro: "tutto" } });
    expect(r.core.data.options.espLivelli).toEqual({ summit: "assaggio" });
  });
  it("«solo i loro personaggi»: tutte le carte sono Summit se bastano per tutti (36 → fino a 6 giocatori), altrimenti mazzo misto", () => {
    const r = makeRoom(4, 80, 1_000_000, { espansioni: ["summit"], soloEsp: true }); send(r, 0, { t: "start" });
    const ids = deckIds(r.core.data.game!); expect(ids).toHaveLength(36); expect(ids.every((i) => i.startsWith("summit-"))).toBe(true);
    const r7 = makeRoom(6, 81, 1_000_000, { espansioni: ["summit"], soloEsp: true }); send(r7, 0, { t: "start" });
    expect(deckIds(r7.core.data.game!)).toHaveLength(36);   // 6 × 6 = 36: bastano giusto
  });
  it("le frasi del mazzo entrano tra le prime carte del Megafono", () => {
    let visto = 0;
    for (let s = 0; s < 10; s++) {
      const r = makeRoom(4, 100 + s, 1_000_000, { espansioni: ["summit"] }); send(r, 0, { t: "setOptions", ageBand: 14 }); send(r, 0, { t: "start" });
      const g = r.core.data.game!, primi = [g.proclaim!, ...g.phraseDraw.slice(0, 7)], testi = new Set(EXPANSIONS.summit!.phrases.map((f) => `Oggi ${f.verb} sulla torre ${f.text}`));
      if (primi.some((c) => c.phrases.some((t) => testi.has(t)))) visto++;
    }
    expect(visto).toBeGreaterThanOrEqual(8);
  });
  it("partite complete giocate dall'intelligenza dei bot (suggestAction) con i personaggi dell'espansione, senza errori", () => {
    for (const age of [10, 18] as const) for (const n of [3, 5]) {
      const r = makeRoom(n, 200 + n + age, 1_000_000, { espansioni: ["summit"] }); send(r, 0, { t: "setOptions", ageBand: age }); send(r, 0, { t: "start" });
      let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      expect(() => playToEnd(r, 1_000_100, rand)).not.toThrow();
      expect(r.core.data.stage).toBe("FINISHED");
    }
  });
  it("partita da solo contro i bot veri (tutti i livelli) con l'espansione: finisce e i personaggi Summit vengono giocati", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      const { core, playerId } = RoomCore.create("SUMMT", deps(33), 0, { nickname: "Solo", espansioni: ["summit"], bots: { count: 3, level } });
      core.onConnect(playerId, 0); core.handle(playerId, { t: "start" }, 0);
      let now = 0, guard = 0, giocate = 0;
      while (core.data.stage === "PLAYING" && guard++ < 6000) {
        const g = core.data.game as GameState, a = suggestAction(g, playerId, Math.random);
        if (a) { const { playerId: _p, ...action } = a as Record<string, unknown>; core.handle(playerId, { t: "act", action } as never, now); }
        else if (g.phase === "RESULTS" || g.phase === "MINI_RESULTS") core.handle(playerId, { t: "act", action: { type: "advance" } }, now);
        giocate += (core.data.game as GameState).tower.filter((t) => t.cardId.startsWith("summit-")).length;
        now += 1500; core.tick(now);
      }
      expect(core.data.stage).toBe("FINISHED"); expect(giocate).toBeGreaterThan(0);
    }
  });
});
