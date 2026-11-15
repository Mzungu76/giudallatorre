import { affinity, legalActions, phraseTagCount } from "@gdt/game-engine";
import type { Action, Observation } from "@gdt/game-engine";
import type { StrategicEngine } from "../api.ts";
import { sampleFrom } from "../sim/montecarlo.ts";

/**
 * Avversario SINTETICO «scettico» per il laboratorio: ragiona come un giocatore che non si fida del segnalino. Vota per affinità carta↔frase
 * (softmax), IGNORANDO dove è posato il segnalino; posa il segnalino sulla carta più affine con tipi misti; gioca la carta più affine.
 * Non è un bot del gioco: serve a provare i motori contro un comportamento DIVERSO da quello dei bot attuali su cui sono stati addestrati.
 */
const TEMP = 1.5;
export const affinityVoter: StrategicEngine<null> = {
  id: "scettico-1", label: "Scettico (vota per affinità, ignora il segnalino)",
  newMemory: () => null, learn: () => {},
  decide: (_m, o: Observation, ctx): Action | null => {
    const legal = legalActions(o); if (!legal.length) return null;
    const me = o.viewerId, text = o.phrase?.text, aff = (c: string) => (text ? affinity(c, text) ?? 0 : 0), pickByAff = (cards: { position: number; cardId: string }[], excl: number | null) => {
      const opts = cards.filter((c) => c.position !== excl), w = opts.map((c) => Math.exp(aff(c.cardId) / TEMP)), z = w.reduce((a, b) => a + b, 0);
      return opts[sampleFrom(w.map((x) => x / z), ctx.rand()) - 1]!.position;
    };
    switch (o.phase) {
      case "PROCLAIM": { const t = o.proclaimCard!.phrases.map(phraseTagCount), b = Math.max(...t), top = t.flatMap((v, i) => (v === b ? [i] : [])); return { type: "choosePhrase", playerId: me, mode: "card", index: top[Math.floor(ctx.rand() * top.length)]! }; }
      case "PLAY": return { type: "playCard", playerId: me, cardId: o.myHand.slice().sort((a, b) => aff(b) + ctx.rand() * 0.8 - aff(a) - ctx.rand() * 0.8)[0]! };
      case "SUSPECT": { const u = ctx.rand(), type = u < 0.45 ? "cade" : u < 0.7 ? "noncade" : "nulli"; return { type: "placeMarks", playerId: me, marks: [{ slot: type, position: pickByAff(o.tower, null) }] }; }
      case "VOTE": return { type: "vote", playerId: me, position: pickByAff(o.tower, o.myForbidden) };
      default: return legal[Math.floor(ctx.rand() * legal.length)]!;
    }
  },
};
