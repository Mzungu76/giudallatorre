import { megafonoOf, requiredPlayers } from "./engine.ts";
import { affinity, phraseTagCount } from "./tags.ts";
import type { Action, CardId, GameState, PlayerId, TurnResult } from "./types.ts";

/**
 * Giocatori virtuali. Usano le etichette nascoste (personaggio ↔ frase, vedi tags.ts) per stimare chi cadrà, il punteggio atteso,
 * la regola del gregge e il bluff del Megafono. Senza etichette (mazzi di prova) ripiegano sulla memoria dei personaggi caduti.
 */
export const BOT_LEVELS = ["easy", "medium", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

/** Memoria della stanza: personaggi mostrati/caduti e, per ogni Megafono, quante volte ha scommesso "Cade lui!" (reputazione). Serializzabile. */
export interface BotMemory { shown: Record<CardId, number>; fell: Record<CardId, number>; turns: number; lui?: Record<PlayerId, { c: number; n: number }> }
export const newBotMemory = (): BotMemory => ({ shown: {}, fell: {}, turns: 0, lui: {} });
export function learnFromResult(mem: BotMemory, tower: { cardId: CardId }[], result: TurnResult): void {
  for (const t of tower) mem.shown[t.cardId] = (mem.shown[t.cardId] ?? 0) + 1;
  for (const c of result.fallenCardIds ?? [result.fallenCardId]) mem.fell[c] = (mem.fell[c] ?? 0) + 1; mem.turns += 1;
  if (result.lui) { mem.lui ??= {}; const m = (mem.lui[result.megafonoId] ??= { c: 0, n: 0 }); m.n++; if (result.lui.kind === "CADE") m.c++; }
}
/** Quanto gli altri si aspettano che questo Megafono scommetta "Cade lui!" (con un a priori del 50%). */
const reputation = (mem: BotMemory, who: PlayerId): number => { const m = mem.lui?.[who]; return ((m?.c ?? 0) + 1) / ((m?.n ?? 0) + 2); };

/** Stima dalla sola storia: uniforme senza dati, poi inclina verso le carte che cadono spesso. */
function histProbs(s: GameState, mem: BotMemory): number[] {
  const w = s.tower.map((t) => 1 + ((mem.fell[t.cardId] ?? 0) + 0.5) / ((mem.shown[t.cardId] ?? 0) + 2) * s.tower.length);
  const z = w.reduce((a, b) => a + b, 0); return w.map((x) => x / z);
}
const softmax = (xs: number[]) => { const m = Math.max(...xs), e = xs.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const normalize = (p: number[]) => { const z = p.reduce((a, b) => a + b, 0); return p.map((x) => x / z); };
const phraseText = (s: GameState) => (s.phrase && s.phrase.mode === "card" ? s.phrase.text : undefined);

/** Probabilità stimata che il gruppo voti (e quindi cada) ciascuna posizione della Torre. */
function crowdProbs(s: GameState, mem: BotMemory, level: BotLevel): number[] {
  const hist = histProbs(s, mem), text = phraseText(s);
  const aff = text ? s.tower.map((t) => affinity(t.cardId, text)) : [];
  if (!text || aff.some((a) => a === null)) return hist;
  const p = softmax((aff as number[]).map((a) => a / (level === "hard" ? TUNE.tempHard : 3)));
  return p.map((x, i) => 0.85 * x + 0.15 * hist[i]!);
}
/** Come cambia il voto del gruppo quando vede il Lui! su X e pensa che il Megafono voti proprio X (regola del gregge: se cade, i +2 sono solo suoi). */
function scared(p: number[], x: number, q: number, lambda: number): number[] { return normalize(p.map((v, i) => (i === x ? v * (1 - lambda * q) : v))); }
/** Parametri di taratura dei bot (modificabili dai test di taratura). */
export const TUNE = { voteScare: 0.2, megaScare: 0.2, bluff: true, bluffRate: 0.15, tempHard: 1.6, ownBonus: true, hardNoise: 0.12 };
const argmax = (a: number[]) => a.indexOf(Math.max(...a));

export function chooseBotAction(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number): Action | null {
  const mega = megafonoOf(s), pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!;
  const noise = level === "hard" ? TUNE.hardNoise : 0.4, n = s.tower.length;
  switch (s.phase) {
    case "PROCLAIM": {
      if (me !== mega) return null;
      const c = s.proclaim!; let idx = Math.floor(rand() * c.phrases.length);
      if (level === "hard") { const t = c.phrases.map(phraseTagCount), best = Math.max(...t); if (best > 0) { const top = t.flatMap((v, i) => (v === best ? [i] : [])); idx = pick(top); } }
      return { type: "choosePhrase", playerId: me, mode: "card", index: idx };
    }
    case "PLAY": {
      if (!requiredPlayers(s).includes(me) || s.played[me] !== undefined) return null;
      const hand = s.hands[me]!, text = phraseText(s);
      if (level === "easy") return { type: "playCard", playerId: me, cardId: pick(hand) };
      // la carta che meglio rappresenta la frase è quella che il gruppo voterà: se cade, +2 anche a me
      const hist = (c: CardId) => ((mem.fell[c] ?? 0) + 0.5) / ((mem.shown[c] ?? 0) + 2);
      const score = (c: CardId) => { const a = text ? affinity(c, text) : null; return (a ?? hist(c) * 3) + rand() * (level === "hard" ? 0.6 : 2.5); };
      return { type: "playCard", playerId: me, cardId: hand.slice().sort((a, b) => score(b) - score(a))[0]! };
    }
    case "SUSPECT": {
      if (me !== mega) return null;
      if (level === "easy") return { type: "placeLui", playerId: me, kind: rand() < 0.5 ? "CADE" : "NON_CADE", position: 1 + Math.floor(rand() * n) };
      const p = crowdProbs(s, mem, level), q = reputation(mem, me), lambda = level === "hard" ? TUNE.megaScare : 0;
      // bluff: se tutti mi credono un "Cade lui!" fisso, scommetto "Non cade" sulla carta ovvia per spaventare il gruppo; se mi credono prudente, tento il colpo
      const top = argmax(p);
      if (TUNE.bluff && level === "hard" && q > 0.62 && p[top]! > 0.3 && rand() < TUNE.bluffRate) return { type: "placeLui", playerId: me, kind: "NON_CADE", position: top + 1 };
      if (TUNE.bluff && level === "hard" && q < 0.35 && p[top]! > 0.35 && rand() < TUNE.bluffRate * 1.2) return { type: "placeLui", playerId: me, kind: "CADE", position: top + 1 };
      let best: { kind: "CADE" | "NON_CADE"; x: number } = { kind: "NON_CADE", x: 0 }, bestV = -Infinity;
      for (let x = 0; x < n; x++) {
        const pp = scared(p, x, q, lambda), pe = Math.min(0.95, pp[x]! + 0.1), pn = Math.max(0.01, pp[x]! - 0.04);
        const scare = 0.5 * (p[x]! - pp[x]!) * (n - 1);                                  // punti tolti agli altri deviando il loro voto
        const evCade = pe * 6 - (1 - pe) + 0.3 * pe * (n - 1) * pe + scare;                // +4 Lui!, +2 mio voto, −1 se sbaglio, +gregge
        const pAlt = Math.max(...pp.map((v, i) => (i === x ? -1 : v)));                    // voterò la carta più probabile: se cade, i +2 sono solo miei
        const evNon = 1 - 2 * pn + scare + pAlt * (2 + 0.3 * (n - 1) * pAlt);
        const jitter = (rand() - 0.5) * noise;
        if (evCade + jitter > bestV) { bestV = evCade + jitter; best = { kind: "CADE", x }; }
        if (evNon + jitter > bestV) { bestV = evNon + jitter; best = { kind: "NON_CADE", x }; }
      }
      return { type: "placeLui", playerId: me, kind: best.kind, position: best.x + 1 };
    }
    case "VOTE": {
      if (s.votes[me] !== undefined) return null;
      const vote = (position: number): Action => ({ type: "vote", playerId: me, position });
      if (level === "easy") return vote(1 + Math.floor(rand() * n));
      const p = crowdProbs(s, mem, level), lui = s.lui, ownPos = s.tower.find((t) => t.ownerId === me)?.position ?? -1;
      if (me === mega && lui) {
        // il Megafono decide i pareggi e, se vota la carta che cade, fa lui solo i punti del voto (gregge): CADE → voto la carta scommessa; NON CADE → la più probabile tra le altre
        if (lui.kind === "CADE") return vote(lui.position);
        const alt = p.map((v, i) => (i + 1 === lui.position ? -1 : v)); return vote(argmax(alt) + 1);
      }
      // regola del gregge: se cade la carta votata anche dal Megafono, i miei +2 non contano. Il suo voto è segreto: lo stimo (Lui! = probabile "Cade lui!", altrimenti la carta più probabile)
      const hard = level === "hard", m = p.map(() => 0);
      if (lui) { const q = reputation(mem, mega), x = lui.position - 1, alt = argmax(p.map((v, i) => (i === x ? -1 : v))); m[x]! += q; m[alt]! += 1 - q; } else m[argmax(p)] = 1;
      const pp = hard ? normalize(p.map((v, i) => v * (1 - TUNE.voteScare * m[i]!))) : p;
      let best = 0, bestV = -Infinity;
      for (let k = 0; k < n; k++) {
        const v = pp[k]! * (2 * (hard ? 1 - m[k]! : 1) + (k + 1 === ownPos ? 2 : 0)) + rand() * noise;
        if (v > bestV) { bestV = v; best = k; }
      }
      return vote(best + 1);
    }
    default: return null;
  }
}
