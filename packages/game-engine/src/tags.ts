/** Etichette nascoste (mai inviate ai client) che i giocatori virtuali usano per "capire" quanto un personaggio c'entra con una frase. */
export interface TagSet { tipo: string[]; temi: string[] }
let CARDS: Record<string, TagSet> = {}, PHRASES: Record<string, TagSet> = {};

/** Registra le etichette dei personaggi (per id carta) e delle frasi (per testo). Il Worker lo fa all'avvio; i test con mazzi finti non lo chiamano. */
export function registerTags(cards: Record<string, TagSet>, phrases: Record<string, TagSet>): void { CARDS = cards; PHRASES = phrases; }

/** Affinità tra un personaggio e una frase: temi in comune ×2, tipo umano in comune ×3. `null` se mancano le etichette. */
export function affinity(cardId: string, phraseText: string): number | null {
  const c = CARDS[cardId], p = PHRASES[phraseText]; if (!c || !p) return null;
  let a = 0; for (const t of p.temi) if (c.temi.includes(t)) a += 2; for (const t of p.tipo) if (c.tipo.includes(t)) a += 3; return a;
}
export const phraseTagCount = (text: string): number => { const p = PHRASES[text]; return p ? p.temi.length + p.tipo.length : 0; };
