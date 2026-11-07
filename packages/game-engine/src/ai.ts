import { megafonoOf, requiredPlayers } from "./engine.ts";
import type { Action, CardId, GameState, PlayerId, TurnResult } from "./types.ts";

/** Livelli dei giocatori virtuali. Nessuno "capisce" frasi o illustrazioni: la competitività è tattica (punteggio atteso, spareggi, memoria dei personaggi caduti). */
const BOT_REASONS = ["Ha proprio la faccia giusta.", "Istinto, non si discute.", "Mi ricorda mio cugino.", "Lo farebbe di sicuro, ci giurerei.", "Basta guardarlo negli occhi.", "Si vede lontano un miglio.", "Elementare, direi.", "Ci metto la mano sul fuoco.", "Lo conosco, è proprio lui.", "Non c’è storia, è quello."];
export const BOT_LEVELS = ["easy", "medium", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

/** Memoria condivisa della stanza: quante volte ogni carta è stata sulla Torre e quante è caduta. Serializzabile. */
export interface BotMemory { shown: Record<CardId, number>; fell: Record<CardId, number>; turns: number }
export const newBotMemory = (): BotMemory => ({ shown: {}, fell: {}, turns: 0 });
export function learnFromResult(mem: BotMemory, tower: { cardId: CardId }[], result: TurnResult): void {
  for (const t of tower) mem.shown[t.cardId] = (mem.shown[t.cardId] ?? 0) + 1;
  mem.fell[result.fallenCardId] = (mem.fell[result.fallenCardId] ?? 0) + 1; mem.turns += 1;
}

/** Probabilità stimata che ciascuna posizione cada (somma 1): uniforme senza storia, poi inclina verso le carte che cadono spesso. */
function fallProbs(s: GameState, mem: BotMemory, strength: number): number[] {
  const w = s.tower.map((t) => 1 + strength * ((mem.fell[t.cardId] ?? 0) + 0.5) / ((mem.shown[t.cardId] ?? 0) + 2) * s.tower.length);
  const sum = w.reduce((a, b) => a + b, 0); return w.map((x) => x / sum);
}
const argmax = (a: number[]) => a.indexOf(Math.max(...a));
const argmin = (a: number[]) => a.indexOf(Math.min(...a));

export function chooseBotAction(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number): Action | null {
  const mega = megafonoOf(s), pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!;
  const strength = level === "hard" ? 1 : level === "medium" ? 0.6 : 0;
  switch (s.phase) {
    case "PROCLAIM": {
      if (me !== mega) return null;
      const c = s.proclaim!; return { type: "choosePhrase", playerId: me, mode: "card", index: Math.floor(rand() * c.phrases.length) };
    }
    case "PLAY": {
      if (!requiredPlayers(s).includes(me) || s.played[me] !== undefined) return null;
      const hand = s.hands[me]!;
      if (level === "easy") return { type: "playCard", playerId: me, cardId: pick(hand) };
      // gioca la carta che storicamente cade di più: se cade prende +2 come proprietario
      const score = (c: CardId) => ((mem.fell[c] ?? 0) + 0.5) / ((mem.shown[c] ?? 0) + 2) + (level === "hard" ? 0 : rand() * 0.15);
      return { type: "playCard", playerId: me, cardId: hand.slice().sort((a, b) => score(b) - score(a))[0]! };
    }
    case "SUSPECT": {
      if (me !== mega) return null;
      const n = s.tower.length;
      if (level === "easy") return { type: "placeLui", playerId: me, kind: rand() < 0.5 ? "CADE" : "NON_CADE", position: 1 + Math.floor(rand() * n) };
      const p = fallProbs(s, mem, strength), hi = argmax(p), lo = argmin(p);
      // valore atteso con il malus: CADE = 4·p − (1−p) ; NON CADE = 1·(1−p) − p
      const evCade = 5 * p[hi]! - 1, evNon = 1 - 2 * p[lo]!;
      return evCade > evNon ? { type: "placeLui", playerId: me, kind: "CADE", position: hi + 1 } : { type: "placeLui", playerId: me, kind: "NON_CADE", position: lo + 1 };
    }
    case "VOTE": {
      if (s.votes[me] !== undefined) return null;
      const n = s.tower.length;
      const vote = (position: number): Action => ({ type: "vote", playerId: me, position, ...(s.justifyVotes ? { reason: BOT_REASONS[Math.floor(rand() * BOT_REASONS.length)]! } : {}) });
      if (level === "easy") return vote(1 + Math.floor(rand() * n));
      const p = fallProbs(s, mem, strength), ownPos = s.tower.find((t) => t.ownerId === me)?.position ?? -1; // ogni giocatore conosce la propria carta
      const lui = s.lui; let best = 0, bestV = -1;
      for (let k = 0; k < n; k++) {
        let v = p[k]! * (2 + (k + 1 === ownPos ? 2 : 0));            // +2 se è il caduto, +2 in più se è la mia carta
        if (level === "hard") {
          // il Megafono decide i pareggi: coerente con la propria scommessa (se so quale, lo scopro solo se sono io)
          if (me === mega && lui) v += (lui.kind === "CADE" ? (lui.position === k + 1 ? 0.8 : 0) : (lui.position === k + 1 ? -2 : 0.3));
          if (me !== mega && lui && lui.position === k + 1) v += 0.15; // il Megafono spesso scommette su ciò che sospetta
        }
        v += rand() * (level === "hard" ? 0.12 : 0.35);
        if (v > bestV) { bestV = v; best = k; }
      }
      return vote(best + 1);
    }
    default: return null;
  }
}
