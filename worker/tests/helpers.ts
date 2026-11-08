import { suggestAction, megafonoOf } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { RoomCore } from "../src/RoomCore.ts";
import type { Outbox } from "../src/RoomCore.ts";
import { CONFESSIONS, DECK, PHRASE_DECK, PHRASE_POOL } from "../src/content.ts";

/** Byte "casuali" deterministici per i test. */
export function seqRng(seed = 1) { let s = seed >>> 0; return (n: number) => { const a = new Uint8Array(n); for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; a[i] = s >>> 24; } return a; }; }
export const deps = (seed = 1) => ({ rng: seqRng(seed), deck: DECK, phraseDeck: PHRASE_DECK, phrasePool: PHRASE_POOL, confessions: CONFESSIONS });

export interface Room { core: RoomCore; ids: string[]; tokens: string[]; names: string[] }
/** Crea una stanza con n giocatori tutti connessi. */
export function makeRoom(n: number, seed = 1, now = 1_000_000): Room {
  const names = Array.from({ length: n }, (_, i) => `Giocatore${i + 1}`);
  const first = RoomCore.create("ABCDE", deps(seed), now, { nickname: names[0]!, mode: "table", megafonoSa: false });
  const ids = [first.playerId], tokens = [first.token];
  for (let i = 1; i < n; i++) { const j = first.core.join(names[i]!, now + i); ids.push(j.playerId); tokens.push(j.token); }
  for (const id of ids) first.core.onConnect(id, now);
  return { core: first.core, ids, tokens, names };
}
export const send = (r: Room, who: number, msg: ClientMessage, now = 1_000_100): Outbox => r.core.handle(r.ids[who]!, msg, now);
/** Gioca la partita fino alla fine con giocatori virtuali che inviano messaggi reali. */
export function playToEnd(r: Room, now = 1_000_100, rand: () => number = Math.random) {
  let guard = 0;
  while (r.core.data.stage === "PLAYING") {
    if (++guard > 5000) throw new Error("non termina");
    const g = r.core.data.game as GameState;
    if (g.phase === "RESULTS") { send(r, r.ids.indexOf(megafonoOf(g)), { t: "act", action: { type: "advance" } }, now); continue; }
    if (g.phase === "MINI_RESULTS") { send(r, 0, { t: "act", action: { type: "advance" } }, now); continue; }
    let done = false;
    for (const id of r.ids.slice().sort(() => rand() - 0.5)) {
      const a = suggestAction(g, id, rand); if (!a) continue;
      const { playerId: _p, ...action } = a as Record<string, unknown>;
      const out = r.core.handle(id, { t: "act", action } as ClientMessage, now);
      if (out.send.some((s) => s.msg.t === "error")) throw new Error("azione legittima rifiutata: " + JSON.stringify(out.send.find((s) => s.msg.t === "error")));
      done = true; break;
    }
    if (!done) throw new Error("nessuna azione in fase " + g.phase);
  }
}
