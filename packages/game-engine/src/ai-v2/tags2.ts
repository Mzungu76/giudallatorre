import { affinity as affinityOld } from "../tags.ts";

/**
 * Etichette v2 («occhi dei bot»): catalogo unico di tipi e temi, con peso 1–3 (quanto l'etichetta è centrale) su carte e frasi.
 * Usate SOLO dal bot v2 e solo con TUNE.labelsV2 = 1 (registro vuoto o leva a 0 → comportamento identico a prima). Non toccano tags.ts.
 * Affinità: per ogni etichetta in comune, base (tipo 3, tema 2) × (peso carta + peso frase) / 6 → due pesi pieni (3+3) valgono come il vecchio punteggio.
 */
export interface Tag2 { tipi: Record<string, number>; temi: Record<string, number> }
let CARDS: Record<string, Tag2> = {}, PHRASES: Record<string, Tag2> = {};
export function registerTagsV2(cards: Record<string, Tag2>, phrases: Record<string, Tag2>): void { CARDS = cards; PHRASES = phrases; }
export const hasTagsV2 = (): boolean => Object.keys(CARDS).length > 0;

export function affinityV2(cardId: string, phraseText: string): number | null {
  const c = CARDS[cardId], p = PHRASES[phraseText];
  if (!c || !p) return affinityOld(cardId, phraseText);   // frasi non etichettate (accuse, confessioni, frasi nuove): si resta sul vecchio sistema
  let a = 0;
  for (const [t, w] of Object.entries(p.tipi)) { const wc = c.tipi[t]; if (wc) a += 3 * (wc + w) / 6; }
  for (const [t, w] of Object.entries(p.temi)) { const wc = c.temi[t]; if (wc) a += 2 * (wc + w) / 6; }
  return a;
}
